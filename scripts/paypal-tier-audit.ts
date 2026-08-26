// Finding H1 — READ-ONLY audit of stored plan tiers vs PayPal's authoritative
// plan_id. Identifies workspaces whose stored tier was never backed by a
// matching PayPal billing plan (i.e. rows the old record route could have
// written from a client-supplied `plan`).
//
// THIS SCRIPT NEVER WRITES. It performs no UPDATE, no INSERT, no repair. The
// remediation path is the reconcile cron (app/api/vraelis/cron/subscriptions),
// which now corrects a mismatched tier from the provider — run it against
// production from production, never from a developer machine.
//
// Emails are masked by default. Pass --full to print them unmasked (do that
// only on a machine where that PII is already appropriate).
//
// Usage: tsx scripts/paypal-tier-audit.ts [--full]
import { getSupabaseAdminClient, isDatabaseConfigured } from "../lib/supabase-admin";
import { vraelisPlanFromPaypalPlanId, isPlanKey } from "../lib/vraelis-plans";

const FULL = process.argv.includes("--full");

function mask(email: string): string {
  if (FULL) return email;
  const [u, d] = email.split("@");
  if (!d) return "***";
  return `${u.slice(0, 2)}***@${d}`;
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
  const res = await fetch(`${PP_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}

type Row = {
  owner_email: string;
  plan: string | null;
  plan_cycle: string | null;
  plan_status: string | null;
  plan_provider: string | null;
  plan_subscription_id: string | null;
};

async function main() {
  if (!isDatabaseConfigured()) {
    console.error("DB not configured — set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(2);
  }
  const token = await paypalToken();
  if (!token) {
    console.error("PayPal not configured — set PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET.");
    process.exit(2);
  }
  console.log(`PayPal base: ${PP_BASE}`);
  console.log(`Emails: ${FULL ? "UNMASKED" : "masked (pass --full to reveal)"}\n`);

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("vraelis_workspaces" as never)
    .select("owner_email, plan, plan_cycle, plan_status, plan_provider, plan_subscription_id");
  if (error) {
    console.error("query failed:", error.message);
    process.exit(2);
  }
  const rows = ((data as unknown as Row[]) ?? []).filter(
    (r) => r.plan && isPlanKey(r.plan) && r.plan_provider === "paypal",
  );
  console.log(`${rows.length} PayPal-backed paid workspace(s) to check.\n`);

  const mismatched: string[] = [];
  const unverifiable: string[] = [];
  let okCount = 0;

  for (const r of rows) {
    const who = mask(r.owner_email);
    if (!r.plan_subscription_id) {
      unverifiable.push(`${who}  stored=${r.plan}/${r.plan_cycle}  reason=no_subscription_id`);
      continue;
    }
    const res = await fetch(
      `${PP_BASE}/v1/billing/subscriptions/${encodeURIComponent(r.plan_subscription_id)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      unverifiable.push(`${who}  stored=${r.plan}/${r.plan_cycle}  reason=paypal_${res.status}`);
      continue;
    }
    const sub = (await res.json()) as { status?: string; plan_id?: string };
    const tier = vraelisPlanFromPaypalPlanId(sub.plan_id);
    if (!tier) {
      unverifiable.push(
        `${who}  stored=${r.plan}/${r.plan_cycle}  reason=unrecognized_plan_id  ppStatus=${sub.status ?? "?"}`,
      );
      continue;
    }
    if (tier.plan !== r.plan || tier.cycle !== r.plan_cycle) {
      mismatched.push(
        `${who}  stored=${r.plan}/${r.plan_cycle}  paypal=${tier.plan}/${tier.cycle}  ppStatus=${sub.status ?? "?"}  storedStatus=${r.plan_status ?? "?"}`,
      );
    } else {
      okCount += 1;
    }
  }

  console.log(`── matches PayPal: ${okCount}`);
  console.log(`── MISMATCHED: ${mismatched.length}`);
  for (const m of mismatched) console.log(`   ${m}`);
  console.log(`── unverifiable: ${unverifiable.length}`);
  for (const u of unverifiable) console.log(`   ${u}`);

  console.log(`\nNo data was modified. To repair, run the reconcile cron in the`);
  console.log(`SAME environment as the data:`);
  console.log(`  curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/vraelis/cron/subscriptions`);
  console.log(`It rewrites each row's tier from the provider and logs every correction.`);
  process.exit(mismatched.length ? 1 : 0);
}

void main();
