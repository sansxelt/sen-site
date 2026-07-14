// S8A — authenticated-flow authoring tests. THREE layers, mirroring the preflight verify suites:
//
//   1. PURE units — validateSteps (every FLOW_ACTION accepted with correct fields; unknown rejected;
//      sign_in_as/switch_role to a nonexistent role rejected; a credential-shaped value rejected; count +
//      length bounds; navigate relative-only; the 6-step canary flow validates), flowRequiresAuth/flowRoles.
//
//   2. STATIC (data layer) — addFlow/updateFlow/deleteFlow/contractStatusForFlow are owner-scoped
//      (eq user_id everywhere), refuse an approved contract (contract_approved / immutability), never trust
//      a client id, and report honest zero-rows.
//
//   3. STATIC (route) — the flows route gates the owner + loads the contract owner-scoped BEFORE any
//      mutation, never trusts a client owner/app id, holds the approved-immutable 409 on every path, derives
//      roles from the app's real test accounts, carries NO step values in its audit events, and triggers
//      snapshotIfChanged after a successful write.
//
// Pure unit tests + static source checks; no DB, no network, no browser. Run: npx tsx scripts/preflight-flow-authoring-verify.ts
import { readFileSync } from "node:fs";
import {
  validateSteps, flowRequiresAuth, flowRoles, FLOW_ACTIONS, MAX_STEPS, ACTION_LABELS,
  type FlowStep,
} from "../lib/preflight/flow-steps";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

const read = (p: string) => readFileSync(p, "utf8");
// Blank out // and /* */ comments so string checks never match documentation (shared with the other suites).
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

const ROLES = ["Standard user", "Admin user"];
const opt = { rolesAvailable: ROLES };
function assertValid(steps: unknown, o = opt): FlowStep[] {
  const r = validateSteps(steps, o);
  if (!r.ok) throw new Error(`expected valid, got: ${r.reason}`);
  return r.steps;
}

// ══ 1. PURE units: validateSteps ═══════════════════════════════════════════════════════════════════════
console.log("── 1. validateSteps: every action accepted with the right fields ──");

// The curated authorable set is exactly the twelve documented actions (no raw selectors / screenshots).
ok("FLOW_ACTIONS is exactly the thirteen curated authorable actions",
  JSON.stringify([...FLOW_ACTIONS].sort()) === JSON.stringify([
    "assert_text", "assert_url", "assert_visible", "click", "fill", "navigate", "refresh",
    "reset_context", "sign_in_as", "sign_out", "switch_role", "verify_authenticated", "verify_unauthorized",
  ].sort()));
// assert_url is a CURATED semantic action ("check the page is on /path"), not a raw Playwright selector —
// so it is authorable. The genuinely raw actions below must still never be authorable.
ok("no raw Playwright actions leak into the authorable set (no select/press/new_context/screenshot/wait)",
  !(["select", "press", "check", "uncheck", "wait_for", "new_context", "screenshot", "wait"] as string[]).some((a) => (FLOW_ACTIONS as readonly string[]).includes(a)));
ok("every authorable action has an owner-facing label (no raw enum leaks in the UI)",
  FLOW_ACTIONS.every((a) => typeof ACTION_LABELS[a] === "string" && ACTION_LABELS[a].length > 0 && ACTION_LABELS[a] !== a));

