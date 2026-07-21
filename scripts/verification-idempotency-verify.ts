// /v1 idempotency, decided BEFORE synthesis. The spec is strict about counts: an identical retry must add
// no synthesis, contract, flow, run, hold or charge, and a changed payload under the same key must add none
// of those either. Those are enforced two ways here: the pure decision core is exhaustively unit-tested, and
// the route is asserted to gate on the reservation BEFORE any of that work happens in source order.
import { readFileSync } from "node:fs";
import {
  decideExisting, verificationFingerprint, STALE_PENDING_MS,
  type ExistingReservation,
} from "../lib/preflight/verification-idempotency";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

const NOW = 1_000_000_000_000;
const fresh = (over: Partial<ExistingReservation> = {}): ExistingReservation =>
  ({ fingerprint: "fp", state: "pending", runId: null, createdAtMs: NOW, ...over });

console.log("── the fingerprint distinguishes requests, not spacing ──");
ok("same url + same claim -> same fingerprint",
  verificationFingerprint("https://x.com", "A user can pay") === verificationFingerprint("https://x.com", "A user can pay"));
ok("whitespace-only claim differences are the SAME fingerprint",
  verificationFingerprint("https://x.com", "A user  can\n pay ") === verificationFingerprint("https://x.com", "A user can pay"));
ok("a changed claim is a DIFFERENT fingerprint",
  verificationFingerprint("https://x.com", "A user can pay") !== verificationFingerprint("https://x.com", "A user can pay twice"));
ok("a changed url is a DIFFERENT fingerprint",
  verificationFingerprint("https://x.com", "c") !== verificationFingerprint("https://y.com", "c"));

console.log("\n── the decision core, every branch ──");
// Launched + same request => replay the original, no work.
ok("launched + same fingerprint -> replay the original run",
  (() => { const d = decideExisting(fresh({ state: "launched", runId: "run-1", fingerprint: "fp" }), "fp", NOW); return d.action === "replay" && d.runId === "run-1"; })());

// Any state + different fingerprint => conflict, no work. This is the payload binding, now BEFORE synthesis.
for (const state of ["pending", "launched", "failed"] as const) {
  ok(`${state} + DIFFERENT fingerprint -> conflict`, decideExisting(fresh({ state, runId: state === "launched" ? "r" : null }), "different", NOW).action === "conflict");
}

// Pending + same request: fresh means a concurrent duplicate (wait); stale means abandoned (reclaim).
ok("pending + same fingerprint + FRESH -> wait (a concurrent duplicate is in flight)",
  decideExisting(fresh({ createdAtMs: NOW - 1000 }), "fp", NOW).action === "wait");
ok("pending + same fingerprint + STALE -> take over (abandoned reservation, not poisoned forever)",
  decideExisting(fresh({ createdAtMs: NOW - STALE_PENDING_MS - 1 }), "fp", NOW).action === "take_over");
ok("the stale boundary is exclusive (exactly STALE_PENDING_MS old still waits)",
  decideExisting(fresh({ createdAtMs: NOW - STALE_PENDING_MS }), "fp", NOW).action === "wait");

// Failed + same request: a prior attempt that never launched must not poison the key.
ok("failed + same fingerprint -> take over (a failed pre-launch attempt is reclaimable)",
  decideExisting(fresh({ state: "failed" }), "fp", NOW).action === "take_over");

// A launched row with no run id is a half-written row; reclaim rather than trust it.
ok("launched + same fingerprint but NO run id -> take over (never replay a half-written row)",
  decideExisting(fresh({ state: "launched", runId: null }), "fp", NOW).action === "take_over");

console.log("\n── the route gates on the reservation BEFORE any expensive work ──");
const src = readFileSync("app/api/v1/verifications/route.ts", "utf8");
const at = (needle: string) => src.indexOf(needle);
// The reservation must be resolved before synthesis, contract creation, and the run launch.
ok("reserve() is called", at("await reserve(") !== -1);
ok("reservation is decided BEFORE laneApplication", at("await reserve(") < at("await laneApplication("));
ok("reservation is decided BEFORE synthesizeClaim (no model call on a retry)", at("await reserve(") < at("await synthesizeClaim("));
ok("reservation is decided BEFORE prepareVerification (no contract on a retry)", at("await reserve(") < at("await prepareVerification("));
ok("reservation is decided BEFORE the run launch (no run or hold on a retry)", at("await reserve(") < at("await launchRun("));

console.log("\n── each reservation outcome returns without doing work ──");
ok("a replay returns the original verification (no synthesis reached)",
  /r\.outcome === "replay"[\s\S]{0,900}status: 200/.test(src));
ok("a conflict returns 409 idempotency_key_reused",
  /r\.outcome === "conflict"[\s\S]{0,400}idempotency_key_reused[\s\S]{0,400}status: 409/.test(src));
ok("a concurrent duplicate is told to retry rather than starting a second synthesis",
  /r\.outcome === "pending"[\s\S]{0,260}verification_in_progress/.test(src));
ok("only an OWNED reservation proceeds to work", /ownsReservation = r\.outcome === "owned"/.test(src));

console.log("\n── a failed reservation is released, never left stuck ──");
ok("synthesis failure releases the reservation", /if \("error" in synth\) \{\s*await releaseOnFailure\(\)/.test(src));
ok("contract-prep failure releases the reservation", /if \("error" in prepared\) \{\s*await releaseOnFailure\(\)/.test(src));
ok("a refused launch releases the reservation", /if \(!launched\.ok \|\| !result\?\.runId\) \{[\s\S]{0,400}await releaseOnFailure\(\)/.test(src));
ok("releaseOnFailure marks the key failed (reclaimable), not deleted or left pending", /markFailed\(p\.principal\.email, idemKey\)/.test(src));
ok("a successful launch records the run so a retry replays it", /if \(ownsReservation && idemKey\) await markLaunched/.test(src));

console.log("\n── the reservation is atomic and tenant scoped ──");
const lib = readFileSync("lib/preflight/verification-idempotency.ts", "utf8");
ok("the reservation uses INSERT-on-conflict-do-nothing (atomic, one winner)", /ignoreDuplicates: true/.test(lib));
ok("take-over is a conditional update on the observed timestamp (only one reclaimer wins)",
  /\.eq\("created_at", r\.created_at\)/.test(lib));
ok("the key is scoped to the acting user everywhere", (lib.match(/\.eq\("user_id", (uid|norm\(owner\))\)/g) || []).length >= 3);
ok("a missing table degrades to 'unavailable', not an error thrown at the caller",
  /if \(ins\.error\) return \{ outcome: "unavailable" \}/.test(lib));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
