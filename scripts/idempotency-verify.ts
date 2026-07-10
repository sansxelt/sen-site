// Server-side idempotency verification (Pass 2A Phase 5) against the REAL DB. Proves: one winner among
// concurrent identical submissions, replay-after-completed returns the same check, replay-after-failed
// stays failed, and a new key reserves fresh. Requires sql/ai-check-idempotency.sql applied.
// Run: npx tsx scripts/idempotency-verify.ts
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
function envLongest(raw: string, name: string): string {
  const all = [...raw.matchAll(new RegExp(`^\\s*${name}\\s*=\\s*(.*)\\s*$`, "gm"))].map((m) => m[1].replace(/^["']|["']$/g, "").trim());
  return all.slice().sort((a, b) => b.length - a.length)[0] || "";
}
const raw = readFileSync(".env.local", "utf8");
process.env.NEXT_PUBLIC_SUPABASE_URL = envLongest(raw, "NEXT_PUBLIC_SUPABASE_URL") || envLongest(raw, "SUPABASE_URL");
process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = envLongest(raw, "SUPABASE_SERVICE_ROLE_KEY");

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`${c ? "PASS" : "FAIL"}  ${n}`); if (c) pass++; else fail++; };

async function main() {
  const idem = await import("../lib/v-idempotency");
  const owner = "idem@vraelis.local";
  const k1 = `sub-${crypto.randomUUID()}`, k2 = `sub-${crypto.randomUUID()}`, k3 = `sub-${crypto.randomUUID()}`;
  try {
    const first = await idem.reserveSubmission(owner, k1);
    if (!(first.reserved === true)) {
      console.log("\nMIGRATION NOT APPLIED (or DB unreachable). Apply sql/ai-check-idempotency.sql in the Supabase SQL editor, then rerun.");
      process.exit(3);
    }
    ok("fresh submission reserves", first.reserved === true);
    const again = await idem.reserveSubmission(owner, k1);
    ok("same id while reserved -> not reserved, status reserved", !again.reserved && (again as { status: string }).status === "reserved");

    // Concurrent identical submissions: exactly ONE wins the reservation.
    const con = await Promise.all(Array.from({ length: 6 }, () => idem.reserveSubmission(owner, k2)));
    ok("concurrent same-id: exactly one reservation wins", con.filter((r) => r.reserved === true).length === 1);

    // Completed replay returns the same check, no re-charge/re-eval.
    const checkId = crypto.randomUUID();
    await idem.completeSubmission(owner, k1, checkId);
    const replay = await idem.reserveSubmission(owner, k1);
    ok("replay after completed -> returns the existing check, no re-eval", !replay.reserved && (replay as { status: string; checkId: string | null }).status === "completed" && (replay as { checkId: string | null }).checkId === checkId);

    // Terminal failure replay stays failed; a NEW key reserves fresh.
    await idem.failSubmission(owner, k2, "evaluator_error");
    const failReplay = await idem.reserveSubmission(owner, k2);
    ok("replay after terminal failure -> stays failed", !failReplay.reserved && (failReplay as { status: string }).status === "failed");
    const fresh = await idem.reserveSubmission(owner, k3);
    ok("a NEW submission id reserves fresh (intentional retry)", fresh.reserved === true);

    // Recoverable failure releases the reservation so the SAME id can retry.
    await idem.failSubmission(owner, k3, "transient", true);
    const retry = await idem.reserveSubmission(owner, k3);
    ok("recoverable failure releases the id for a same-id retry", retry.reserved === true);
  } finally {
    for (const k of [k1, k2, k3]) await idem.deleteSubmission(owner, k);
  }
  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