// Each action accepted with its correct fields.
ok("navigate: relative target accepted", assertValid([{ action: "navigate", target: "/dashboard" }])[0].target === "/dashboard");
ok("navigate: empty target accepted (worker rebases to the app root)", assertValid([{ action: "navigate" }])[0].target === undefined);
ok("click: needs a target, accepted", assertValid([{ action: "click", target: "Create project" }])[0].target === "Create project");
ok("assert_visible: needs a target, accepted", assertValid([{ action: "assert_visible", target: "Your projects" }])[0].target === "Your projects");
ok("assert_text: needs target + expect, accepted", (() => { const s = assertValid([{ action: "assert_text", target: "banner", expect: "Saved" }])[0]; return s.target === "banner" && s.expect === "Saved"; })());
ok("assert_url: relative expect (route) accepted", (() => { const s = assertValid([{ action: "assert_url", expect: "/dashboard" }])[0]; return s.expect === "/dashboard" && s.target === undefined; })());
ok("fill: needs target + value, accepted", (() => { const s = assertValid([{ action: "fill", target: "Name", value: "Acme" }])[0]; return s.target === "Name" && s.value === "Acme"; })());
ok("refresh: no fields, accepted", (() => { const s = assertValid([{ action: "refresh" }])[0]; return s.action === "refresh" && s.target === undefined; })());
ok("sign_in_as: role in the available set accepted", assertValid([{ action: "sign_in_as", target: "Standard user" }])[0].target === "Standard user");
ok("switch_role: role in the available set accepted", assertValid([{ action: "switch_role", target: "Admin user" }])[0].target === "Admin user");
for (const a of ["verify_authenticated", "verify_unauthorized", "sign_out", "reset_context"]) {
  ok(`${a}: accepted with no fields`, assertValid([{ action: a }])[0].action === a);
}
// verify_authenticated / verify_unauthorized: optionally carry an expected route (value) + element (expect),
// which the worker consumes (execute-run: expect = { route: step.value, element: step.expect }).
ok("verify_authenticated: optional route(value) + element(expect) preserved", (() => {
  const s = assertValid([{ action: "verify_authenticated", value: "/dashboard", expect: "Welcome back" }])[0];
  return s.value === "/dashboard" && s.expect === "Welcome back";
})());
ok("verify_unauthorized: optional route(value) preserved", (() => {
  const s = assertValid([{ action: "verify_unauthorized", value: "/signin" }])[0];
  return s.value === "/signin";
})());

// Normalization drops fields the action does not use (no empty strings stored).
ok("normalization: a click never stores a value/expect even if the client sent them",
  (() => { const s = assertValid([{ action: "click", target: "Go", value: "junk", expect: "junk" }])[0]; return s.value === undefined && s.expect === undefined; })());

console.log("\n── 1b. validateSteps: rejections ──");
ok("unknown action rejected", !validateSteps([{ action: "eval" }], opt).ok);
ok("empty action rejected", !validateSteps([{ action: "" }], opt).ok);
ok("a raw worker action outside the curated set (screenshot) is rejected", !validateSteps([{ action: "screenshot" }], opt).ok);
ok("sign_in_as to a NONEXISTENT role is rejected", (() => { const r = validateSteps([{ action: "sign_in_as", target: "Superuser" }], opt); return !r.ok && /Superuser/.test(r.reason); })());
ok("switch_role to a nonexistent role is rejected", !validateSteps([{ action: "switch_role", target: "Ghost" }], opt).ok);
ok("sign_in_as with no role is rejected", !validateSteps([{ action: "sign_in_as" }], opt).ok);
ok("role matching is case-insensitive", validateSteps([{ action: "sign_in_as", target: "standard USER" }], opt).ok);
ok("with NO roles available, any sign_in_as is rejected", !validateSteps([{ action: "sign_in_as", target: "Standard user" }], { rolesAvailable: [] }).ok);
ok("fill without a value is rejected", !validateSteps([{ action: "fill", target: "Name" }], opt).ok);
ok("fill without a target is rejected", !validateSteps([{ action: "fill", value: "x" }], opt).ok);
ok("assert_text without expect is rejected", !validateSteps([{ action: "assert_text", target: "banner" }], opt).ok);
ok("assert_visible without a target is rejected", !validateSteps([{ action: "assert_visible" }], opt).ok);
ok("click without a target is rejected", !validateSteps([{ action: "click" }], opt).ok);
ok("navigate to an ABSOLUTE url (another origin) is rejected", !validateSteps([{ action: "navigate", target: "https://evil.example/steal" }], opt).ok);
ok("navigate to a protocol-relative url is rejected", !validateSteps([{ action: "navigate", target: "//evil.example" }], opt).ok);
ok("navigate to a javascript: url is rejected", !validateSteps([{ action: "navigate", target: "javascript:alert(1)" }], opt).ok);
ok("assert_url without an expected path is rejected", !validateSteps([{ action: "assert_url" }], opt).ok);
ok("assert_url to an ABSOLUTE url (another origin) is rejected", !validateSteps([{ action: "assert_url", expect: "https://evil.example/ok" }], opt).ok);
ok("verify_authenticated with an absolute expected route is rejected", !validateSteps([{ action: "verify_authenticated", value: "https://evil.example" }], opt).ok);
ok("an empty step list is rejected", !validateSteps([], opt).ok);
ok("a non-array is rejected", !validateSteps("navigate" as unknown, opt).ok);

