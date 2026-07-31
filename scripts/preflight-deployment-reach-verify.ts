// The launch-time reachability gate: what refuses a run, and everything that must NOT.
//
// This gate sits above the credit hold AND above the free-pass claim, so it is the one check that can refuse
// a launch before any value moves. That makes its failure modes asymmetric:
//
//   too permissive  a typo'd URL gets charged and returns BLOCKED about nothing. Recoverable, refundable,
//                   and exactly what happened: a run against my-safe-note.loveable.app (one letter off)
//                   cost $15 to report that a domain does not exist.
//   too strict      a real customer with a slow, redirecting, 404-at-root or briefly-flapping deployment
//                   cannot launch at all, and the product looks broken for people who did nothing wrong.
//
// The second is worse, so the gate answers one narrow question — does the hostname resolve — and treats
// EVERYTHING else as reachable. These assertions exist to keep it that narrow.
import { classifyReach, REACH_TIMEOUT_MS } from "../lib/preflight/deployment-reach";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

console.log("── only a definitive DNS answer refuses ──");
ok("an unresolved host refuses the launch", classifyReach({ blockedReason: "unresolved_host" }) === "unresolved");

console.log("\n── every status a real deployment can answer is reachable ──");
for (const code of [200, 204, 301, 302, 401, 403, 404, 410, 429, 500, 502, 503]) {
  ok(`HTTP ${code} is reachable`, classifyReach({ httpStatus: code }) === "reachable");
}

console.log("\n── ambiguity always favours the customer ──");
ok("a timeout does not refuse", classifyReach({ errored: true }) === "reachable");
ok("a TLS or socket error does not refuse", classifyReach({ blockedReason: null, errored: true }) === "reachable");
ok("an unknown blocked reason does not refuse", classifyReach({ blockedReason: "blocked", errored: true }) === "reachable");
// These are safety refusals that other validation already owns (unsafeHttpsUrlReason at connect time). If
// this gate started refusing them too it would be enforcing URL policy in a second place, which is how two
// copies of a rule drift apart.
ok("a private-address rejection is not this gate's refusal", classifyReach({ blockedReason: "private_address", errored: true }) === "reachable");
ok("a metadata-endpoint rejection is not this gate's refusal", classifyReach({ blockedReason: "metadata_endpoint", errored: true }) === "reachable");
ok("an unsupported scheme is not this gate's refusal", classifyReach({ blockedReason: "unsupported_scheme", errored: true }) === "reachable");

console.log("\n── it cannot become a slow gate in front of a button ──");
ok("the probe timeout stays short", REACH_TIMEOUT_MS > 0 && REACH_TIMEOUT_MS <= 5000, `${REACH_TIMEOUT_MS}ms`);

console.log("\n── the gate runs before anything is spent ──");
{
  const src = require("node:fs").readFileSync("lib/preflight/acceptance/accept-run.ts", "utf8") as string;
  const probeAt = src.indexOf("probeDeployment(deploymentUrl)");
  const holdAt = src.indexOf("await hold(owner, reservationId");
  const claimAt = src.indexOf("claimFreePass(owner");
  ok("the probe precedes the credit hold", probeAt > 0 && holdAt > 0 && probeAt < holdAt);
  // The free pass is the sharper failure: money can be refunded, a spent lifetime pass cannot.
  ok("the probe precedes the free-pass claim", probeAt > 0 && claimAt > 0 && probeAt < claimAt);
  ok("its refusal says nothing was charged", /deployment_unreachable[\s\S]{0,400}Nothing was charged/.test(src));
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exitCode = fail ? 1 : 0;
