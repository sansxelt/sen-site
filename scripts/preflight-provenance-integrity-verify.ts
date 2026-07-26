// PROVENANCE INTEGRITY: the ratchet that keeps "approved" meaning a recorded human decision.
//
// The defect this suite exists to prevent was not a bug in a function. It was an ABSENCE: one insert helper
// that did not mention `origin` or `review_state`, two column defaults that filled them in with 'user' and
// 'approved', and 136 production rows that consequently claimed a person had authored and approved content
// a model wrote. Nothing was ever asserted, so nothing ever failed.
//
// So this checks the absence. Half of it is behavioural (run the pure functions, assert what they decide);
// half is a real AST walk over the source, because "no writer relies on a database default" is a property of
// the code's SHAPE and cannot be expressed as a unit test of any single function.
//
// The AST half uses the TypeScript compiler, not regular expressions, specifically so it cannot be fooled by
// an import alias, a namespace import, a re-export, or a mention inside a comment. The previous provenance
// suite asserted a literal source line and went red the moment that line was reworded while remaining
// correct; a checker that breaks on rewording trains people to edit the checker.
import * as ts from "typescript";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import { requirementReviewIdentity, planMerge, fingerprint, type MergeReq } from "../lib/preflight/contract-merge";
import { PROVENANCE_SOURCES, normalizeProvenanceSource } from "../lib/preflight/discover-synthesis";
import { requirementOrderIsComplete, contractApprovalReadiness, type ContractRequirement } from "../lib/v-applications";
import { reviewStateLabel, reviewBasisLabel } from "../app/rank/app/applications/[id]/contract/labels";