console.log("\n── 1c. validateSteps: the credential rule (no secret ever typed into a step) ──");
// A credential-shaped VALUE in ANY string field is rejected — reusing the connections value-guard.
ok("a Stripe key in a fill value is rejected", !validateSteps([{ action: "fill", target: "Token", value: "sk_live_abcdEFGH12345678" }], opt).ok);
ok("a password:value pair in a fill value is rejected", !validateSteps([{ action: "fill", target: "Notes", value: "password: hunter2!" }], opt).ok);
ok("a JWT in a fill value is rejected", !validateSteps([{ action: "fill", target: "Auth", value: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.x" }], opt).ok);
ok("a GitHub token in an assert_text expect is rejected", !validateSteps([{ action: "assert_text", target: "banner", expect: "ghp_abcdefghijklmnopqrstuv1234567890" }], opt).ok);
ok("a credential-shaped value in a navigate target is rejected", !validateSteps([{ action: "navigate", target: "sk_live_abcdEFGH12345678" }], opt).ok);
ok("an ordinary fill value is accepted (the guard is not over-broad)", validateSteps([{ action: "fill", target: "Name", value: "My first project" }], opt).ok);

console.log("\n── 1d. validateSteps: bounds ──");
ok("MAX_STEPS is 30 (mirrors the worker maxStepsPerFlow)", MAX_STEPS === 30);
ok("exactly 30 steps is accepted", validateSteps(Array.from({ length: 30 }, () => ({ action: "refresh" })), opt).ok);
ok("31 steps is rejected", !validateSteps(Array.from({ length: 31 }, () => ({ action: "refresh" })), opt).ok);
ok("an over-long target (>400 chars) is rejected", !validateSteps([{ action: "click", target: "x".repeat(401) }], opt).ok);
ok("an over-long fill value (>400 chars) is rejected", !validateSteps([{ action: "fill", target: "Name", value: "x".repeat(401) }], opt).ok);
ok("an over-long expect (>400 chars) is rejected", !validateSteps([{ action: "assert_text", target: "banner", expect: "x".repeat(401) }], opt).ok);

console.log("\n── 1e. THE CANARY FLOW validates end to end ──");
// sign_in_as "Standard user" -> verify_authenticated -> click "Create project" -> assert_visible ->
// sign_out -> verify_unauthorized. Priority critical, role "Standard user". This is the flow the owner
// authors through the UI to complete the S6 live canary.
const CANARY: unknown[] = [
  { action: "sign_in_as", target: "Standard user" },
  { action: "verify_authenticated" },
  { action: "click", target: "Create project" },
  { action: "assert_visible", target: "Untitled project" },
  { action: "sign_out" },
  { action: "verify_unauthorized" },
];
{
  const r = validateSteps(CANARY, opt);
  ok("the 6-step canary flow validates against the Standard user role", r.ok, r.ok ? "" : r.reason);
  if (r.ok) {
    ok("the canary normalizes to exactly 6 steps in order",
      r.steps.length === 6 && r.steps.map((s) => s.action).join(",") === "sign_in_as,verify_authenticated,click,assert_visible,sign_out,verify_unauthorized");
    ok("the canary sign_in_as carries the role and NO value (never a credential)", r.steps[0].target === "Standard user" && r.steps[0].value === undefined);
    ok("the canary is an authenticated flow (flowRequiresAuth true)", flowRequiresAuth(r.steps));
    ok("the canary's role resolves to Standard user (what the S6 readiness gate reads)", flowRoles(r.steps).join(",") === "Standard user");
  }
}
// The canary is REJECTED when the Standard user role is not connected (you cannot author a sign-in for a
// role you have not added under Connections — the launch gate would have nothing to resolve).
ok("the canary is rejected when Standard user is not a connected role", !validateSteps(CANARY, { rolesAvailable: ["Admin user"] }).ok);

console.log("\n── 1f. flowRequiresAuth / flowRoles ──");
ok("flowRequiresAuth true when any auth action is present", flowRequiresAuth([{ action: "navigate" }, { action: "sign_out" }]));
ok("flowRequiresAuth false for a plain journey", !flowRequiresAuth([{ action: "navigate" }, { action: "click" }, { action: "assert_visible" }]));
ok("flowRoles returns de-duplicated sign_in/switch targets in first-seen order",
  flowRoles([{ action: "sign_in_as", target: "Admin user" }, { action: "switch_role", target: "Standard user" }, { action: "sign_in_as", target: "Admin user" }]).join(",") === "Admin user,Standard user");
ok("flowRoles ignores non-role actions", flowRoles([{ action: "navigate", target: "/x" }, { action: "click", target: "Go" }]).length === 0);

// ══ 2. STATIC: data layer owner-scoping + approved-immutable ═══════════════════════════════════════════
console.log("\n── 2. data layer (lib/v-applications.ts): owner-scoping + approved-immutable ──");
const vApps = stripComments(read("lib/v-applications.ts"));
// The three mutators + the status helper exist.
for (const fn of ["addFlow", "updateFlow", "deleteFlow", "contractStatusForFlow"]) {
  ok(`${fn} exists`, new RegExp(`export async function ${fn}\\b`).test(vApps));
}
// Owner-scoping: every flow query filters eq("user_id", ...). Count the flow-table queries and their scopes.
// The flow layer starts at the FlowInput type (a real code token that survives comment stripping).
const flowBlock = vApps.slice(vApps.indexOf("export type FlowInput"));
// Every v_test_flows access in the flow layer is owner-scoped: reads/updates/deletes filter eq user_id;
// the single INSERT carries user_id: uid in its payload (an insert is scoped by the value it writes, not a
// WHERE). So every access is either eq("user_id" OR an insert whose payload sets user_id: uid.
ok("every v_test_flows access in the flow layer is owner-scoped (eq user_id, or user_id in the insert payload)", (() => {
  const parts = flowBlock.split(/from\("v_test_flows"\)/).slice(1);
  return parts.length >= 3 && parts.every((p) => {
    const seg = p.slice(0, 300);
    return /\.eq\("user_id"/.test(seg) || /\.insert\([\s\S]{0,220}?user_id: uid/.test(seg);
  });
})());
ok("addFlow refuses an approved contract (contract_approved immutability)",
  /addFlow[\s\S]*?contract\.status === "approved"\) return \{ error: "contract_approved" \}/.test(vApps));
ok("updateFlow refuses an approved contract via contractStatusForFlow",
  /updateFlow[\s\S]*?status === "approved"\) return \{ error: "contract_approved" \}/.test(vApps));
ok("deleteFlow refuses an approved contract via contractStatusForFlow",
  /deleteFlow[\s\S]*?status === "approved"\) return \{ error: "contract_approved" \}/.test(vApps));
ok("addFlow re-checks contract ownership before inserting (getContractById owner-scoped)",
  /addFlow[\s\S]*?getContractById\(uid, contractId\)[\s\S]*?from\("v_test_flows"\)\.insert/.test(vApps));
ok("addFlow sets order_index to max+1 (a new flow sorts last)", /order_index: maxIdx \+ 1/.test(vApps));
ok("addFlow defaults enabled true", /addFlow[\s\S]*?enabled: true/.test(vApps));
ok("updateFlow/deleteFlow resolve status via contractStatusForFlow FIRST (a cross-owner id -> not_found)",
  /updateFlow[\s\S]*?contractStatusForFlow\(uid, flowId\)/.test(vApps) && /deleteFlow[\s\S]*?contractStatusForFlow\(uid, flowId\)/.test(vApps));
ok("deleteFlow reports honest zero-rows (a cross-owner / gone id is not 'removed')",
  /deleteFlow[\s\S]*?\.select\("id"\)[\s\S]*?data\.length === 0\) return \{ error: "not_found" \}/.test(vApps));
ok("contractStatusForFlow looks up the flow owner-scoped then the contract owner-scoped (mirror of the requirement helper)",
  /contractStatusForFlow[\s\S]*?from\("v_test_flows"\)\.select\("contract_id"\)[\s\S]*?\.eq\("user_id", uid\)[\s\S]*?getContractById\(uid, contractId\)/.test(vApps));
ok("the flow layer never trusts a client-supplied owner (owner is always the norm(userId) param)",
  !/addFlow[\s\S]*?body|updateFlow[\s\S]*?req\./.test(flowBlock));

// ══ 3. STATIC: the route ═══════════════════════════════════════════════════════════════════════════════
console.log("\n── 3. route (app/api/preflight/flows/route.ts): owner gate, no client trust, immutable, audit, snapshot ──");
const route = stripComments(read("app/api/preflight/flows/route.ts"));
ok("the route is Preflight-flag gated on every method", (route.match(/if \(!preflightEnabled\(\)\)/g) ?? []).length === 3);
ok("the route requires a session owner on every method (401 without one)", (route.match(/signin_required/g) ?? []).length >= 3);
ok("the owner is the SESSION email, never a client-supplied id", route.includes("(await auth())?.user?.email") && !/body\?*\.(owner|user_id|owner_id)/.test(route));
ok("POST loads the contract owner-scoped BEFORE any mutation (owner gate first)", (() => {
  const load = route.indexOf("getContractById(email, contractId)");
  const add = route.indexOf("addFlow(email");
  return load !== -1 && add !== -1 && load < add;
})());
ok("POST checks the approved-immutable guard BEFORE addFlow", (() => {
  const guard = route.indexOf('contract.status === "approved") return approvedImmutable()');
  const add = route.indexOf("addFlow(email");
  return guard !== -1 && add !== -1 && guard < add;
})());
ok("PATCH resolves contractStatusForFlow (approved-immutable) BEFORE updateFlow", (() => {
  const guard = route.indexOf("contractStatusForFlow(email, id)");
  const upd = route.indexOf("updateFlow(email");
  return guard !== -1 && upd !== -1 && guard < upd;
})());
ok("DELETE resolves contractStatusForFlow (approved-immutable) BEFORE deleteFlow", (() => {
  const guard = route.lastIndexOf("contractStatusForFlow(email, id)");
  const del = route.indexOf("deleteFlow(email");
  return guard !== -1 && del !== -1 && guard < del;
})());
ok("every method returns 409 contract_approved on an approved contract", route.includes('status: 409') && (route.match(/approvedImmutable\(\)/g) ?? []).length >= 4);
ok("the app id is DERIVED server-side from the contract/flow, never trusted from the client",
  route.includes("contract.application_id") && route.includes("rolesForApplication(") && !/body\?*\.(app_id|application_id)/.test(route));
ok("steps are validated with the app's REAL test-account roles before any write",
  route.includes("rolesForApplication(") && route.includes("validateSteps(rawSteps, { rolesAvailable: roles })"));
ok("rolesForApplication reads test_account connections owner-scoped and NEVER selects the ciphertext",
  /rolesForApplication[\s\S]*?\.eq\("user_id"[\s\S]*?\.eq\("provider", "test_account"\)/.test(route) && !/rolesForApplication[\s\S]*?encrypted_ref/.test(route));
// Audit carries application + contract id + flow NAME only — never a step value.
ok("audit events are logged for add/update/remove", route.includes("preflight_flow_added") && route.includes("preflight_flow_updated") && route.includes("preflight_flow_removed"));
ok("audit metadata carries application_id + contract_id + flow_name ONLY (never a step value)", (() => {
  // Every logEvent metadata object in the route must contain only these three keys (capture the INNER object).
  const metas = route.match(/metadata: \{([^}]*)\}/g) ?? [];
  return metas.length >= 3 && metas.every((m) => {
    const inner = m.replace(/^metadata: \{/, "").replace(/\}$/, "");
    const keys = (inner.match(/(\w+):/g) ?? []).map((k) => k.replace(":", ""));
    return keys.length > 0 && keys.every((k) => ["application_id", "contract_id", "flow_name"].includes(k));
  });
})());
ok("no logEvent in the route ever passes steps/value/target/expect into metadata",
  !/metadata: \{[^}]*\b(steps|value|target|expect)\b/.test(route));
ok("snapshotIfChanged is triggered after a successful write on every method (context changed)",
  (route.match(/snapshotIfChanged\(email, [^,]+, "owner"\)/g) ?? []).length >= 3);
ok("the route imports validateSteps from the pure flow-steps model", /import \{ validateSteps[^}]*\} from "@\/lib\/preflight\/flow-steps"/.test(route));

// ══ 4. STATIC: the UI ══════════════════════════════════════════════════════════════════════════════════
console.log("\n── 4. UI: draft-only flow authoring, read-only when approved, no password field, on-design ──");
const editor = read("app/rank/app/applications/[id]/contract/contract-editor.tsx");
const flowsSection = read("app/rank/app/applications/[id]/contract/flows-section.tsx");
const flowEditor = read("app/rank/app/applications/[id]/contract/flow-editor.tsx");
const page = read("app/rank/app/applications/[id]/contract/page.tsx");
ok("the draft editor renders the Flows section", editor.includes("<FlowsSection"));
ok("the draft editor passes flows + roles down to the Flows section", /<FlowsSection contractId=\{contractId\} initial=\{flows\} roles=\{roles\}/.test(editor));
ok("the page passes flows + roles to the draft ContractEditor", /<ContractEditor[^>]*flows=\{flows\} roles=\{roles\}/.test(page));
ok("the page derives roles from the app's connected test accounts (meta.role/label, owner-scoped)",
  page.includes("testAccountRoles(") && page.includes('c.provider !== "test_account"') && page.includes("meta.role") && page.includes("meta.label"));
ok("roles are only passed on a DRAFT (approved contract does not author)", /contract\?\.status === "draft" \? await testAccountRoles/.test(page));
ok("the approved contract shows a READ-ONLY flow list (no editor, matches the requirement behavior)",
  page.includes("Test flows ({flows.length})") && !page.includes("<FlowsSection") === true && page.includes("read-only on an approved contract"));
ok("the FlowEditor NEVER renders a password/secret field (creds are pulled by role worker-side)",
  !/type=["']password["']/.test(flowEditor) && !/\bpassword\b/i.test(flowEditor.replace(/never a password|no password|Passwords are never/gi, "")));
ok("the FlowEditor uses a ROLE dropdown for sign_in_as/switch_role (a friendly picker, not a raw selector)",
  flowEditor.includes("needsRole(") && flowEditor.includes("Choose a role"));
ok("the step builder adds actions from FLOW_ACTIONS via labels (no raw enum shown)",
  flowEditor.includes("FLOW_ACTIONS.map") && flowEditor.includes("ACTION_LABELS[a]"));
ok("the step builder can reorder (up/down) and remove steps", flowEditor.includes("move(i, -1)") && flowEditor.includes("move(i, 1)") && flowEditor.includes("removeStep("));
// The "Verify it persisted" macro scaffolds refresh + assert_visible (ONE field to complete), not
// assert_text (which needs two and would 400 on save if left blank). Regression lock for the review fix.
// Scope the check to the addPersisted function BODY so unrelated assert_text references elsewhere in the
// editor (its own step type) don't confuse the negative assertion.
const addPersistedBody = (flowEditor.match(/function addPersisted\(\)\s*\{[\s\S]*?\n {2}\}/) || [""])[0];
ok("the persisted-state preset expands to refresh + assert_visible (single field to complete)",
  addPersistedBody.includes('"refresh"') && addPersistedBody.includes('"assert_visible"') && !addPersistedBody.includes('"assert_text"'));
// save() surfaces a clear per-step reason for an incomplete step instead of relying on a generic server 400.
ok("the editor validates step completeness client-side before saving (stepIncompleteReason)",
  flowEditor.includes("stepIncompleteReason") && /for \(let i = 0; i < steps\.length; i\+\+\)/.test(flowEditor));
// The pass-preview panel reads the plan NAME (plan.name), never interpolates the PlanV1 object (which would
// render "[object Object]" to a subscriber). Regression lock for the review fix.
const passPreview = read("app/rank/app/applications/[id]/contract/pass-preview.tsx");
ok("the pass preview renders decision.plan.name, never the raw plan object",
  passPreview.includes("decision.plan.name") && !/\$\{decision\.plan\}/.test(passPreview));
ok("the FlowsSection has an honest empty state", flowsSection.includes("No flows yet"));
ok("the FlowsSection lists name, role chip, step count, enabled toggle",
  flowsSection.includes("RoleChip") && flowsSection.includes("step") && flowsSection.includes('type="checkbox"') && flowsSection.includes("toggleEnabled"));
ok("the FlowEditor derives the flow role from its sign-in steps (what the readiness gate reads)",
  flowEditor.includes('s.action === "sign_in_as" || s.action === "switch_role"') && flowEditor.includes("resolvedRole"));
// The no-em-dash rule is a COPY rule (user-facing text reads as AI-generated), not a code-comment rule —
// the existing contract-editor/page comments use em dashes freely. Strip comments first, so this checks
// only the shipped code + string literals (where all the customer-facing copy lives).
ok("no em dash, middle dot, or emoji in the flow UI COPY or the step model",
  [flowsSection, flowEditor, read("lib/preflight/flow-steps.ts")].map(stripComments).every((s) => !s.includes("—") && !s.includes("·") && !/[\u{1F300}-\u{1FAFF}]/u.test(s)));

// Security-review fix: the flows route DERIVES the stored role from the validated sign-in steps
// (flowRoles), never trusting a client-supplied role field, so the persisted role can never name an
// account the flow does not sign into.
const flowsRoute = read("app/api/preflight/flows/route.ts");
ok("POST derives the flow role from its steps (flowRoles), not the client body",
  /role:\s*derivedRoles\[0\]/.test(flowsRoute) && !/role:\s*typeof body\?\.role/.test(flowsRoute));
ok("PATCH re-derives the role from edited steps, never the client body",
  /derivedRole = flowRoles\(v\.steps\)\[0\]/.test(flowsRoute) && !/role:\s*body\?\.role !== undefined/.test(flowsRoute));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
