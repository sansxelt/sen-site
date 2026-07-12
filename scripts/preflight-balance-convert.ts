// Operator tool for pricing step 9 (docs/pricing-verdict-final.md): convert an owner's LIVE credit
// balance into unit='cent' ledger rows at the price paid — $0.10/credit (the top-up rate) for purchased
// balance; signup/comp/reward balance converts at the same $0.10 but its minted cents are LABELED
// promotional (reason 'conversion_promo'); a live monthly-bucket remainder converts with its expiry
// CARRIED OVER (expiring credits never become permanent cents). Dry-run by default; --apply writes.
//
// What --apply does per non-empty conversion group (audit history preserved, NOTHING deleted — source
// rows are untouched; the conversion is an appended row PAIR):
//   - one negative 'credit' row zeroing that group's live credit balance
//   - one positive 'cent' row minting credits x 10 cents into the same bucket
// Both legs are idempotent per owner+group via the ledger ext_ref unique index (migration:<owner>:...),
// so a re-run (including after a partial failure) heals instead of double-converting.
//
// Requires sql/vraelis-preflight-6-pass-pricing.sql (the unit column). Convert only when the owner has
// NO runs or evaluations in flight: a live escrow refunded after conversion lands back as CREDITS.
//
// Run (dry-run):  PREFLIGHT_SEED_RUN=1 npm run preflight:convert-balance -- --owner=you@example.com
// Apply:          PREFLIGHT_SEED_RUN=1 npm run preflight:convert-balance -- --owner=you@example.com --apply
import { loadLocalEnv } from "../worker/preflight/local-env";
import { getSupabaseAdminClient, isDatabaseConfigured } from "../lib/supabase-admin";
import { grant } from "../lib/v-credits";

const RUNTIME = { NODE_ENV: process.env.NODE_ENV, VERCEL_ENV: process.env.VERCEL_ENV, VERCEL: process.env.VERCEL };
loadLocalEnv();

// The conversion rate: 1 credit was sold at $0.10 (CREDITS_PER_DOLLAR = 10 in the top-up checkout).
const CENTS_PER_CREDIT = 10;
// Grants that were never paid for; their converted cents are labeled promotional.
const PROMO_REASONS = new Set(["signup", "comp", "reward"]);

function arg(name: string): string | undefined {
  const pre = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pre));
  return hit ? hit.slice(pre.length) : undefined;
}
const APPLY = process.argv.includes("--apply");

type Row = { delta: number; bucket: string | null; expires_at: string | null; reason: string | null; ext_ref: string | null; unit: string | null };
type Group = { group: string; bucket: string; credits: number; cents: number; reason: string; expiresAt: string | null; label: string };

