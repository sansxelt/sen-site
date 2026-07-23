// ONE public decision contract across every surface. Home, the verification result page, the public API, the
// outbound webhooks, and the CI gate must all map a run's internal (state, decision) the SAME way. This test
// fails if any of them drifts. The canonical mapping lives in lib/preflight/public-decision.ts
// (toPublicDecision); Home and the result page delegate to it through lib/preflight/home-verdict.ts. There is
// no display-only exception: a repair_verified record is Blocked in the UI exactly as it is over the API and
// webhook (a targeted repair rerun did not pass the full verification scope).
import { readFileSync } from "node:fs";
import { toPublicDecision } from "../lib/preflight/public-decision";
import { runVerdict, isActiveRun } from "../lib/preflight/home-verdict";
import { ciGate } from "../lib/preflight/ci-gate";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { if (c) { pass++; console.log(`PASS  ${n}`); } else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); } };

console.log("── the canonical mapping (the single source of truth) ──");
ok("ready on a completed run -> verified", toPublicDecision("completed", "ready") === "verified");
ok("internal blocked (confirmed critical failure) -> failed", toPublicDecision("completed", "blocked") === "failed");
ok("needs_review -> blocked", toPublicDecision("completed", "needs_review") === "blocked");
ok("repair_verified -> blocked (a targeted repair rerun is NOT a full verification)", toPublicDecision("completed", "repair_verified") === "blocked");
ok("an incomplete run -> no final public conclusion (null)", toPublicDecision("running", null) === null && toPublicDecision("queued", null) === null);

console.log("\n── the display (Home + result page) DELEGATES; it can never drift from the canonical mapping ──");
const display = (pub: string | null, state: string, decision: string | null) =>
  pub === "verified" ? "Verified" : pub === "failed" ? "Failed" : pub === "blocked" ? "Blocked"
  : isActiveRun({ state, decision }) ? "In progress" : "Not yet verified";
const STATES = ["completed", "failed", "cancelled", "running", "queued", "discovering", "analyzing", "draft"];
const DECISIONS = ["ready", "blocked", "needs_review", "repair_verified", "infra_failure", "approved", "", null];
let drift = "";
for (const s of STATES) for (const d of DECISIONS) {
  const pub = toPublicDecision(s, d as string | null);
  const got = runVerdict(s, d as string | null).label;
  const want = display(pub, s, d as string | null);
  if (got !== want) drift = `runVerdict(${s},${d})="${got}" but canonical says "${want}"`;
}
ok("for EVERY (state, decision), the display label matches the canonical public decision", !drift, drift);
ok("Home + result page render repair_verified as Blocked, never Verified", runVerdict("completed", "repair_verified").label === "Blocked");

console.log("\n── the CI gate + webhook consume the SAME canonical decision ──");
const ciCode = (d: string) => { const g = ciGate(d); return g.action === "exit" ? g.code : -1; };
ok("CI: verified -> exit 0, failed -> exit 1, blocked -> exit 2", ciCode("verified") === 0 && ciCode("failed") === 1 && ciCode("blocked") === 2);
ok("CI: a repair_verified run exits 2 (blocked), never ships", ciCode(toPublicDecision("completed", "repair_verified") ?? "blocked") === 2);

const webhook = readFileSync("lib/preflight/webhook-dispatch.ts", "utf8");
ok("the webhook maps the decision through the canonical translator (repair_verified -> blocked over the wire)",
  /toPublicDecision\(input\.runState \?\? "completed", input\.decision\) \?\? "blocked"/.test(webhook));
const shared = readFileSync("app/api/v1/verifications/_shared.ts", "utf8");
ok("the public API re-exports the canonical translator (no private copy)", /export \{ toPublicDecision.*\} from ".*public-decision"/.test(shared));

console.log("\n── home-verdict is a thin delegate, NOT a second handwritten switch ──");
const hv = readFileSync("lib/preflight/home-verdict.ts", "utf8");
ok("home-verdict imports and calls the canonical translator", /import \{ toPublicDecision \} from "\.\/public-decision"/.test(hv) && /const pub = toPublicDecision\(state, decision\)/.test(hv));
ok("home-verdict holds NO decision switch of its own", !/switch \(decision\)/.test(hv) && !/case "repair_verified"/.test(hv) && !/case "ready"/.test(hv));
ok("home-verdict does NOT reintroduce a display-only repair_verified -> Verified exception", !/repair_verified[\s\S]{0,40}Verified/.test(hv));

console.log("\n── the surfaces render through the shared delegate ──");
const rec = readFileSync("app/rank/app/_components/home-records.tsx", "utf8");
const page = readFileSync("app/rank/app/applications/[id]/passes/[runId]/page.tsx", "utf8");
ok("Home records render through runVerdict (the shared delegate)", /runVerdict\(/.test(rec) && /from "@\/lib\/preflight\/home-verdict"/.test(rec));
ok("the result page renders the conclusion through runVerdict", /runVerdict\(run\.state, run\.decision\)/.test(page));
ok("the result page never maps repair_verified to a Verified label", !/repair_verified[\s\S]{0,40}"Verified"/.test(page) && !/repair_verified[\s\S]{0,40}Verified conclusion/.test(page));

console.log("\n── the repair_verified record explains its scope honestly (Blocked, targeted repair passed) ──");
ok("the result page states the targeted repair check passed", /The targeted repair check passed/.test(page));
ok("the result page says a full critical verification is still required", /full critical verification is still required before Vraelis can return Verified/i.test(page));
ok("the result page keeps the parent record separate and unchanged", /The earlier verification it reran remains unchanged/.test(page));
ok("no surface renders the internal REPAIR VERIFIED term", !/REPAIR VERIFIED/.test(page) && !/REPAIR VERIFIED/.test(rec));

console.log("\n── EVERY authenticated surface renders repair_verified consistently (list, detail, Home, result) ──");
const list = readFileSync("app/rank/app/applications/page.tsx", "utf8");
const detail = readFileSync("app/rank/app/applications/[id]/page.tsx", "utf8");
for (const [name, src] of [["applications list", list], ["application detail", detail], ["Home records", rec], ["result page", page]] as const) {
  ok(`${name}: no retired teal repair treatment (no accent-dim/border, no #0A7B54, no TONE_REPAIR)`, !/--accent-dim|--accent-border|#0A7B54|TONE_REPAIR/.test(src));
  ok(`${name}: never labels a repair_verified record "Verified"`, !/repair_verified[\s\S]{0,60}"Verified"|repair_verified[\s\S]{0,60}label: "Verified"/.test(src));
}
ok("the list delegates its verdict pill to the canonical translator", /toPublicDecision\(run\.state, run\.decision\)/.test(list));
ok("the detail delegates its hero + pill to the canonical translator", /toPublicDecision\(state, decision\)/.test(detail) && /toPublicDecision\(latest\?\.state \?\? "completed", decision\)/.test(detail));
ok("the list pill icon comes from the public decision, not the raw internal decision (no verified-repair wrench on Blocked)", /DecisionMark decision=\{st\.mark\}/.test(list) && !/DecisionMark decision=\{run\?\.decision\}/.test(list));
ok("the detail explains the repair scope in words (targeted repair passed, full verification required)", /Targeted repair check passed\. A full critical verification is still required/.test(detail));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
