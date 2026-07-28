// GET/POST /api/v/auto-recharge — the customer's own automatic top-up settings.
//
// Session-gated and owner-scoped. There is no id in either direction: an owner can only ever read or write
// their own row, because the row is keyed by the session's email and nothing in the request body can
// change which row is touched.
//
// THE ONE RULE THIS ROUTE ENFORCES THAT THE UI CANNOT: consent and enablement are the same act. A client
// can post enabled: true with consent: false, and the server refuses rather than trusting a checkbox it did
// not render. Everything a browser sends is a suggestion.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getSettings, saveSettings, validateSettings, chargedThisMonthCents,
} from "@/lib/preflight/auto-recharge";
import { getSupabaseAdminClient, isDatabaseConfigured } from "@/lib/supabase-admin";

export const runtime = "nodejs";

async function recentEvents(owner: string) {
  if (!isDatabaseConfigured()) return [];
  try {
    const s = getSupabaseAdminClient();
    const { data, error } = await s.from("v_auto_recharge_events" as never)
      .select("created_at, kind, amount_cents, reason")
      .eq("user_id", owner).order("created_at", { ascending: false }).limit(8);
    if (error) return [];
    return ((data as { created_at: string; kind: string; amount_cents: number | null; reason: string | null }[] | null) ?? [])
      .map((e) => ({ at: e.created_at, kind: e.kind, amountCents: e.amount_cents, reason: e.reason }));
  } catch { return []; }
}

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const owner = email.toLowerCase();

  const [s, month, recent] = await Promise.all([
    getSettings(owner), chargedThisMonthCents(owner), recentEvents(owner),
  ]);

  // WHAT IS ACTUALLY SAVED, named. "A saved card" is wrong whenever it is a PayPal account or a bank
  // debit, and Stripe offers whichever of those this account has enabled.
  //
  // Fetched rather than stored. A stored label goes stale the moment a card expires or a PayPal account
  // is disconnected, and a settings page confidently naming a payment method that no longer works is worse
  // than one that names none. One API call, on a page nobody opens in a loop.
  let method: { type: string; label: string } | null = null;
  if (s.stripePaymentMethod) {
    try {
      const { getStripe, isStripeConfigured } = await import("@/lib/stripe");
      if (isStripeConfigured()) {
        const pm = await getStripe().paymentMethods.retrieve(s.stripePaymentMethod);
        const brand = pm.card ? `${pm.card.brand} ending ${pm.card.last4}`
          : pm.us_bank_account ? `${pm.us_bank_account.bank_name ?? "Bank account"} ending ${pm.us_bank_account.last4}`
          : pm.sepa_debit ? `SEPA account ending ${pm.sepa_debit.last4}`
          : pm.paypal ? `PayPal${pm.paypal.payer_email ? ` (${pm.paypal.payer_email})` : ""}`
          : pm.link ? `Link${pm.link.email ? ` (${pm.link.email})` : ""}`
          : pm.type.replace(/_/g, " ");
        method = { type: pm.type, label: brand };
      }
    } catch {
      // A payment method Stripe cannot find is one that has been detached. Reporting none is correct:
      // decide() will refuse for want of a usable method, and the page should say the same thing.
      method = null;
    }
  }

  // The payment method id itself never leaves the server. The client needs to know WHETHER one exists, not
  // which one it is, and a pm_ id in a JSON response is a token in a browser's network log for no reason.
  return NextResponse.json({
    enabled: s.enabled,
    triggerCents: s.triggerCents, targetCents: s.targetCents, monthlyCapCents: s.monthlyCapCents,
    // Requires the method to still EXIST at Stripe, not merely to have an id on file. A detached method
    // leaves the id behind, and reporting that as "you have a payment method saved" would let someone turn
    // this on and then watch every top-up refuse.
    hasPaymentMethod: !!s.stripePaymentMethod && !!s.stripeCustomerId && !!method,
    paymentMethod: method,
    consentAt: s.consentAt,
    consecutiveFailures: s.consecutiveFailures,
    disabledReason: s.disabledReason,
    // A month total that could not be read comes back as MAX_SAFE_INTEGER so the decision fails closed.
    // That is the right behaviour for the decision and a nonsense number to render, so it is clamped here.
    chargedThisMonthCents: Number.isSafeInteger(month) && month < 1e9 ? month : 0,
    recent,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const owner = email.toLowerCase();

  let body: { enabled?: unknown; triggerCents?: unknown; targetCents?: unknown; monthlyCapCents?: unknown; consent?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }

  const enabled = body.enabled === true;
  const nums = {
    triggerCents: Math.round(Number(body.triggerCents)),
    targetCents: Math.round(Number(body.targetCents)),
    monthlyCapCents: Math.round(Number(body.monthlyCapCents)),
  };

  // TURNING IT OFF IS ALWAYS ALLOWED, and never validated. A customer with a configuration this route would
  // now reject must still be able to stop it: making "off" depend on passing validation is how someone ends
  // up unable to switch off a recurring charge.
  if (!enabled) {
    const done = await saveSettings(owner, { enabled: false, disabledReason: null });
    return done ? NextResponse.json({ ok: true, enabled: false }) : NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  if (body.consent !== true) {
    return NextResponse.json({ problems: ["Automatic top-up cannot be turned on without your authorisation."] }, { status: 400 });
  }

  const problems = validateSettings(nums);
  if (problems.length) return NextResponse.json({ problems }, { status: 400 });

  const current = await getSettings(owner);
  if (!current.stripePaymentMethod || !current.stripeCustomerId) {
    return NextResponse.json({
      problems: ["No saved card. Automatic top-up needs one, and a card is only saved when you ask for it during a top-up."],
    }, { status: 400 });
  }

  const done = await saveSettings(owner, {
    enabled: true, ...nums,
    // Re-consenting clears a previous shutdown. Turning it back on after a run of declines is an explicit
    // act by the customer, so the failure count that stopped it should not survive that act.
    consentAt: new Date().toISOString(),
    consecutiveFailures: 0, disabledReason: null,
  });
  return done ? NextResponse.json({ ok: true, enabled: true }) : NextResponse.json({ error: "unavailable" }, { status: 503 });
}