async function main(): Promise<void> {
  if (process.env.PREFLIGHT_SEED_RUN !== "1") {
    console.error("Refusing to run: set PREFLIGHT_SEED_RUN=1 (internal operator tool)."); process.exit(2);
  }
  // Same pre-.env-load production stance as the other operator drivers: a local shell is never production
  // because .env.local carries VERCEL_ENV; a genuine prod runtime still requires the explicit override.
  const prod = RUNTIME.NODE_ENV === "production" || RUNTIME.VERCEL_ENV === "production"
    || (RUNTIME.VERCEL === "1" && RUNTIME.VERCEL_ENV !== "development" && RUNTIME.VERCEL_ENV !== "preview");
  if (prod && process.env.PREFLIGHT_SEED_ALLOW_PROD !== "1") {
    console.error("Refusing: the process runtime looks like production (set PREFLIGHT_SEED_ALLOW_PROD=1 only deliberately)."); process.exit(2);
  }
  const owner = (arg("owner") || "").trim().toLowerCase();
  if (!owner.includes("@")) { console.error("An owner email is required: --owner=you@example.com"); process.exit(2); }
  if (!isDatabaseConfigured()) { console.error("Database not configured."); process.exit(2); }
  const s = getSupabaseAdminClient();

  // The whole ledger for this owner, WITH units. A select error naming `unit` means the phase-6
  // migration is unapplied — the one hard prerequisite.
  const { data, error } = await s.from("v_credit_ledger")
    .select("delta, bucket, expires_at, reason, ext_ref, unit").eq("user_id", owner);
  if (error) {
    console.error(`Ledger read failed: ${error.message}`);
    if (/unit/i.test(error.message)) console.error("Apply sql/vraelis-preflight-6-pass-pricing.sql first (the unit column is required).");
    process.exit(1);
  }
  const now = Date.now();
  const live = ((data as unknown as Row[]) ?? []).filter((r) => r.expires_at === null || new Date(r.expires_at).getTime() > now);
  const credits = live.filter((r) => (r.unit ?? "credit") === "credit");
  const cents = live.filter((r) => r.unit === "cent");
  const sum = (rows: Row[]) => rows.reduce((a, r) => a + r.delta, 0);

  // Partition the live CREDIT balance. Spends never carried a funding-source tag, so the promotional
  // share is bounded by what was ever granted promotionally: promo = min(purchased balance, live
  // promotional grants); the remainder of the purchased balance converts as paid.
  const purchasedNet = Math.max(0, sum(credits.filter((r) => r.bucket === "purchased")));
  const monthlyNet = Math.max(0, sum(credits.filter((r) => r.bucket === "monthly")));
  const promoGranted = credits
    .filter((r) => r.delta > 0 && r.bucket === "purchased" && PROMO_REASONS.has(r.reason ?? ""))
    .reduce((a, r) => a + r.delta, 0);
  const promoCredits = Math.min(purchasedNet, promoGranted);
  const paidCredits = purchasedNet - promoCredits;
  const monthlyExpiry = credits
    .filter((r) => r.bucket === "monthly" && r.delta > 0 && r.expires_at)
    .map((r) => r.expires_at as string).sort().pop() ?? null;

  const groups: Group[] = [
    { group: "purchased-paid", bucket: "purchased", credits: paidCredits, cents: paidCredits * CENTS_PER_CREDIT, reason: "conversion", expiresAt: null, label: "paid (top-ups, $0.10/credit)" },
    { group: "purchased-promo", bucket: "purchased", credits: promoCredits, cents: promoCredits * CENTS_PER_CREDIT, reason: "conversion_promo", expiresAt: null, label: "promotional (signup/comp/reward; labeled, same rate)" },
    { group: "monthly", bucket: "monthly", credits: monthlyNet, cents: monthlyNet * CENTS_PER_CREDIT, reason: "conversion", expiresAt: monthlyExpiry, label: "monthly remainder (expiry carried over)" },
  ].filter((g) => g.credits > 0);

  // In-flight money warning: a live escrow refunded AFTER conversion comes back as credits.
  const { count: activeRuns } = await s.from("v_preflight_runs").select("id", { count: "exact", head: true })
    .eq("user_id", owner).not("state", "in", "(completed,failed,cancelled)");
  const { count: activeTests } = await s.from("v_tests").select("id", { count: "exact", head: true })
    .eq("user_id", owner).eq("status", "active");
  if ((activeRuns ?? 0) > 0 || (activeTests ?? 0) > 0) {
    console.warn(`WARNING: ${activeRuns ?? 0} preflight run(s) and ${activeTests ?? 0} evaluation(s) are in flight for this owner. Their escrow refunds will land as CREDITS after conversion — let them settle first.`);
  }

  console.log(`\n${APPLY ? "APPLY" : "DRY RUN"}: credit -> cent conversion for ${owner} at $0.10/credit\n`);
  console.log(`  live credit balance: ${sum(credits)}   live cent balance: ${sum(cents)} ($${(sum(cents) / 100).toFixed(2)})\n`);
  if (!groups.length) { console.log("  Nothing to convert (no positive live credit balance)."); process.exit(0); }
  for (const g of groups) {
    console.log(`  ${g.group.padEnd(16)} ${String(g.credits).padStart(6)} credits -> ${String(g.cents).padStart(7)} cents ($${(g.cents / 100).toFixed(2)})  ${g.label}${g.expiresAt ? `  expires ${g.expiresAt}` : ""}`);
  }
  const totalCents = groups.reduce((a, g) => a + g.cents, 0);
  console.log(`\n  total: ${groups.reduce((a, g) => a + g.credits, 0)} credits -> ${totalCents} cents ($${(totalCents / 100).toFixed(2)})`);
  if (!APPLY) {
    console.log("\nRe-run with --apply to append the conversion row pairs (source rows are never touched).");
    process.exit(0);
  }

  // Each leg: pre-check its ext_ref (so an idempotent no-op is reported as such), then insert via
  // grant(). Both legs are attempted on every run, so a prior partial failure heals here.
  const leg = async (reason: string, extRef: string, delta: number, bucket: string, unit: "credit" | "cent", expiresAt: string | null): Promise<string> => {
    const { count } = await s.from("v_credit_ledger").select("id", { count: "exact", head: true })
      .eq("user_id", owner).eq("reason", reason).eq("ext_ref", extRef);
    if ((count ?? 0) > 0) return "already-converted";
    const ok = await grant(owner, delta, reason, { bucket, unit, expiresAt, refType: "migration", extRef });
    return ok ? "inserted" : "FAILED (re-run to heal)";
  };
  let failed = false;
  for (const g of groups) {
    const out = await leg(g.reason, `migration:${owner}:${g.group}:credits`, -g.credits, g.bucket, "credit", g.expiresAt);
    const inn = await leg(g.reason, `migration:${owner}:${g.group}:cents`, g.cents, g.bucket, "cent", g.expiresAt);
    if (out.startsWith("FAILED") || inn.startsWith("FAILED")) failed = true;
    console.log(`  applied ${g.group}: -${g.credits} credits [${out}], +${g.cents} cents [${inn}]`);
  }

  const { data: after } = await s.from("v_credit_ledger")
    .select("delta, bucket, expires_at, reason, ext_ref, unit").eq("user_id", owner);
  const liveAfter = ((after as unknown as Row[]) ?? []).filter((r) => r.expires_at === null || new Date(r.expires_at).getTime() > now);
  const cr = sum(liveAfter.filter((r) => (r.unit ?? "credit") === "credit"));
  const ct = sum(liveAfter.filter((r) => r.unit === "cent"));
  console.log(`\nDone. Live balances now: ${cr} credits, ${ct} cents ($${(ct / 100).toFixed(2)}). Source rows were not modified.`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(`balance-convert crashed: ${(e as Error).message}`); process.exit(1); });
