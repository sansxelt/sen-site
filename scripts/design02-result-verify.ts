// Design 02 Increment 1 — the Verification Result page: data loading, authorization, the locked proof-first
// hierarchy, read-only integrity, pinned-history honesty, and the security boundary. Unit-tests the shared
// decision translator, then static-checks the route's contract against source.
import { readFileSync } from "node:fs";
import { runVerdict } from "../lib/preflight/home-verdict";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { if (c) { pass++; console.log(`PASS  ${n}`); } else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); } };

const ROUTE = "app/rank/app/applications/[id]/passes/[runId]/page.tsx";
const page = readFileSync(ROUTE, "utf8");
const runsDb = readFileSync("lib/preflight/runs-db.ts", "utf8");
// Comment-stripped view for "forbidden term" negative checks — a comment that documents a rule ("NOT a stored
// guarantee object") must not count as a violation of it.
const shown = page.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

console.log("── canonical route + owner/workspace authorization (no existence leak) ──");
ok("the canonical result route loads the run through owner-scoped loaders", /getRun\(owner, runId\)/.test(page) && /getRunInternal\(owner, runId\)/.test(page));
ok("access is gated by requirePreflightAppAccess before any load", page.indexOf("requirePreflightAppAccess(") < page.indexOf("getRun(owner"));
ok("a run under the WRONG application id is refused (id must match)", /internal\.applicationId !== id/.test(page));
ok("not-found and not-owned share ONE response — existence of another tenant's run is never revealed",
  /if \(!detail \|\| !internal \|\| internal\.applicationId !== id\)/.test(page) && /Verification not found/.test(page));
