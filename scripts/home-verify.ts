// Design 01 Increment 4 — the authenticated Home operational surface.
//
// Two halves. First, real UNIT tests of the pure verdict/proof logic (no Next runtime), because the single
// most important guarantee is that no run state can ever produce a label outside the public vocabulary, and
// that an unverified system is never called Failed or Blocked. Second, static checks that the page wires only
// real, owner-scoped, workspace-consistent data through the current contracts and links only to routes that
// exist — the properties that are structural, not per-value.
import { readFileSync } from "node:fs";
import { isActiveRun, runVerdict, systemProof, runningStage, timeAgo } from "../lib/preflight/home-verdict";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { if (c) { pass++; console.log(`PASS  ${n}`); } else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); } };

const page = readFileSync("app/rank/app/page.tsx", "utf8");
const rec = readFileSync("app/rank/app/_components/home-records.tsx", "utf8");

console.log("── the only labels are the public vocabulary; an internal decision string can never leak ──");
const ALLOWED = new Set(["Verified", "Failed", "Blocked", "In progress", "Not yet verified"]);
const DECISIONS = ["ready", "repair_verified", "blocked", "needs_review", "infra_failure", "cancelled", "approved", "weird_future", "", null];
const STATES = ["completed", "failed", "cancelled", "running", "queued", "discovering", "analyzing", "draft"];
let leaked = "";
for (const s of STATES) for (const d of DECISIONS) { const l = runVerdict(s, d as string | null).label; if (!ALLOWED.has(l)) leaked = `runVerdict(${s},${d})=${l}`; }
ok("every (state, decision) maps to a public label, never an internal term", !leaked, leaked);
for (const s of STATES) { const l = systemProof(s === "x" ? null : { state: s, decision: null }).verdict.label; if (!ALLOWED.has(l)) leaked = `systemProof(${s})=${l}`; }
ok("systemProof also only ever yields a public label", !leaked, leaked);
ok("no internal verdict term is in the allowed set", !["READY", "NEEDS REVIEW", "REPAIR VERIFIED", "needs_review", "repair_verified"].some((t) => ALLOWED.has(t)));

console.log("\n── the verdict mapping is faithful to the run's real (state, decision) ──");
ok("ready -> Verified", runVerdict("completed", "ready").label === "Verified");
ok("repair_verified -> Blocked (a targeted repair rerun is not the full verification; one contract with the API/webhook)", runVerdict("completed", "repair_verified").label === "Blocked");
ok("blocked -> Failed (a real critical failure)", runVerdict("completed", "blocked").label === "Failed");
ok("needs_review -> Blocked (no reliable conclusion)", runVerdict("completed", "needs_review").label === "Blocked");
ok("a completed infra failure -> Blocked (not a false pass, not a false alarm)", runVerdict("completed", "infra_failure").label === "Blocked");
ok("a running verification -> In progress, never a premature verdict", runVerdict("running", null).label === "In progress" && runVerdict("queued", null).label === "In progress");
ok("a completed run with no recognized decision -> Blocked (the canonical translator's honest third answer)", runVerdict("completed", null).label === "Blocked");
ok("a non-terminal run with no decision -> In progress; an unknown non-terminal state -> Not yet verified", runVerdict("running", null).label === "In progress" && runVerdict("draft", null).label === "Not yet verified");

console.log("\n── an unverified system is NEVER labelled Failed or Blocked ──");
ok("a system with no verification -> Not yet verified, needs proof", systemProof(null).verdict.label === "Not yet verified" && systemProof(null).needsProof === true);
ok("a system with no run is not called Failed or Blocked", !["Failed", "Blocked"].includes(systemProof(null).verdict.label));
ok("a failed system needs proof and reads Failed (real conclusion)", systemProof({ state: "completed", decision: "blocked" }).needsProof === true && systemProof({ state: "completed", decision: "blocked" }).verdict.label === "Failed");
ok("a needs_review system needs proof and reads Blocked", systemProof({ state: "completed", decision: "needs_review" }).needsProof === true && systemProof({ state: "completed", decision: "needs_review" }).verdict.label === "Blocked");
ok("a verified system does not need proof", systemProof({ state: "completed", decision: "ready" }).needsProof === false);
ok("a running system is In progress and not flagged as needing proof", systemProof({ state: "running", decision: null }).verdict.label === "In progress" && systemProof({ state: "running", decision: null }).needsProof === false);