const ROOT = process.cwd();
let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? `  (${detail})` : ""}`); }
}
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

// ── AST helpers ────────────────────────────────────────────────────────────────────────────────────────
function parse(rel: string): ts.SourceFile {
  return ts.createSourceFile(rel, read(rel), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

/**
 * Every LOCAL name in `file` that ultimately refers to `exported` from a module whose specifier contains
 * `moduleHint`. Resolves plain imports, `as` aliases, namespace imports (recording `ns.exported`), and
 * re-exports, so renaming an import at the call site cannot slip past a check.
 */
function localNamesFor(sf: ts.SourceFile, exported: string, moduleHint: string): Set<string> {
  const names = new Set<string>();
  sf.forEachChild((node) => {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return;
    if (!node.moduleSpecifier.text.includes(moduleHint)) return;
    const clause = node.importClause;
    if (!clause) return;
    const b = clause.namedBindings;
    if (b && ts.isNamespaceImport(b)) names.add(`${b.name.text}.${exported}`);
    if (b && ts.isNamedImports(b)) {
      for (const el of b.elements) {
        const original = el.propertyName?.text ?? el.name.text;
        if (original === exported) names.add(el.name.text);
      }
    }
  });
  return names;
}

/** Does this file contain a call to any of `names` (supporting `ns.fn` member calls)? */
function callsAny(sf: ts.SourceFile, names: Set<string>): boolean {
  let found = false;
  const visit = (n: ts.Node) => {
    if (found) return;
    if (ts.isCallExpression(n)) {
      const e = n.expression;
      const text = ts.isIdentifier(e) ? e.text
        : ts.isPropertyAccessExpression(e) ? `${e.expression.getText()}.${e.name.text}`
          : "";
      if (names.has(text)) { found = true; return; }
    }
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(sf, visit);
  return found;
}

/** Every `.from("<table>")` chained to a writing method, with the object-literal properties supplied. */
type TableWrite = { table: string; method: string; props: Set<string>; spreads: number; line: number };
function tableWrites(sf: ts.SourceFile): TableWrite[] {
  const out: TableWrite[] = [];
  const WRITES = new Set(["insert", "upsert", "update", "delete"]);
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && WRITES.has(n.expression.name.text)) {
      // Walk back down the chain to find `.from("table")`.
      let cur: ts.Node = n.expression.expression;
      let table = "";
      while (ts.isCallExpression(cur) || ts.isPropertyAccessExpression(cur)) {
        if (ts.isCallExpression(cur) && ts.isPropertyAccessExpression(cur.expression)
          && cur.expression.name.text === "from" && cur.arguments.length
          && ts.isStringLiteralLike(cur.arguments[0])) {
          table = (cur.arguments[0] as ts.StringLiteralLike).text;
          break;
        }
        cur = ts.isCallExpression(cur) ? cur.expression : cur.expression;
      }
      if (table) {
        const props = new Set<string>();
        let spreads = 0;
        const arg = n.arguments[0];
        // `.insert({...} as never)` is the house style, so unwrap assertions before reading properties.
        const unwrap = (x: ts.Node | undefined): ts.Node | undefined =>
          x && (ts.isAsExpression(x) || ts.isTypeAssertionExpression(x) || ts.isParenthesizedExpression(x))
            ? unwrap(x.expression) : x;
        const lit = unwrap(arg);
        if (lit && ts.isObjectLiteralExpression(lit)) {
          for (const p of lit.properties) {
            if (ts.isSpreadAssignment(p)) { spreads++; continue; }
            const name = p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : "";
            if (name) props.add(name);
          }
        }
        out.push({
          table, method: n.expression.name.text, props, spreads,
          line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
        });
      }
    }
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(sf, visit);
  return out;
}

// ══ 1. VOCABULARY ═══════════════════════════════════════════════════════════════════════════════════════
console.log("\n── vocabulary ──");

const mergeSrc = read("lib/preflight/contract-merge.ts");
ok("review_state keeps the semantic lifecycle and nothing more",
  /ReqState\s*=\s*"suggested"\s*\|\s*"approved"\s*\|\s*"rejected"\s*\|\s*"archived"/.test(mergeSrc));
ok("there is NO auto_approved review state anywhere in lib",
  !/["']auto_approved["']/.test(mergeSrc) && !/["']auto_approved["']/.test(read("lib/v-applications.ts")),
  "auto-approval is a historical defect classification, not a review outcome");
ok("there is no second 'unreviewed' state overlapping suggested",
  !/review_state[^\n]*["']unreviewed["']/.test(read("lib/v-applications.ts")));
ok("origin can say it does not know",
  /ReqOrigin[\s\S]{0,220}"unspecified"/.test(mergeSrc));

ok("the closed provenance set still contains inference",
  (PROVENANCE_SOURCES as readonly string[]).includes("inference"));
ok("source 'claim' was NOT introduced (a claim is input material, not an author)",
  !(PROVENANCE_SOURCES as readonly string[]).includes("claim"));
ok("manual is still never a valid AI attribution", normalizeProvenanceSource("manual") === "inference");

// ══ 2. NO WRITER RELIES ON A DATABASE DEFAULT ═══════════════════════════════════════════════════════════
console.log("\n── every requirement writer is explicit (AST) ──");

// Production writers only. Scripts seed fixtures and are checked separately below.
const WRITER_FILES = [
  "lib/v-applications.ts",
  "lib/preflight/discovery-db.ts",
  "app/api/preflight/apps/[id]/contract/draft/route.ts",
];
const AUTHORSHIP_COLUMNS = ["source", "origin"];
const REVIEW_COLUMNS = ["review_state"];

for (const f of WRITER_FILES) {
  const sf = parse(f);
  const inserts = tableWrites(sf).filter((w) => w.table === "v_contract_requirements" && (w.method === "insert" || w.method === "upsert"));
  ok(`${f}: has at least one requirement insert to check`, inserts.length > 0);
  for (const w of inserts) {
    if (w.props.size === 0 && w.spreads === 0) {
      // An INDIRECT insert: the rows were built elsewhere and handed over as a variable, which is how the
      // draft-copy route works. The object literal cannot be read here, so the requirement is different and
      // stricter: the file must be seen assigning every review-provenance field by name, which is what
      // proves it decided them rather than letting a copied row carry them silently.
      const src = read(f);
      const assigns = ["review_state", "review_basis", "approved_by", "approved_at", "review_identity"]
        .filter((c) => new RegExp(`\\.${c}\\s*=`).test(src));
      ok(`${f}:${w.line} (indirect insert) decides every review field by name`,
        assigns.length === 5, `missing assignment for: ${["review_state", "review_basis", "approved_by", "approved_at", "review_identity"].filter((c) => !assigns.includes(c)).join(", ")}`);
      continue;
    }
    // A spread carries a whole source row forward and necessarily supplies every column.
    const explicit = w.spreads > 0
      || (AUTHORSHIP_COLUMNS.every((c) => w.props.has(c)) && REVIEW_COLUMNS.every((c) => w.props.has(c)));
    ok(`${f}:${w.line} supplies authorship and review explicitly`, explicit,
      `missing: ${[...AUTHORSHIP_COLUMNS, ...REVIEW_COLUMNS].filter((c) => !w.props.has(c)).join(", ")}`);
  }
}

// The shared insert in v-applications is the one that used to omit both columns.
{
  const sf = parse("lib/v-applications.ts");
  const w = tableWrites(sf).find((x) => x.table === "v_contract_requirements" && x.method === "insert");
  ok("the shared requirement insert names order_index explicitly (never a constant like 9999)",
    !!w && w.props.has("order_index") && !/order_index:\s*\d{3,}/.test(read("lib/v-applications.ts")),
    "a hardcoded order_index is what produced 152 tied rows");
}

// ══ 3. GENERATED WRITERS CANNOT REACH THE HUMAN-AUTHORED WRITER ═════════════════════════════════════════
console.log("\n── the two writers cannot be confused ──");

const vApps = read("lib/v-applications.ts");
ok("a human-authored writer and a model-generated writer exist as separate exports",
  /export async function addAuthoredRequirement/.test(vApps) && /export async function addGeneratedRequirement/.test(vApps));
ok("the ambiguous addRequirement is gone entirely",
  !/export async function addRequirement\b/.test(vApps),
  "one function serving both authors is exactly how a model's text came to be recorded as a person's");

{
  const lane = parse("lib/preflight/verification-lane.ts");
  const authored = localNamesFor(lane, "addAuthoredRequirement", "v-applications");
  const generated = localNamesFor(lane, "addGeneratedRequirement", "v-applications");
  ok("the model lane imports the GENERATED writer", generated.size > 0);
  ok("the model lane cannot call the human-authored writer",
    authored.size === 0 || !callsAny(lane, authored),
    "a generated path calling the authored writer would relabel a model's text as a person's");
}
{
  const route = parse("app/api/preflight/requirements/route.ts");
  const authored = localNamesFor(route, "addAuthoredRequirement", "v-applications");
  const generated = localNamesFor(route, "addGeneratedRequirement", "v-applications");
  ok("the dashboard route imports the AUTHORED writer", authored.size > 0);
  ok("the dashboard route never calls the generated writer",
    generated.size === 0 || !callsAny(route, generated));
}

// ══ 4. ROUTES DO NOT WRITE REQUIREMENT ROWS DIRECTLY ════════════════════════════════════════════════════
console.log("\n── write surface stays closed ──");
{
  const KNOWN = new Set(WRITER_FILES);
  // execFileSync with an argument array: no shell, so the globs reach git literally and nothing here is
  // interpolated into a command string.
  const listed = execFileSync("git", ["ls-files", "app/**/*.ts", "app/**/*.tsx", "lib/**/*.ts"], { cwd: ROOT, encoding: "utf8" })
    .split("\n").map((s) => s.trim()).filter(Boolean);
  const rogue: string[] = [];
  for (const rel of listed) {
    if (KNOWN.has(rel) || !existsSync(join(ROOT, rel))) continue;
    if (!read(rel).includes("v_contract_requirements")) continue;
    const writes = tableWrites(parse(rel)).filter((w) => w.table === "v_contract_requirements" && w.method !== "select");
    if (writes.length) rogue.push(`${rel}:${writes[0].line}`);
  }
  ok("no module outside the known writer set writes requirement rows", rogue.length === 0, rogue.join(", "));
}

// ══ 5. APPROVAL IS A RECORDED HUMAN DECISION ════════════════════════════════════════════════════════════
console.log("\n── approval semantics ──");

ok("approveContract requires an explicit actor",
  /export async function approveContract\([^)]*actor: ApprovalActor/.test(vApps));
ok("the only approval actors are a person and a person's approved plan",
  /ApprovalActor\s*=[\s\S]{0,400}"human_direct"[\s\S]{0,400}"reviewed_plan"/.test(vApps)
  && !/kind:\s*"machine"/.test(vApps),
  "a machine actor would be a supported way to approve without a person");
// The approval rule is a pure function, so it is RUN rather than pattern-matched. Asserting on the shape of
// the statements inside approveContract is what made the previous suite go red on a rewording.
{
  const HUMAN = { kind: "human_direct" as const, email: "reviewer@example.com" };
  const PLAN = { kind: "reviewed_plan" as const, planId: "rvp_1", approvedBy: "reviewer@example.com", approvedAt: "2026-07-25T00:00:00.000Z" };
  const row = (over: Partial<ContractRequirement> = {}): ContractRequirement => ({
    enabled: true, review_state: "approved", review_basis: "human_direct",
    approved_by: "reviewer@example.com", approved_at: "2026-07-25T00:00:00.000Z", ...over,
  } as ContractRequirement);

  ok("an empty contract cannot be approved",
    contractApprovalReadiness([], HUMAN).ok === false);
  ok("approval refuses an enabled requirement that is not approved",
    contractApprovalReadiness([row({ review_state: "suggested" })], HUMAN).ok === false);
  ok("approval refuses an approved requirement that names no reviewer",
    contractApprovalReadiness([row({ approved_by: null })], HUMAN).ok === false
    && contractApprovalReadiness([row({ approved_at: null })], HUMAN).ok === false
    && contractApprovalReadiness([row({ review_basis: null })], HUMAN).ok === false,
    "approved with no reviewer is the exact shape of the defect being corrected");
  ok("a reviewed-plan approval re-checks that the rows carry that same approval",
    contractApprovalReadiness([row({ review_basis: "reviewed_plan", approved_by: "other@example.com" })], PLAN).ok === false
    && contractApprovalReadiness([row({ review_basis: "reviewed_plan" })], PLAN).ok === true);
  ok("each refusal says WHY, so a caller is never left guessing",
    typeof (contractApprovalReadiness([], HUMAN) as { reason?: string }).reason === "string");
  ok("the refusal reasons are distinct",
    new Set([
      (contractApprovalReadiness([], HUMAN) as { reason?: string }).reason,
      (contractApprovalReadiness([row({ review_state: "suggested" })], HUMAN) as { reason?: string }).reason,
      (contractApprovalReadiness([row({ approved_by: null })], HUMAN) as { reason?: string }).reason,
      (contractApprovalReadiness([row({ review_basis: "reviewed_plan", approved_by: "other@example.com" })], PLAN) as { reason?: string }).reason,
    ]).size === 4);
  ok("a pre-migration-19 row is grandfathered, but a post-migration row with null provenance is not",
    contractApprovalReadiness([{ enabled: true, review_state: "approved" } as ContractRequirement], HUMAN).ok === true
    && contractApprovalReadiness([row({ review_basis: null, approved_by: null, approved_at: null })], HUMAN).ok === false);
}

const laneSrc = read("lib/preflight/verification-lane.ts");
ok("the lane approves ONLY on a reviewed-plan approval",
  /if \(!review\.reviewed\)[\s\S]{0,400}return \{[\s\S]{0,200}humanReviewed: false/.test(laneSrc)
  && /approveContract\(uid, contractId, \{\s*\n?\s*kind: "reviewed_plan"/.test(laneSrc));
ok("model-authored rows record model authorship",
  /source: "inference", origin: "prompt"/.test(vApps));

const v1 = read("app/api/v1/verifications/route.ts");
ok("the direct synthesis lane returns review_required and launches nothing",
  /state: "review_required"/.test(v1) && /{ reviewed: false }/.test(v1));
ok("the direct lane no longer forwards a run to the runs route",
  !/launchRun\(forwarded/.test(v1.split("async function executeReviewedPlan")[0]),
  "the pre-review lane must not be able to start a paid run");
ok("reviewed-plan execution refuses a plan approved by nobody",
  /reviewed_plan_approval_incomplete/.test(v1));

const readRoute = read("app/api/v1/verifications/[id]/route.ts");
ok("human_reviewed is read from the persisted binding, never hardcoded",
  /human_reviewed: reviewedPlan\?\.approvalState === "approved"/.test(readRoute)
  && !/human_reviewed: false/.test(readRoute));
ok("decision status and contract review status are separate independent fields",
  /decision_status:/.test(readRoute) && /contract_review_status:/.test(readRoute));

// ══ 6. REVIEW IDENTITY AND CARRY-OVER ═══════════════════════════════════════════════════════════════════
console.log("\n── a review describes exact content ──");

const base = { requirement: "A user can sign in", category: "auth", severity: "critical", enabled: true };
ok("identity is stable across whitespace noise",
  requirementReviewIdentity(base) === requirementReviewIdentity({ ...base, requirement: "  A  user   can sign in " }));
ok("changing the text changes identity",
  requirementReviewIdentity(base) !== requirementReviewIdentity({ ...base, requirement: "A user can sign out" }));
ok("changing severity changes identity",
  requirementReviewIdentity(base) !== requirementReviewIdentity({ ...base, severity: "informational" }));
ok("changing enabled changes identity",
  requirementReviewIdentity(base) !== requirementReviewIdentity({ ...base, enabled: false }));
ok("changing category changes identity",
  requirementReviewIdentity(base) !== requirementReviewIdentity({ ...base, category: "billing" }));
ok("source refs are part of what was reviewed",
  requirementReviewIdentity(base) !== requirementReviewIdentity({ ...base, source_refs: [{ type: "prd", reference: "p2" }] }));
ok("source ref order does not change identity",
  requirementReviewIdentity({ ...base, source_refs: [{ type: "a", reference: "1" }, { type: "b", reference: "2" }] })
  === requirementReviewIdentity({ ...base, source_refs: [{ type: "b", reference: "2" }, { type: "a", reference: "1" }] }));

const draftRoute = read("app/api/preflight/apps/[id]/contract/draft/route.ts");
ok("carry-over requires a stored identity that still matches",
  /storedIdentity === currentIdentity/.test(draftRoute) && /!!storedIdentity/.test(draftRoute),
  "a missing identity means the review cannot be proven to apply");
ok("carry-over requires the claim to be unchanged", /claimUnchanged/.test(draftRoute));
ok("carry-over refuses a row edited after approval", /user_modified !== true/.test(draftRoute));
ok("a cleared review drops the reviewer, the timestamp and the basis together",
  /copy\.review_basis = null;[\s\S]{0,200}copy\.approved_by = null;[\s\S]{0,200}copy\.approved_at = null;/.test(draftRoute));
ok("reviewed-plan approval NEVER carries into the next contract version",
  /copy\.reviewed_plan_id = null/.test(draftRoute),
  "a new version can differ in flows, ordering or scope even when every requirement text is identical");
ok("the copy re-keys order densely instead of inheriting ties",
  /copy\.order_index = i \+ 1/.test(draftRoute));
ok("an edit that is not itself a review decision clears the approval",
  /const semanticChange =[\s\S]{0,400}fields\.review_state = "suggested"/.test(vApps));

// ══ 7. MERGE BEHAVIOUR AFTER THE CORRECTION ═════════════════════════════════════════════════════════════
console.log("\n── discovery merge, post-correction ──");

// The suggestion and the existing row must share a fingerprint, or the merge planner treats the suggestion
// as brand new and none of the preserve/refresh rules are exercised at all.
const SUG_TEXT = "A user can sign in reliably";
const sug = [{ requirement: SUG_TEXT, category: "auth", severity: "critical" as const, source_refs: [] }];
const mkReq = (over: Partial<MergeReq>): MergeReq => ({
  id: "r1", fingerprint: fingerprint("auth", SUG_TEXT), requirement: "A user can sign in", category: "auth",
  severity: "critical", origin: "prompt", review_state: "suggested", user_modified: false, stale: false,
  source_refs: [], ...over,
});

{
  // The two corrected DRAFT lane contracts: prompt-origin suggested rows are refinable, which is the point
  // of leaving them suggested rather than inventing a state that freezes them.
  const p = planMerge([mkReq({ origin: "prompt", review_state: "suggested" })], sug, 2);
  ok("prompt-origin suggested requirements may be refined", p.summary.refreshed === 1 && p.summary.preserved === 0);
}
{
  const p = planMerge([mkReq({ origin: "discovery", review_state: "suggested" })], sug, 2);
  ok("discovery-origin suggested requirements may be refined", p.summary.refreshed === 1);
}
{
  const p = planMerge([mkReq({ origin: "prompt", review_state: "suggested", user_modified: true })], sug, 2);
  ok("a user-modified row preserves its text whatever authored it", p.summary.preserved === 1);
}
{
  const p = planMerge([mkReq({ origin: "user", review_state: "suggested" })], sug, 2);
  ok("an explicitly human-authored row preserves its text", p.summary.preserved === 1);
}
{
  const p = planMerge([mkReq({ origin: "prompt", review_state: "approved" })], sug, 2);
  ok("an APPROVED row is never reworded by discovery", p.summary.preserved === 1);
}
{
  const p = planMerge([mkReq({ origin: "prompt", review_state: "rejected" })], sug, 2);
  ok("a rejected row stays rejected when it reappears", p.summary.reappeared_kept_rejected === 1);
}
{
  const p = planMerge([mkReq({ origin: "prompt", review_state: "suggested" })], [], 2);
  ok("a prompt-origin row is not marked stale by a discovery pass that never proposed it",
    p.summary.marked_stale === 0, "discovery did not author it, so discovery not seeing it proves nothing");
}

// ══ 8. ORDERING ═════════════════════════════════════════════════════════════════════════════════════════
console.log("\n── ordering is proven or declared incomplete ──");

const rows = (idx: number[]): ContractRequirement[] =>
  idx.map((i, n) => ({ order_index: i, id: `r${n}` }) as unknown as ContractRequirement);
ok("unique order indexes are complete", requirementOrderIsComplete(rows([1, 2, 3])));
ok("duplicate order indexes are incomplete", !requirementOrderIsComplete(rows([9999, 9999, 9999])));

const forRun = read("lib/preflight/requirements-for-run.ts");
ok("historical order is read from the immutable reviewed plan when one exists",
  /orderBasis: "reviewed_plan"/.test(forRun) && /getReviewedPlanByRunId/.test(forRun));
ok("a tied legacy order is reported as incomplete, never reconstructed",
  /"legacy_incomplete"/.test(forRun) && /orderProven: complete/.test(forRun) && !/\.sort\(/.test(forRun),
  "the module must not impose an order of its own: created_at plus a UUID is not evidence of insertion order");
ok("listRequirements returns a total order so repeated reads agree",
  /order\("order_index"[\s\S]{0,160}order\("created_at"[\s\S]{0,120}order\("id"/.test(vApps));

// ══ 9. LABELS ═══════════════════════════════════════════════════════════════════════════════════════════
console.log("\n── owner-facing language ──");
ok("an unreviewed requirement says so", reviewStateLabel("suggested") === "Awaiting your review");
ok("an approved requirement reads as a decision someone made", reviewStateLabel("approved") === "Reviewed and approved");
ok("an unknown review state degrades to awaiting review, never to approved",
  reviewStateLabel("something_new") === "Awaiting your review");
ok("a null basis has no label rather than a weak-approval label", reviewBasisLabel(null) === null);
ok("both approval bases are named", !!reviewBasisLabel("human_direct") && !!reviewBasisLabel("reviewed_plan"));

const labels = read("app/rank/app/applications/[id]/contract/labels.ts");
ok("no em dash, en dash, middot or emoji in the labels module",
  !/[—–·•]/.test(labels) && !/\p{Extended_Pictographic}/u.test(labels));

// ══ 10. MIGRATIONS EXIST, IN THE RIGHT ORDER, AND TOUCH NOTHING HISTORICAL ══════════════════════════════
console.log("\n── migrations ──");

const m19 = read("sql/vraelis-preflight-19-requirement-provenance.sql");
const m20 = read("sql/vraelis-preflight-20-provenance-defaults.sql");
const m21 = read("sql/vraelis-preflight-21-provenance-backfill.sql");
const m21r = read("sql/vraelis-preflight-21-provenance-rollback.sql");

ok("19 is additive only: no update, no delete, no default change",
  !/\bupdate\s+v_/i.test(m19) && !/\bdelete\s+from/i.test(m19) && !/set\s+default/i.test(m19));
ok("19 adds every provenance column",
  ["approved_at", "review_basis", "review_identity", "reviewed_plan_id", "legacy_review_class"]
    .every((c) => m19.includes(c)) && m19.includes("legacy_approval_class"));
ok("20 removes both unsafe defaults",
  /alter column origin\s+set default 'unspecified'/.test(m20)
  && /alter column review_state\s+set default 'suggested'/.test(m20));
ok("20 constrains the closed vocabularies", /chk_v_req_origin/.test(m20) && /chk_v_req_review_state/.test(m20));
ok("20 forbids an approved row with no reviewer", /chk_v_req_basis_complete/.test(m20) && /chk_v_req_approved_has_basis/.test(m20));
ok("20 forbids an unapproved row carrying approval provenance", /chk_v_req_unapproved_clean/.test(m20));
ok("20 adds every constraint NOT VALID so it binds forward without rewriting history",
  (m20.match(/not valid;/g) ?? []).length === (m20.match(/add constraint/g) ?? []).length);

ok("21 verifies the exact census before writing anything",
  /expect 153/.test(m21) && /expect 136/.test(m21) && /expect 17/.test(m21) && /expect 8/.test(m21) && /expect 128/.test(m21));
ok("21 snapshots before it writes", /backup_21/.test(m21) && m21.indexOf("backup_21") < m21.indexOf("STAGE 2"));
ok("21 never writes a run decision", !/update\s+v_preflight_runs/i.test(m21));
// Reading c.status in a WHERE clause is how the file SELECTS what to classify; assigning it is what must
// never happen. Only the assignment forms are forbidden.
ok("21 never assigns contract status",
  !/\bset\s+status\s*=/i.test(m21) && !/,\s*status\s*=/i.test(m21));
ok("21 never edits requirement text", !/set[\s\S]{0,200}\brequirement\s*=/i.test(m21));
ok("21 puts group B back to suggested with the legacy classification",
  /review_state\s*=\s*'suggested'[\s\S]{0,400}legacy_review_class = 'legacy_auto_approved'/.test(m21));
ok("21 gives group A no legacy classification",
  /review_basis\s*=\s*'reviewed_plan'/.test(m21)
  && !/from group_a[\s\S]{0,200}legacy_review_class/.test(m21));
ok("21 normalizes ordering for DRAFT contracts only",
  /where c\.status = 'draft'/.test(m21) && /APPROVED CONTRACTS ARE NOT TOUCHED/.test(m21));
ok("21 does not commit itself", !/^\s*commit;/m.test(m21));
ok("a rollback exists and refuses to run against an empty snapshot",
  /refusing to roll back/.test(m21r));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
