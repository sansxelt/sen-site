// THE CREDIT HOLD: a hold is true only when the money actually moved.
//
// Found by an adversarial pass over the launch money path. hold() awaited both grant() calls and DISCARDED
// their return values, then returned true unconditionally after the balance check. grant() returns false
// when the ledger insert fails; it logs and continues. So a transient failure left hold() reporting success
// with nothing debited, and the caller set creditsHeld and a reservation id for money it never took.
//
// Both ends of that are wrong, and they fail in opposite directions:
//
//   the run proceeds and the worker settles by RETAINING a hold that does not exist, so the run is free
//   any later failure calls refund(), which reads the ACTUAL held rows, finds none, treats the whole amount
//   as the monthly remainder and grants it — minting credits out of a failed insert
//
// These are source assertions, not a live ledger test: this path cannot be exercised without a database, and
// the property that matters is structural — the return value of every debit must decide the outcome.
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

const src = readFileSync("lib/v-credits.ts", "utf8");
const hold = src.slice(src.indexOf("export async function hold("), src.indexOf("export async function refund("));
const code = hold.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

console.log("── a hold is true only when the debit landed ──");
ok("the monthly debit's result is checked", /const ok = await grant\(userId, -fromMonthly/.test(code));
ok("the purchased debit's result is checked", /const ok = await grant\(userId, -fromPurchased/.test(code));
ok("a failed debit returns false", (code.match(/return false;/g) ?? []).length >= 2);
// The specific regression: `return true` must not be reachable while a debit's outcome is unknown.
ok("no debit's return value is discarded",
  !/^\s*(await |void )?grant\(userId, -\w+/m.test(code.replace(/const ok = await grant/g, "CHECKED")));

console.log("\n── a partial debit is compensated, never abandoned ──");
// If the monthly leg lands and the purchased leg fails, returning false without compensating leaves the
// customer's credits debited for a hold the caller believes it never took. Nothing would ever release it.
ok("a landed monthly leg is credited back when the purchased leg fails",
  /grant\(userId, fromMonthly, "hold"/.test(code));
ok("the compensation is keyed so a retry cannot double-credit", /hold_rollback:\$\{testId\}/.test(code));
ok("it is written as a hold row, so it nets against its own debit",
  /grant\(userId, fromMonthly, "hold"/.test(code));

console.log("\n── the balance check still guards the top ──");
ok("an insufficient balance still refuses before any write", /if \(bal < amount\) return false;/.test(code));
ok("a zero or negative amount is still a no-op", /if \(amount <= 0\) return true;/.test(code));

console.log("\n── refund still reads the real rows, which is why the above matters ──");
{
  const refund = src.slice(src.indexOf("export async function refund("), src.indexOf("export async function spend("));
  // This is the mechanism that turned a failed debit into minted credit: with no held rows, purchasedHeld is
  // 0, the whole amount becomes the monthly remainder, and it is granted.
  ok("refund derives what to return from the held rows", /const held = all\.filter\(\(r\) => r\.reason === "hold"/.test(refund));
  ok("the monthly remainder is granted only when a live monthly bucket exists", /if \(remainder > 0 && exp\)/.test(refund));
  ok("each refund leg stays idempotent per test", /refund:\$\{testId\}:p/.test(refund) && /refund:\$\{testId\}:m/.test(refund));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