console.log("\n── in-flight detection + honest progress language ──");
ok("a queued/running run with no decision is active", isActiveRun({ state: "running", decision: null }) && isActiveRun({ state: "queued", decision: null }));
ok("a run WITH a decision is not active (a verdict exists)", !isActiveRun({ state: "running", decision: "ready" }));
ok("a completed run with no decision is not active", !isActiveRun({ state: "completed", decision: null }));
ok("progress language is derived from persisted state", runningStage("queued") === "Queued for verification" && runningStage("running") === "Checking the deployed workflow" && runningStage("analyzing") === "Finalizing the verification");
ok("an unknown state falls back to a general running phrase, not an invented step", runningStage("some_future_state") === "Verifying");
ok("timeAgo buckets a fixed offset relative to a passed clock (deterministic)", timeAgo(new Date(1000).toISOString(), 1000 + 5 * 60_000) === "5m ago" && timeAgo(null) === "");

console.log("\n── Home reads only real, owner-scoped data through the current contracts ──");
ok("Home is server-rendered per request (a workspace switch always re-reads fresh state)", /export const dynamic = "force-dynamic"/.test(page));
ok("Home is a server component (no client record cache that could go stale across a switch)", !/"use client"/.test(page));
ok("runs are read owner-scoped via the current lister", /listAllRuns\(owner, \d+\)/.test(page));
ok("issues are read WEB-scoped so the attention list and the badges count the same population", /listAllIssues\(owner, \{ status: "open", webOnly: true/.test(page));
ok("counts come from the real owner overview, not an invented metric", /overviewCounts\(owner\)/.test(page));
ok("systems come from the member-aware application lister", /listApplicationsForMember\(email\)/.test(page));
ok("balance/plan stay per-individual (owner-anchored), not re-keyed by workspace", /balance\(email\), getPlan\(email\)/.test(page));
ok("no data source is a hardcoded mock or example array", !/const (MOCK|SAMPLE|FAKE|EXAMPLE)/i.test(page));

console.log("\n── the composer stays primary; a section failure cannot take it down ──");
ok("the composer renders unconditionally, outside the empty/sections branch", page.indexOf("<Composer balance={bal} />") < page.indexOf("fullyEmpty ? ("));
ok("record groups are loaded with independent failure isolation", /async function settle</.test(page) && (page.match(/settle\(/g) ?? []).length >= 4);
ok("a caught load error is swallowed to a safe fallback, never surfaced raw", /catch \{ return \{ value: fallback, error: true \}; \}/.test(page));
ok("each section takes an error flag and renders a degraded state, not a crash", /error=\{issuesR\.error\}/.test(page) && /error=\{runsR\.error\}/.test(page) && /error=\{countsR\.error\}/.test(page) && /error=\{appsR\.error \|\| latestR\.error\}/.test(page));
ok("the degraded state is plain language with a keyboard-reachable retry, no raw server text", /function SectionError/.test(rec) && /Reload/.test(rec) && !/error\.message/.test(rec) && !/error\.message/.test(page));

console.log("\n── empty account shows deliberate onboarding, not fake records ──");
ok("fully-empty is only true when nothing failed to load (a failure is degraded, not empty)", /const fullyEmpty = !anyError &&/.test(page));
ok("the empty account renders the onboarding workflow", /<EmptyHome \/>/.test(page) && /export function EmptyHome/.test(rec));
ok("onboarding explains the real four-step workflow", /Name the deployed build/.test(rec) && /State what must be true/.test(rec) && /Review the proof plan/.test(rec) && /Run the verification/.test(rec));
ok("empty sections collapse to null rather than showing empty shells", /if \(!issues\.length\) return null;/.test(rec) && /if \(!rows\.length\) return null;/.test(rec) && /if \(!systems\.length\) return null;/.test(rec));

console.log("\n── every action resolves to a CURRENT route by stable id, never a name or a retired path ──");
ok("a recent record links to the current result route by id", rec.includes("`/applications/${run.applicationId}/passes/${run.id}`"));
ok("a running record links to the current result route by id", rec.includes("`/applications/${r.applicationId}/passes/${r.id}`"));
ok("a system links to the current system detail route by id", rec.includes("`/applications/${s.id}`"));
ok("an attention item links to the current issues route by id", rec.includes("`/applications/${iss.applicationId}/issues`"));
ok("links use stable ids, not display names", !/href=\{`\/applications\/\$\{[a-z]*\.applicationName/.test(rec));
ok("no retired /app/apps path is linked", !rec.includes("/app/" + "apps") && !page.includes("/app/" + "apps"));
ok("no link points at a not-yet-built Design 02-04 route", !/\/results\//.test(rec) && !/\/dashboard/.test(rec));

console.log("\n── the record leads with the system + summary; the verdict is supporting, not the whole row ──");
const recRow = rec.slice(rec.indexOf("function VerificationRecordRow"), rec.indexOf("export function RecentVerifications"));
ok("the record row shows the system name before the verdict pill", recRow.indexOf("run.applicationName") < recRow.indexOf("<VerdictPill"));
ok("the record row carries a deployment reference and flow summary, not just a status", /DeploymentReference url=\{run\.deploymentUrl\}/.test(recRow) && /flows/.test(recRow));
const runBody = rec.slice(rec.indexOf("export function RunningWork"), rec.indexOf("// ── Recent verifications"));
ok("a running row shows progress language, not a verdict pill", /runningStage\(r\.state\)/.test(runBody) && !/VerdictPill/.test(runBody));
ok("attention rows carry the observational issue title as the primary text", /iss\.title \|\| "A blocking issue needs attention"/.test(rec));

console.log("\n── record rows keep meaning on mobile: system, deployment, and a next action ──");
ok("recent, running, and systems rows each render a deployment reference", (rec.match(/<DeploymentReference/g) ?? []).length >= 3);
ok("every row is itself the next action (a single link), not an ambiguous multi-target region", /export function VerificationRecordRow/.test(rec) && /<Link/.test(recRow));
ok("rows have accessible names combining system + outcome, not color alone", /aria-label=\{`\$\{run\.applicationName/.test(rec) && /aria-label=\{`\$\{s\.name/.test(rec));

console.log("\n── no forbidden vocabulary anywhere on the surface ──");
for (const [f, name] of [[page, "page.tsx"], [rec, "home-records.tsx"]] as const) {
  // Strip line comments so a comment that documents the ban ("no 'Production Pass'") does not count as usage.
  const shown = f.replace(/\/\/[^\n]*/g, "");
  ok(`${name} never renders "Production Pass"`, !shown.includes("Production Pass"));
  ok(`${name} renders no internal verdict label`, !/>READY</.test(f) && !/>NEEDS REVIEW</.test(f) && !/>REPAIR VERIFIED</.test(f));
}
ok("Home does not fabricate reviewed-plan attention rows it cannot back (no owner-wide plan lister exists)",
  !/listReviewedPlans|reviewedPlansForOwner|pendingPlans/i.test(page) && !/listReviewedPlans|reviewedPlansForOwner|pendingPlans/i.test(rec));
ok("Home reads no per-app deployment records (would be an N+1; proof-state comes from the run decision)",
  !/latestDeployment|listDeployments|unverifiedNewerDeployment/.test(page) && !/latestDeployment|listDeployments|unverifiedNewerDeployment/.test(rec));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
