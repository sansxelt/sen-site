// Subscription self-heal. Webhooks are the primary signal for plan lifecycle,
// but a dropped/missed delivery — or a PayPal subscription created without a
// custom_id (which the webhook can't route) — would otherwise leave plan_status
// stale 'active' forever, keeping paid features + the agent number live and
// unbilled-for. This polls the provider's LIVE subscription status so a missed
// cancel / past_due self-heals within a day (driven by cron/subscriptions).

import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "./stripe";
import type { WorkspaceLapseRow } from "./vraelis-db";
import {
  vraelisPlanFromPaypalPlanId,
  vraelisPlanStatusFromPaypal,
  type Cycle,
  type PlanKey,
} from "./vraelis-plans";

// `plan`/`cycle` carry the provider's CANONICAL tier when it can be derived
// (PayPal: from the subscription's plan_id). The reconcile cron uses them to
// correct a stored tier that disagrees with what the customer actually pays
// for — the self-heal for finding H1's historical rows. null/absent means the
// provider gave us nothing authoritative and the stored tier must be left as-is.
export type LivePlan = {
  status: "active" | "past_due" | "canceled";
  periodEndISO: string | null;
  plan?: PlanKey | null;
  cycle?: Cycle | null;
  // Distinguishes the two reasons plan/cycle can be null, which are NOT the same thing:
  //   "resolved"    - the provider named a plan we recognise; plan/cycle are authoritative.
  //   "unbacked"    - the provider answered, but its plan is NOT in the Vraelis catalogue. A stored paid
  //                   tier on such a subscription has no backing and must be treated as an anomaly.
  //   "unavailable" - we could not ask (no id, provider unconfigured, poll failed), or the provider does
  //                   not expose a tier (Stripe path). Keep whatever is stored.
  // Collapsing "unbacked" into "unavailable" is what let a forged tier survive every reconcile pass.
  tierSource?: "resolved" | "unbacked" | "unavailable";
};

function mapStripeStatus(s: Stripe.Subscription.Status): LivePlan["status"] | null {
  if (s === "active" || s === "trialing") return "active";
  if (s === "past_due") return "past_due";
  if (s === "canceled" || s === "unpaid" || s === "incomplete_expired") return "canceled";
  return null; // incomplete / paused → transient, leave the workspace as-is
}

function periodEndISOFromStripe(sub: Stripe.Subscription): string | null {
  const raw = (sub as unknown as Record<string, unknown>)["current_period_end"];
  return typeof raw === "number" ? new Date(raw * 1000).toISOString() : null;
}

async function fetchStripeLive(row: WorkspaceLapseRow): Promise<LivePlan | null> {
  if (!isStripeConfigured()) return null;
  const stripe = getStripe();
  try {
    let sub: Stripe.Subscription | null = null;
    if (row.plan_subscription_id) {
      sub = await stripe.subscriptions.retrieve(row.plan_subscription_id);
    } else {
      // No stored id (older row) → find the customer by email and pick their
      // most relevant subscription.
      const customers = await stripe.customers.list({ email: row.owner_email, limit: 1 });
      const cust = customers.data[0];
      if (!cust) return { status: "canceled", periodEndISO: null }; // no customer → nothing live
      const subs = await stripe.subscriptions.list({ customer: cust.id, status: "all", limit: 10 });
      sub =
        subs.data.find((s) => ["active", "trialing", "past_due"].includes(s.status)) ??
        subs.data[0] ??
        null;
    }
    if (!sub) return { status: "canceled", periodEndISO: null };
    const status = mapStripeStatus(sub.status);
    if (!status) return null;
    return { status, periodEndISO: periodEndISOFromStripe(sub) };
  } catch (e) {
    console.error("[plan-sync] stripe poll failed for", row.owner_email, e);
    return null;
  }
}

const PP_BASE =
  (process.env.PAYPAL_ENV ?? "").toLowerCase() === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

