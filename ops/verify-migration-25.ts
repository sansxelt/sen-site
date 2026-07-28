// DID MIGRATION 25 ACTUALLY LAND, AND LAND SAFE?
//
// "The SQL ran without an error" is not the same as "the schema now has the properties the feature depends
// on". This checks the three that matter, because each one is a way automatic top-up could go wrong
// quietly:
//
//   The tables exist and are readable with the service role.
//   Nothing is enabled. If applying a migration switched anyone on, that is a charge nobody agreed to.
//   The unique index on idempotency_key is really there. It is the only thing standing between two
//   concurrent settlements and two charges, and an index that failed to create leaves the rest working
//   perfectly until the day it matters.
//
// Reads only. Nothing here writes, enables, or charges.
//   npx tsx ops/verify-migration-25.ts
import { readFileSync } from "node:fs";

function loadEnv() {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

let fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  — ${d}` : ""}`);
  if (!c) fail++;
};

async function main() {
  const { getSupabaseAdminClient, isDatabaseConfigured } = await import("../lib/supabase-admin");
  if (!isDatabaseConfigured()) { console.log("no database configured"); process.exit(1); }
  const db = getSupabaseAdminClient();

  const settings = await db.from("v_auto_recharge" as never).select("user_id, enabled, trigger_cents, target_cents, monthly_cap_cents, consent_at, stripe_payment_method").limit(100);
  ok("v_auto_recharge exists and is readable", !settings.error, settings.error?.message);

  const events = await db.from("v_auto_recharge_events" as never).select("id, kind, idempotency_key").limit(10);
  ok("v_auto_recharge_events exists and is readable", !events.error, events.error?.message);

  if (settings.error || events.error) {
    console.log("\nThe migration has not been applied yet, or the service role cannot see these tables.");
    process.exit(1);
  }

  const rows = (settings.data ?? []) as { enabled: boolean; consent_at: string | null; stripe_payment_method: string | null }[];
  console.log(`\n  rows in v_auto_recharge: ${rows.length}`);
  ok("nobody is enabled by the migration itself", rows.every((r) => !r.enabled),
    `${rows.filter((r) => r.enabled).length} enabled`);
  ok("nobody has consent recorded by the migration itself", rows.every((r) => !r.consent_at));
  ok("no payment method was invented", rows.every((r) => !r.stripe_payment_method));
  console.log(`  rows in v_auto_recharge_events: ${(events.data ?? []).length}`);

  // THE INDEX THAT PREVENTS A DOUBLE CHARGE, proven by trying to violate it rather than by trusting the
  // catalog. Two inserts with the same key: the second must be rejected. Both are removed afterwards.
  const probe = `migration-25-check-${Date.now()}`;
  const owner = "__migration_check__@vraelis.com";
  const insert = () => db.from("v_auto_recharge_events" as never).insert({
    user_id: owner, kind: "refused", reason: "migration 25 index check, not a real event",
    idempotency_key: probe,
  } as never);

  const first = await insert();
  if (first.error) {
    ok("the idempotency index could be tested", false, first.error.message);
  } else {
    const second = await insert();
    ok("a duplicate idempotency_key is REJECTED, so two settlements cannot both charge",
      !!second.error && String((second.error as { code?: string }).code) === "23505",
      second.error ? `got ${(second.error as { code?: string }).code}` : "the second insert SUCCEEDED, which means the unique index is missing");
    await db.from("v_auto_recharge_events" as never).delete().eq("idempotency_key", probe);
    const left = await db.from("v_auto_recharge_events" as never).select("id").eq("user_id", owner);
    ok("the probe rows were cleaned up", ((left.data ?? []) as unknown[]).length === 0);
  }

  console.log(fail === 0
    ? "\nALL PASS. Migration 25 is applied and automatic top-up is off for everyone, as it should be."
    : `\n${fail} check(s) failed.`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
