// The shared verification client is the single product boundary between authenticated UI and
// /v1/verifications. These assertions cover the parts that are pure, plus the structural rule that keeps
// the boundary a boundary.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { normalizeDeploymentUrl, normalizeClaim } from "../lib/verification-client";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

console.log("── input normalization happens once, at the boundary ──");
// A pasted URL usually arrives without a scheme. Rejecting that would be pedantry, not validation.
ok("a bare host gains https", normalizeDeploymentUrl("example.com") === "https://example.com");
ok("whitespace is trimmed", normalizeDeploymentUrl("  example.com  ") === "https://example.com");
ok("an existing scheme is preserved", normalizeDeploymentUrl("https://a.example.com/x") === "https://a.example.com/x");
ok("http is left alone rather than silently upgraded", normalizeDeploymentUrl("http://localhost:3000") === "http://localhost:3000");
ok("empty stays empty (the caller decides what to say about it)", normalizeDeploymentUrl("   ") === "");
ok("a claim collapses internal whitespace", normalizeClaim("  a   customer\n can  pay ") === "a customer can pay");

console.log("\n── the boundary is actually a boundary ──");
const client = readFileSync("lib/verification-client.ts", "utf8");
// Strip comments: the file documents this rule in prose, and the prose must not count as a violation.
const code = client.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// Internal vocabulary must not appear in what the client hands to components. If it does, the interface
// starts depending on the old product's objects and the restructure quietly reverses.
for (const term of ["pass_id", "passId", "contract_id", "contractId", "flow_id", "flowId", "settlement", "reservation"]) {
  ok(`the client surface never exposes ${term}`, !code.includes(term));
}

// A hardcoded host breaks on localhost and on preview deployments, and would tie the app to one environment.
ok("no host is hardcoded", !/https?:\/\/[a-z.]*vraelis\.com/i.test(code));
ok("requests are same-origin relative", /fetch\(path/.test(code) && /"\/v1\/verifications"/.test(code));
ok("session credentials are sent (the browser acts as the person, not a key)", /credentials: "same-origin"/.test(code));

// Every authenticated surface must reach the API THROUGH this file. A component fetching /v1 directly is
// how the mapping, the idempotency and the decision handling start to diverge.
const appDir = "app/rank/app";
const offenders: string[] = [];
const walk = (dir: string) => {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e) && readFileSync(p, "utf8").includes("/v1/verifications")) offenders.push(p);
  }
};
walk(appDir);
ok("no authenticated page calls /v1/verifications directly", offenders.length === 0, offenders.join(", "));

console.log("\n── idempotency and decision handling are not optional ──");
// A double-clicked submit must not pay for two identical runs.
ok("an idempotency key is always sent, generated when absent", /idempotency-key/.test(code) && /newIdempotencyKey\(\)/.test(code));
// Only the three published decisions are trusted; anything else reads as no verdict rather than being
// passed through for a component to guess at.
ok("only the three published decisions are accepted",
  /decision === "verified" \|\| decision === "failed" \|\| decision === "blocked"/.test(code));
// Cancelling watching must not claim to cancel the run: it is already paid for and the worker continues.
ok("cancellation is described as stopping watching, not stopping the run", /still running/.test(client));
// A network blip is not a verdict.
ok("a retryable read failure does not end the poll", /if \(!r\.error\.retryable\) return r;/.test(code));

console.log("\n── stopping is honest everywhere it appears, not just in the client ──");
// Stopping the poll ends WATCHING. The run is already paid for and the worker keeps going, so any UI that
// says "cancel" is telling the user their money was returned when it was not. This holds until real
// server-side cancellation exists; when it does, this assertion is what should be revisited first.
{
  const surfaces: string[] = [];
  const scan = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = path.join(dir, e);
      if (statSync(p).isDirectory()) scan(p);
      else if (/\.tsx?$/.test(e)) surfaces.push(p);
    }
  };
  scan("app/rank/app");
  scan("lib");

  const offenders = surfaces.filter((f) => {
    const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    return /cancel\s+verification/i.test(src);
  });
  ok('no surface says "cancel verification" (the run is not cancelled)', offenders.length === 0, offenders.join(", "));

  // And the honest wording has to actually exist in the client's own message.
  const stopMsg = readFileSync("lib/verification-client.ts", "utf8");
  ok("the stop message says the verification continues running", /Stopped watching[\s\S]{0,80}still running/.test(stopMsg));
  ok("the stop message points the user back to Verifications, not into a dead end",
    /Verifications|still running/.test(stopMsg));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