async function paypalToken(): Promise<string | null> {
  const cid = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!cid || !secret) return null;
  const basic = Buffer.from(`${cid}:${secret}`).toString("base64");
  try {
    const res = await fetch(`${PP_BASE}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    const json = (await res.json()) as { access_token?: string };
    return json.access_token ?? null;
  } catch {
    return null;
  }
}

// Single definition of "what does this PayPal status mean" lives in
// vraelis-plans so the record route, the webhook and this reconcile agree.
// APPROVED / APPROVAL_PENDING map to null (transient, never entitling).
const mapPaypalStatus = vraelisPlanStatusFromPaypal;

async function fetchPaypalLive(row: WorkspaceLapseRow): Promise<LivePlan | null> {
  if (!row.plan_subscription_id) return null; // can't poll PayPal without the id
  const token = await paypalToken();
  if (!token) return null;
  try {
    // encodeURIComponent, matching the record route and the audit script: the stored id is data, and a
    // stray / ? or # in it would otherwise change which PayPal resource this polls.
    const res = await fetch(`${PP_BASE}/v1/billing/subscriptions/${encodeURIComponent(row.plan_subscription_id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const sub = (await res.json()) as {
      status?: string;
      plan_id?: string;
      billing_info?: { next_billing_time?: string };
    };
    const status = mapPaypalStatus(sub.status);
    if (!status) return null;
    const nb = sub.billing_info?.next_billing_time;
    // Canonical tier straight from PayPal. An unrecognised plan_id yields null
    // and the caller keeps the stored tier rather than guessing.
    const tier = vraelisPlanFromPaypalPlanId(sub.plan_id);
    // PayPal answered. Either its plan is one of ours (resolved) or it is not (unbacked) — the latter is a
    // real signal, not an absence of one.
    return {
      status,
      periodEndISO: nb ? new Date(nb).toISOString() : null,
      plan: tier?.plan ?? null,
      cycle: tier?.cycle ?? null,
      tierSource: tier ? "resolved" : "unbacked",
    };
  } catch (e) {
    console.error("[plan-sync] paypal poll failed for", row.owner_email, e);
    return null;
  }
}

// Poll the provider for a workspace's LIVE plan status. Returns null when it
// can't be determined (provider unconfigured, transient state, poll error) —
// the caller should then leave the stored status untouched.
export async function fetchLivePlanStatus(row: WorkspaceLapseRow): Promise<LivePlan | null> {
  if (row.plan_provider === "paypal") return fetchPaypalLive(row);
  if (row.plan_provider === "stripe") return fetchStripeLive(row);
  // Unknown provider but a Stripe-looking sub id → try Stripe.
  if (row.plan_subscription_id?.startsWith("sub_")) return fetchStripeLive(row);
  return null;
}

// The tier the reconcile cron should STORE, given what we have on the row and
// what the provider reports live. Pure and exported so the security property —
// a stored tier that disagrees with the provider gets corrected, and an
// unresolvable provider tier never clobbers a good stored one — is directly
// testable without a DB or network. See finding H1.
export function canonicalTier(
  stored: { plan: string; cycle: string },
  live: Pick<LivePlan, "plan" | "cycle" | "tierSource">,
): { plan: string; cycle: string; tierDiffers: boolean; unbacked: boolean } {
  // The provider answered and its plan is not in our catalogue: the stored paid tier has nothing behind
  // it. Demote to the free tier rather than preserving it — preserving it is precisely how a tier that was
  // never paid for survived every reconcile pass. "starter" is the free default cutRateFor falls back to.
  if (live.tierSource === "unbacked") {
    const plan = FREE_PLAN;
    const cycle = "monthly";
    return { plan, cycle, tierDiffers: plan !== stored.plan || cycle !== stored.cycle, unbacked: true };
  }
  // Either resolved, or we could not ask. Trust the live tier when we have one, else keep what is stored.
  const plan = live.plan ?? stored.plan;
  const cycle = live.cycle ?? stored.cycle;
  return { plan, cycle, tierDiffers: plan !== stored.plan || cycle !== stored.cycle, unbacked: false };
}

// The free tier a workspace falls back to. Kept here so the demotion above and the cron agree.
export const FREE_PLAN = "starter";