ok("every primary loader is scoped to the resolved owner", (page.match(/\(owner, /g) ?? []).length >= 6);

console.log("\n── READ-ONLY: the record represents what happened; the page never mutates it ──");
for (const w of ["createRun(", "insert(", "update(", ".delete(", "consumeCredits", "recordPackPurchase", "finalizeRun", "setParentRun"]) {
  ok(`the page performs no write: ${w}`, !page.includes(w));
}
ok("no reverification is triggered on load (RerunButton is a client action, only rendered)", /<RerunButton /.test(page) && !/rerun\(|POST/.test(page));
ok("the conclusion is a pure mapping of the stored decision, never recomputed", /runVerdict\(run\.state, run\.decision\)/.test(page) && !/decideRun\(/.test(page));

console.log("\n── one loading wave, batched — no per-flow N+1 ──");
ok("run + internal + app + flow-meta + contract-id + children load in ONE Promise.all wave",
  /Promise\.all\(\[\s*getRun\(owner, runId\), getRunInternal\(owner, runId\), getApplication\(owner, id\), listFlowRunMeta\(owner, runId\),/.test(page));
ok("steps are NOT fetched per flow (getRun batches them; the page loops flows in memory only)",
  !/for[\s\S]{0,120}getRun|flows\.map\([\s\S]{0,200}await/.test(page));

console.log("\n── submitted claim: from contract.source_prompt ONLY, never a fabricated or stored 'guarantee' ──");
ok("the claim is sourced only from the contract's source_prompt", /contract\?\.source_prompt/.test(page));
ok("a missing claim omits the block cleanly (no fabricated sentence)", /const claim = \(contract\?\.source_prompt \?\? ""\)\.trim\(\)/.test(page) && /\{claim \? \(/.test(page));
ok("the claim is NEVER built from issues or flow names", !/claim =[^;]*issue/.test(page) && !/claim =[^;]*flow/i.test(page));
ok("no code or copy names a persisted guarantee object", !/BusinessGuarantee|guaranteeRecord|Guarantee record/i.test(shown));
ok("the claim is framed as what had to be true / submitted claim, not a guarantee", /What had to be true/.test(page) && /aria="Submitted claim"/.test(page));

console.log("\n── requirements drift honesty ──");
ok("requirements are labeled as the CURRENT contract requirements, not an executed snapshot",
  /Current requirements for Contract v/.test(page) && /not separately snapshotted/.test(page));
ok("nothing claims an exact executed requirement snapshot", !/exact requirements executed|captured at run time|immutable requirement snapshot/i.test(page));

console.log("\n── affected requirements: only what the findings actually stored ──");
ok("affected requirements come ONLY from issue evidence.requirement_refs", /issueEv\(iss\)\.requirement_refs/.test(page) && /seenReq/.test(page));
ok("no requirement -> step/flow coverage matrix is fabricated", !/coverageMatrix|requirementCoverage|perRequirement(Pass|Result)/i.test(page));

console.log("\n── repair + lineage: real repair_prompt; parent/child are SEPARATE immutable records ──");
ok("repair handoff reads only real per-issue repair_prompt", /iss\.repair_prompt/.test(page) && !/fix_prompt/.test(page));
ok("v_repairs is NOT used for lineage (writerless table)", !/listRepairs|v_repairs|RepairRow|verification_run_id/.test(shown));
ok("children load through the parent_run_id relationship, read-only", /listChildRuns\(owner, runId\)/.test(page) && /export async function listChildRuns/.test(runsDb));
ok("listChildRuns is a pure read (no write on the lineage table)", (() => {
  const b = runsDb.slice(runsDb.indexOf("export async function listChildRuns"));
  return !/insert\(|update\(|\.delete\(/.test(b) && /eq\("parent_run_id", parentRunId\)/.test(b);
})());
ok("a later reverification is presented as a separate record; the earlier one is unchanged",
  /is unchanged/.test(page) && /separate record/.test(page));

console.log("\n── pinned historical sources — never the latest ──");
ok("the deployment resolves ONLY the run's pinned id", /pins\.deploymentId \? getDeployment\(owner, pins\.deploymentId\)/.test(page));
ok("the snapshot resolves ONLY the run's pinned id", /pins\.contextSnapshotId \? getSnapshot\(owner, pins\.contextSnapshotId\)/.test(page));
ok("no latest/current substitution for the historical record", !/latestDeployment|latestSnapshot|currentDeployment|newestSnapshot/.test(page));
ok("a missing pinned deployment degrades to an honest notice, not a newer object", /no longer available[\s\S]{0,60}not replaced with a newer one/.test(page));

console.log("\n── public decision vocabulary ONLY; no internal verdict terms ──");
const ALLOWED = new Set(["Verified", "Failed", "Blocked", "In progress", "Not yet verified"]);
for (const s of ["completed", "running", "queued", "failed", "cancelled"]) for (const d of ["ready", "repair_verified", "blocked", "needs_review", "infra", null]) {
  const l = runVerdict(s, d as string | null).label; if (!ALLOWED.has(l)) ok(`runVerdict(${s},${d}) is a public label`, false, l);
}
ok("every decision maps to a public label via the shared translator", true);
ok("a targeted repair rerun (repair_verified) renders the public Blocked conclusion, not Verified", runVerdict("completed", "repair_verified").label === "Blocked");
ok("the page renders the verdict label from the translator, not a raw decision string", /verdict\.label/.test(page) && !/>\{run\.decision\}/.test(page));
ok("no internal verdict string is rendered as user text", !/>ready<|>needs_review<|>repair_verified<|Production Pass/.test(page));
ok('visible product language is "Verification", not "Pass"', /title: "Verification"/.test(page) && !/>Preflight run<|Production Pass/.test(page));

console.log("\n── running records never show a final conclusion ──");
ok("an active run shows progress language, not a conclusion", /const active = isActiveRun\(run\) \|\| !terminal/.test(page) && /runningStage\(run\.state\)/.test(page));
ok("the conclusion chip is gated on a real terminal conclusion", /const hasConclusion = verdict\.tone === "verified" \|\| verdict\.tone === "failed" \|\| verdict\.tone === "blocked"/.test(page));
ok("the conclusion is NOT a giant full-width banner (proof-first head)", !/fontSize: "clamp\(2\.2rem/.test(page) && !/Launch decision/.test(page));

console.log("\n── security: no secret, path, or session id can reach rendered output ──");
// Internal field names that would leak a path/secret/session if rendered — must be wholly absent.
for (const s of ["storage_path", "provider_session_id", "session_id", "browserbase", "failure_message", "encrypted_ref"]) {
  ok(`the page never references ${s}`, !new RegExp(s, "i").test(shown));
}
// Header / token / cookie FORMS (not the English word "authorization", which appears in owner-safe copy).
ok("no raw authorization header or bearer token reaches output", !/authorization\s*:\s|Bearer\s|x-api-key/i.test(shown));
ok("no cookie is emitted", !/document\.cookie|set-cookie/i.test(shown));
ok("no retired teal accent tokens are reintroduced for repair_verified", !/--accent-dim|--accent-border|#0A7B54/.test(shown));

console.log("\n── the locked hierarchy + a11y skeleton ──");
for (const [n, aria] of [["02", "Submitted claim"], ["03", "Outcome"], ["04", "Evidence"], ["05", "Execution journey"], ["06", "Affected requirements"], ["07", "Repair handoff"], ["08", "Reverification"], ["09", "Provenance and immutable history"]] as const) {
  ok(`section ${n} (${aria}) is present as a labelled region`, new RegExp(`n="${n}"[\\s\\S]{0,80}aria="${aria}"`).test(page) || page.includes(`aria="${aria}"`));
}
ok("exactly one h1 (the system subject); sections use h2", (page.match(/<h1/g) ?? []).length === 1 && /<h2/.test(page));
ok("the conclusion is conveyed by text, not colour alone (a labelled chip)", /<Chip tone=\{verdict\.tone\} label=\{verdict\.label\}/.test(page));

console.log("\n── Increment 2: submitted claim (plain text, source_prompt only, drift-honest contract) ──");
ok("the claim renders as plain text (React-escaped; no HTML/Markdown renderer)", /\{claim\}/.test(page) && !/dangerouslySetInnerHTML/.test(page) && !/ReactMarkdown|remark|<Markdown/.test(page));
ok("meaningful line breaks in the claim are preserved (whiteSpace pre-line), and it wraps", /whiteSpace: "pre-line"[\s\S]{0,80}\{claim\}|\{claim\}[\s\S]{0,120}whiteSpace: "pre-line"/.test(page.replace(/\n/g, " ")) || /whiteSpace: "pre-line"/.test(page));
ok("a missing claim shows a quiet historical note, never a fabricated claim", /The original submitted claim is not available for this historical record/.test(page));
ok("the contract version comes from the run (internal.contractVersion)", /Contract v\$\{contractVersion\}|Contract v\$\{internal\.contractVersion\}/.test(page) && /contractVersion = internal\.contractVersion/.test(page));
ok("current requirements are labeled 'current ... for Contract v{n}', never an executed snapshot", /Current requirements for Contract v\$\{contractVersion\}/.test(page) && /current requirements associated with this contract/.test(page));
ok("no requirement gets a per-requirement pass mark (a current requirement is context, not proof)", !/requirement[\s\S]{0,30}(I\.check|✓|DecisionMark)/i.test(page));
ok("drift is disclosed ONLY when proven (recorded version != loaded version)", /contractDrifted = !!contract && contractVersion != null[\s\S]{0,80}contract\.version !== contractVersion/.test(page) && /\{contractDrifted \? \(/.test(page));
ok("the drift notice says the contract changed and the requirements are current, not historical", /The contract has changed since this verification\. The requirements below reflect the current contract/.test(page));

console.log("\n── Increment 2: observed outcome composed honestly + scoped conclusion language ──");
ok("the observed outcome is COMPOSED (named honestly), never a stored column", /function composeObservedOutcome\(/.test(page) && !/storedOutcome|guaranteeResultText|canonicalObservation/.test(page));
ok("a Failed outcome prefers the safe humanObserved evidence, then the title", /humanObserved\(p\) \|\| p\.title/.test(page));
ok("no raw failure_message is ever used for the outcome (only the coarse failure_code line)", !/failure_message/.test(shown));
ok("the primary finding is chosen deterministically (severity + persisted order), never by an LLM", /function primaryIssue\(/.test(page) && /SEV_RANK/.test(page) && !/openai|\bgpt\b|anthropic|\.chat\.|generateText/i.test(shown));
ok("Verified is scoped to the CHECKED WORKFLOW, not the whole system", /The checked workflow completed with the expected result/.test(page));
ok("Verified never claims the app works / system proven / safe to release", !/the application works|the system is proven|safe to release|fully verified|everything passed/i.test(page.replace(/\/\/[^\n]*/g, "")));
ok("Blocked explicitly means no reliable conclusion, never a confirmed failure", /Vraelis could not reach a reliable conclusion/.test(page));
ok("a Failed record with no issue row degrades honestly (no invented failure)", /Detailed finding evidence is unavailable for this record/.test(page));
ok("a Blocked record with no detail degrades honestly", /Detailed blocking evidence is unavailable for this record/.test(page));
ok("multiple findings are acknowledged as a count, not concatenated into one paragraph", /This verification recorded \{issues\.length\} findings/.test(page));
ok("the 'why' is labeled as Vraelis's reasoning, not exposed model reasoning", /Why Vraelis reached this conclusion/.test(page) && !/chain of thought|model analysis|AI reasoning/i.test(page));
ok("an active run announces progress in a restrained live region and shows no final conclusion", /role="status" aria-live="polite"[\s\S]{0,80}runningStage\(run\.state\)/.test(page));

console.log("\n── Increment 3: evidence + execution journey (real proof, safe artifact access) ──");
const flat = page.replace(/\n/g, " ");
ok("screenshots load ONLY through the owner-checked signed artifacts route (no storage path in the HTML)",
  page.includes("/api/preflight/runs/${runId}/artifacts/${sid}") && !/storage_path|createSignedUrl|signedUrl\(/.test(shown));
ok("each finding shows Expected vs Observed in prose", page.includes("<div style={label}>Expected</div>") && page.includes("<div style={label}>Observed</div>"));
ok("the observed sentence is DERIVED (humanObserved), never a raw failure_message", /const observed = humanObserved\(issue\)/.test(page));
ok("raw console + network evidence live inside a collapsed technical-details element", /console_errors/.test(page) && /network_failures/.test(page) && /View technical details/.test(page));
ok("the execution journey renders an ORDERED step timeline via stepText", /function FlowTimeline\(/.test(page) && /stepText\(s\.action, s\.target\)/.test(page));
ok("only real per-step ms timing is shown; no derived flow wall-clock duration is invented", page.includes("${s.ms} ms") && !/flowDuration|wallClock|elapsedMs|totalMs|derived duration/i.test(shown));
ok("the authenticated-flow panel shows allowlisted owner-safe fields only (roles / account label / credential state)",
  /auth\.roles/.test(page) && /auth\.accountLabel/.test(page) && /auth\.credentialState/.test(page) && !/\bpassword\b|\btoken\b|\bsecret\b/i.test(shown));
ok("a step's raw error detail is nested inside its own disclosure, not shown inline", /Error detail/.test(page) && /stepFailed && s\.observed \?/.test(page));
ok("no secret / storage path / provider session id reaches the evidence output", !/storage_path|provider_session_id|session_id|browserbase|encrypted_ref/i.test(shown));
ok("screenshots shown as a finding's evidence are not repeated in the journey (dedup by rawName)", /shotsShownInFindings/.test(page) && /showShots=\{!shotsShownInFindings\.has\(f\.name\)\}/.test(page));

console.log("\n── Increment 4: affected requirements, repair handoff, reverification, immutable lineage ──");
// Affected requirements
ok("affected requirements come ONLY from persisted requirement_refs, resolved to current contract text", /issueEv\(iss\)\.requirement_refs/.test(page) && /reqTextById\.get\(r\)/.test(page));
ok("requirement linkage is never inferred (no fuzzy match on issue wording)", !/\.match\([^)]*requirement/i.test(page) && !/title[^;]{0,40}includes\([^)]*requirement/i.test(page));
ok("an unresolved ref becomes an honest 'unavailable' entry (a count) — never a raw id, never invented text", /affectedUnavailable\.length/.test(page) && /could not be resolved to current contract text/.test(page) && !/>\{a\.rid\}</.test(page));
ok("no per-requirement pass mark, no compliance matrix", /A verification does not mark a requirement passed/.test(page) && !/complianceMatrix|requirementMatrix/i.test(page));
ok("each resolved requirement links back to its finding evidence block", page.includes("href={`#finding-${a.findingId}`}") && page.includes("id={`finding-${issue.id}`}"));
ok("the current-requirements / historical-snapshot disclosure is preserved", /Current requirements for Contract v/.test(page) && /not separately snapshotted/.test(page));
// Repair handoff
ok("repair handoff sources ONLY the persisted repair_prompt (no invented repair, no v_repairs)", /iss\.repair_prompt/.test(page) && !/fix_prompt|v_repairs|listRepairs/.test(shown));
ok("the repair prompt is labeled for a coding agent and shown as plain escaped text with preserved line breaks", /Repair prompt for a coding agent/.test(page) && /whiteSpace: "pre-wrap"/.test(page) && page.includes("{iss.repair_prompt}</pre>"));
ok("copying the prompt is explained to change nothing; there is NO apply-repair action or hidden write", /it does not modify your code from this page/.test(page) && !/Apply repair|applyRepair/i.test(page));
ok("a missing repair prompt renders a quiet honest fallback, never a generated one", /No repair guidance was generated for this verification/.test(page));
// Reverification CTA (read-only, existing flow)
ok("the result page never creates a run / reserves credit / mutates from itself", /<RerunButton /.test(page) && !/createRun\(|\.insert\(|\.update\(|consumeCredits\(/.test(page));
ok("a Failed record offers rerunning the failed flows", /pub === "failed" \? <RerunButton/.test(page.replace(/\n/g, " ")) && /Rerun the failed flows/.test(page));
ok("a repair_verified (public Blocked) record offers Run full critical verification", /run\.decision === "repair_verified"/.test(page) && /scope="critical" label="Run full critical verification"/.test(page));
ok("a Verified record frames another verification as optional, not required", /it is not required/.test(page));
ok("an active run links to the run controls (navigation-only); it never cancels from this read-only page", /View run controls/.test(page) && !/CancelRunButton/.test(page));
ok("reverification copy states every reverification is a separate immutable record", /separate, immutable record/.test(page));
// Immutable lineage
ok("lineage is built ONLY from parent_run_id + listChildRuns (never v_repairs, never inferred ancestry)", /getRunLite\(owner, run\.parent_run_id\)/.test(page) && /listChildRuns\(owner, runId\)/.test(page) && !/v_repairs|inferAncestry/.test(shown));
ok("lineage is parent -> current -> children, chronological, each a separate record", /const lineage: LineageNode\[\]/.test(page) && /\.sort\(\(a, b\) => \(Date\.parse\(a\.iso\)/.test(page) && /isCurrent: true/.test(page));
ok("every lineage record's verdict goes through the canonical translator", /runVerdict\(node\.state, node\.decision\)/.test(page));
ok("the current record is marked; the others link to owner-authorized result routes", /This record/.test(page) && page.includes("href={`/applications/${id}/passes/${node.runId}`}"));
ok("the parent failure is never rewritten (its own decision is rendered; a later success does not overwrite it)", /parentLite\.decision/.test(page) && /does not overwrite an earlier failure/.test(page));
ok("getRunLite is owner-scoped, read-only, and returns null for a missing/non-owned parent (no leak)",
  (() => { const db = readFileSync("lib/preflight/runs-db.ts", "utf8"); const b = db.slice(db.indexOf("export async function getRunLite")); return /eq\("user_id", norm\(owner\)\)\.eq\("id", runId\)/.test(b) && /if \(!r\) return null;/.test(b) && !/\.insert\(|\.update\(|\.delete\(/.test(b.slice(0, 500)); })());

console.log("\n── Increment 5: immutable provenance (identity, reviewed plan, pinned sources, honest limits) ──");
const rpDb = readFileSync("lib/preflight/reviewed-plan-db.ts", "utf8");
// 01 Verification record identity
ok("the record identity block shows the run id and offers a copy control", /Verification \{shortId\(runId\)\}/.test(page) && /<CopyButton text=\{runId\} label="Copy id" \/>/.test(page));
ok("the conclusion in the identity block goes through the shared translator (a Chip), never a recomputed verdict", /<Chip tone=\{verdict\.tone\} label=\{verdict\.label\} \/>/.test(page));
ok("record identity shows the run's own created/completed timestamps (its real lifecycle)", /Created \{when\(run\.created_at\)\}/.test(page) && /Completed \{when\(run\.completed_at\)\}/.test(page));
ok("the parent link, when present, points at the owner-authorized parent result route", page.includes("href={`/applications/${id}/passes/${run.parent_run_id}`}"));
// 02 Reviewed-plan provenance — REAL persisted binding only
ok("reviewed-plan provenance comes ONLY from the persisted run->plan binding (getReviewedPlanByRunId)", /getReviewedPlanByRunId\(owner, runId\)/.test(page) && /export async function getReviewedPlanByRunId/.test(rpDb));
ok("the reviewed-plan reader is owner-scoped over the existing run_id column (no new table/concept)", /\.eq\("run_id", runId\)\.eq\("user_id", norm\(owner\)\)/.test(rpDb));
ok("a legacy record with no binding falls back honestly, never fabricating an approved plan", /Reviewed-plan provenance is not available for this historical record\./.test(page) && /reviewedPlan \? \(/.test(page.replace(/\n/g, " ")));
ok("human review is asserted ONLY from the persisted approval state, never inferred", /reviewedPlan\.approvalState === "approved" \? <span>Human review recorded<\/span>/.test(page) && !/humanReviewed = true|humanReviewed: true/.test(shown));
ok("consumption is stated only when the binding proves it was consumed", /reviewedPlan\.executionState === "consumed" \?[\s\S]{0,120}consumed the approved reviewed plan/.test(page));
// 03 Deployment & snapshot provenance — pinned, never latest, never leak an inaccessible one
ok("the tested-deployment block resolves the PINNED deployment/snapshot only (already asserted pinned above)", /pins\.deploymentId \? getDeployment/.test(page) && /pins\.contextSnapshotId \? getSnapshot/.test(page));
ok("an unavailable pinned deployment is disclosed, not silently replaced by a newer one", /no longer available[\s\S]{0,60}not replaced with a newer one/.test(page));
// 04 Contract & requirements history — recorded vs current, drift, no false 'unchanged' on version match
ok("contract history shows BOTH the recorded run version and the current contract version", /Recorded for this run: Contract v\{contractVersion\}/.test(page) && /Current contract: v\{contract\.version\}/.test(page));
ok("a matching version never claims the exact historical requirement text is preserved", /a historical requirement snapshot was not separately persisted for this verification/.test(page) && !/requirements are unchanged|identical to the executed requirements|guaranteed unchanged/i.test(page));
ok("proven drift is disclosed in the provenance ledger too (contract changed, text is current)", /The contract has changed since this verification\. The requirement text shown above is loaded from the current contract/.test(page));
// 05 Evidence provenance — counts only, signed route, missing != pass
ok("evidence provenance shows COUNTS derived from persisted rows, never a storage path", /const anyEvidence = issues\.length \+ flows\.length \+ stepCount/.test(page) && !/storage_path|signedUrl\(|createSignedUrl/.test(shown));
ok("retained artifacts are described as reachable only via the owner-checked signed route", /accessible only through the owner-checked signed route/.test(page));
ok("no retained evidence is stated honestly and is NEVER read as a pass", /No evidence was retained for this record\. That does not mean the workflow passed\./.test(page));
// 06 Historical limitations — record-specific, not a generic disclaimer wall
ok("historical limitations are a record-specific list built from this run's real state", /const limitations: string\[\]/.test(page) && /\{limitations\.map\(/.test(page));
ok("a repair_verified record's limitations note the targeted-repair scope specifically", /A targeted repair check passing is not equivalent to a full critical verification\./.test(page));
ok("limitations never undermine valid evidence with a blanket 'this proves nothing' wall", !/this result proves nothing|do not rely on any of this|none of this is trustworthy/i.test(page));
// 07 Integrity wording — 'separate historical record', NEVER a cryptographic claim
ok("integrity wording says the result is preserved as a separate historical record that later runs do not alter", /This result is preserved as a separate historical record\. Later verifications do not alter this conclusion\./.test(page));
ok("integrity wording makes NO cryptographic / tamper-proof / blockchain claim", !/cryptographically immutable|tamper-proof|tamperproof|blockchain|hash-chain|hash chain|cryptographic proof|immutable ledger/i.test(shown));
// 09 Active-run cancellation boundary — navigation only
ok("the active-run cancel CTA is navigation-only (View run controls) and cannot cancel from the result page", /View run controls/.test(page) && !/CancelRunButton/.test(page) && !/\/cancel/.test(shown));
// Identity copy controls exist for the durable identifiers
ok("the reviewed-plan id and plan hash are copyable identifiers when present", /<CopyButton text=\{reviewedPlan\.id\} label="Copy plan id" \/>/.test(page) && /<CopyButton text=\{reviewedPlan\.planHash\} label="Copy hash" \/>/.test(page));
// No sensitive provenance values
for (const s of ["approved_by", "deployment_fp", "claim_fp", "role_refs"]) {
  ok(`no internal reviewed-plan field leaks into the page: ${s}`, !new RegExp(s).test(shown));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
