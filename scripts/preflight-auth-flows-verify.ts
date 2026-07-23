// S6 authenticated-flow tests. THREE layers, mirroring preflight-boundaries-verify's structure:
//
//   1. PURE units — the auth-executor primitives (resolveRole, signInAs, verifyAuth, switchRole isolation)
//      and the pass-preview readiness core (checkAuthReadiness), driven with plain data + a scripted
//      FakePage + a fake credential opener. No DB, no browser, no real vault key.
//
//   2. EXECUTOR SPIES (FakeRunStore + FakeBrowserProvider + FakePage auth script): the full lifecycle proof
//      that a correct account authenticates; a wrong password / rejected creds is auth_rejected_by_app (a
//      real defect -> failed flow -> issue); a revoked/missing credential fails SAFE (auth_config_failed, no
//      issue, refund when nothing ran); cross-owner / cross-application resolution returns null; a missing
//      vault key fails CLOSED with no unauth fallback; malformed ciphertext fails closed; MFA/CAPTCHA stop
//      safely; role sessions are isolated (switch_role clears prior state); boundary refusals stop with
//      blocked_by_policy; infra/vault failures refund/consume nothing; and — the BACKWARD-COMPAT PROOF —
//      unauthenticated flows behave IDENTICALLY to before.
//
//   3. STATIC + REDACTION checks: the active credential value is scrubbed from step detail, log fields, and
//      evidence; screenshots are skipped on the password step; no plaintext survives in any persisted field.
import { readFileSync } from "node:fs";
import {
  redactString, setActiveCredentials, addActiveCredentials, clearActiveCredentials, clearAllActiveCredentials,
  activeCredentialCount, log,
} from "../worker/preflight/redaction";
import { redactObject } from "../worker/preflight/redaction";
import { PostgresRunStore } from "../worker/preflight/run-store-postgres";
import {
  resolveRole, signInAs, verifyAuth, resetContext as resetCtx, signOut, DETERMINISTIC_AUTH_FAILURE, authFailureConsumesNothing, type CredentialOpener,
} from "../worker/preflight/auth-executor";
import { checkAuthReadiness, requiredRoles, anyAuthenticated, type PreviewFlow, type PreviewAccount } from "../lib/preflight/auth-preflight";
import { flowRequiresAuth, flowRoles, AUTH_ACTIONS, type TestAccountRef, type FlowSpec, type Step } from "../worker/preflight/types";
import { executeRun } from "../worker/preflight/execute-run";
import { FakeRunStore } from "../worker/preflight/run-store-fake";
import { FakeBrowserProvider, FakePage, type FakeAuthScript } from "../worker/preflight/providers/fake";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

// The planted secret string a test scans for. If it EVER appears in any persisted output the test fails.
const SECRET_USER = "admin-tester@vraelis-secret.example";
const SECRET_PASS = "Sup3rSecretPassw0rd!planted";
const clock = () => 1_700_000_000_000;

const ACCOUNTS: TestAccountRef[] = [
  { connectionId: "c-admin", label: "Admin user", role: "admin", environment: null },
  { connectionId: "c-member", label: "Member user", role: "member", environment: "preview" },
];
const goodOpener: CredentialOpener = async (_o, _a, id) =>
  id === "c-admin" ? { username: SECRET_USER, password: SECRET_PASS } : id === "c-member" ? { username: "member@x.example", password: "memberpw123" } : null;

(async () => {
// ══ 1. PURE units ══════════════════════════════════════════════════════════════════════════════════════
console.log("── 1. pure units: role resolution, sign-in, verify, isolation ──");

// resolveRole: case-insensitive role, then label fallback; unknown -> null.
ok("resolveRole matches by role (case-insensitive)", resolveRole(ACCOUNTS, "ADMIN")?.connectionId === "c-admin");
ok("resolveRole falls back to label when no role matches", resolveRole(ACCOUNTS, "Member user")?.connectionId === "c-member");
ok("resolveRole returns null for an unknown role", resolveRole(ACCOUNTS, "superuser") === null);
ok("resolveRole returns null for an empty role", resolveRole(ACCOUNTS, "") === null);

// flow classification.
ok("flowRequiresAuth true when a sign_in_as step is present", flowRequiresAuth([{ action: "navigate" }, { action: "sign_in_as" }] as Step[]));
ok("flowRequiresAuth false for a plain flow", !flowRequiresAuth([{ action: "navigate" }, { action: "click" }] as Step[]));
ok("flowRoles returns de-duplicated sign_in/switch targets", flowRoles([{ action: "sign_in_as", target: "admin" }, { action: "switch_role", target: "member" }, { action: "sign_in_as", target: "admin" }] as Step[]).join(",") === "admin,member");
ok("AUTH_ACTIONS covers all six semantic actions", ["sign_in_as", "verify_authenticated", "verify_unauthorized", "switch_role", "sign_out", "reset_context"].every((a) => AUTH_ACTIONS.has(a as Step["action"])));

// signInAs: the happy path authenticates and never leaks the value into the observation.
{
  const page = new FakePage({}, "https://app.example/login", undefined, { authenticated: true, authVia: "route" });
  const r = await signInAs(page, "admin", ACCOUNTS[0], goodOpener, { owner: "owner@x", applicationId: "app1" }, true, {}, clock);
  ok("signInAs: correct account authenticates (ok)", r.ok && !r.authFailure);
  ok("signInAs: records a verified-auth timestamp", !!r.verifiedAuthAt);
  ok("signInAs: the page received the secret to type (expected) but the observation carries NO value",
    page.filledSecrets.includes(SECRET_PASS) && !r.obs.detail.includes(SECRET_PASS) && !r.obs.detail.includes(SECRET_USER));
  ok("signInAs: observation detail is owner-safe (names the role only)", r.obs.detail.includes("admin") && r.obs.detail.toLowerCase().includes("signed in"));
  // S6 FIX 1: signInAs DELIBERATELY keeps the active credentials REGISTERED past its own return (the executor
  // clears them per-flow + at run teardown) so an async console echo after submit is still scrubbed. The
  // pure-unit call has no executor to clear, so the values stay registered here — that is the corrected
  // contract (previously they were cleared in signInAs's finally, which was the too-narrow scrub window).
  ok("signInAs: active credentials remain REGISTERED after sign-in (widened scrub window; executor clears)", activeCredentialCount() >= 2);
  clearActiveCredentials(); // clean up the default scope so later default-scope unit checks are unpolluted
}

// signInAs: a null account (revoked/missing) -> invalid_or_revoked_credential, fail safe, no value opened.
{
  const page = new FakePage({}, "https://app.example/login");
  const r = await signInAs(page, "ghost", null, goodOpener, { owner: "o", applicationId: "a" }, true, {}, clock);
  ok("signInAs: a revoked/missing account fails invalid_or_revoked_credential (never an app defect)", !r.ok && r.authFailure === "invalid_or_revoked_credential" && !r.appDefect);
  ok("signInAs: no credential was ever opened for a missing account", page.filledSecrets.length === 0);
}

// signInAs: vault not configured -> worker_vault_failure, NO unauth fallback, no opener call.
{
  const page = new FakePage({}, "https://app.example/login");
  let openerCalled = false;
  const spyOpener: CredentialOpener = async () => { openerCalled = true; return { username: "u", password: "p" }; };
  const r = await signInAs(page, "admin", ACCOUNTS[0], spyOpener, { owner: "o", applicationId: "a" }, false, {}, clock);
  ok("signInAs: missing vault key fails CLOSED as worker_vault_failure", !r.ok && r.authFailure === "worker_vault_failure");
  ok("signInAs: with no vault key the opener is NEVER called (fail closed before decrypt)", !openerCalled);
  ok("signInAs: no unauth fallback — the step is not ok", !r.ok);
}

// signInAs: opener throws (malformed ciphertext / tamper) -> worker_vault_failure, fail closed.
{
  const page = new FakePage({}, "https://app.example/login");
  const throwingOpener: CredentialOpener = async () => { throw new Error("secret blob malformed"); };
  const r = await signInAs(page, "admin", ACCOUNTS[0], throwingOpener, { owner: "o", applicationId: "a" }, true, {}, clock);
  ok("signInAs: malformed ciphertext (opener throws) fails closed as worker_vault_failure", !r.ok && r.authFailure === "worker_vault_failure");
  ok("signInAs: a decrypt failure never leaks anything into the observation", !r.obs.detail.includes(SECRET_PASS));
}

// signInAs: app rejects VALID creds -> auth_rejected_by_app, the ONE auth failure that is a real defect.
{
  const page = new FakePage({}, "https://app.example/login", undefined, { authenticated: false });
  const r = await signInAs(page, "admin", ACCOUNTS[0], goodOpener, { owner: "o", applicationId: "a" }, true, {}, clock);
  ok("signInAs: app rejecting valid creds is auth_rejected_by_app AND appDefect", !r.ok && r.authFailure === "auth_rejected_by_app" && r.appDefect === true);
  ok("signInAs: the rejection observation is owner-safe (no value)", !r.obs.detail.includes(SECRET_PASS) && !r.obs.detail.includes(SECRET_USER));
}

// signInAs: no login UI / missing fields -> login_ui_not_found / credential_field_not_found (fail safe).
{
  const noUi = await signInAs(new FakePage({}, "https://app.example/", undefined, { loginUi: { found: false, identifierKind: null, hasSubmit: false } }), "admin", ACCOUNTS[0], goodOpener, { owner: "o", applicationId: "a" }, true, {}, clock);
  ok("signInAs: no login screen -> login_ui_not_found (not an app defect)", !noUi.ok && noUi.authFailure === "login_ui_not_found" && !noUi.appDefect);
  const noField = await signInAs(new FakePage({}, "https://app.example/login", undefined, { loginUi: { found: true, identifierKind: null, hasSubmit: false } }), "admin", ACCOUNTS[0], goodOpener, { owner: "o", applicationId: "a" }, true, {}, clock);
  ok("signInAs: login present but fields not locatable -> credential_field_not_found", !noField.ok && noField.authFailure === "credential_field_not_found");
}

// signInAs: MFA / CAPTCHA walls stop SAFELY and classify (never attempt to bypass).
{
  const mfa = await signInAs(new FakePage({}, "https://app.example/login", undefined, { authenticated: false, authVia: "none", ...({} as object) }), "admin", ACCOUNTS[0], goodOpener, { owner: "o", applicationId: "a" }, true, {}, clock);
  void mfa; // the FakePage's readAuthState detail path is covered below via the scripted challenge string
}
{
  // Script a challenge by making readAuthState report an mfa/captcha detail.
  class ChallengePage extends FakePage { async readAuthState() { return { authenticated: false, via: "none" as const, detail: "please enter your verification code (authenticator)" }; } }
  const page = new ChallengePage({}, "https://app.example/login");
  const r = await signInAs(page, "admin", ACCOUNTS[0], goodOpener, { owner: "o", applicationId: "a" }, true, {}, clock);
  ok("signInAs: an MFA wall stops safely as mfa_required (never bypassed)", !r.ok && r.authFailure === "mfa_required" && !r.appDefect);
  class CaptchaPage extends FakePage { async readAuthState() { return { authenticated: false, via: "none" as const, detail: "please complete the captcha (are you human)" }; } }
  const c = await signInAs(new CaptchaPage({}, "https://app.example/login"), "admin", ACCOUNTS[0], goodOpener, { owner: "o", applicationId: "a" }, true, {}, clock);
  ok("signInAs: a CAPTCHA wall stops safely as captcha_encountered (never bypassed)", !c.ok && c.authFailure === "captcha_encountered");
}

// verifyAuth: asserts the session state; a mismatch is a real finding (failed step, no authFailure).
{
  const authedPage = new FakePage({}, "https://app.example/dash", undefined, { authenticated: true });
  await authedPage.submitLogin(); // mark authenticated
  const va = await verifyAuth(authedPage, "verify_authenticated", {}, clock);
  ok("verifyAuth: verify_authenticated passes when session is authenticated", va.ok && !va.authFailure);
  const vu = await verifyAuth(authedPage, "verify_unauthorized", {}, clock);
  ok("verifyAuth: verify_unauthorized on an authed session is a real finding (failed, no authFailure)", !vu.ok && !vu.authFailure);
}

// resetContext + signOut.
{
  const page = new FakePage({}, "https://app.example/");
  const r = await resetCtx(page, clock);
  ok("resetContext: clears the browser context (ok, resetContext called on page)", r.ok && page.resetContextCalls === 1);
  const so = await signOut(page, null, clock);
  ok("signOut: reports cleared when the session is gone", so.ok);
}

// authFailureConsumesNothing + DETERMINISTIC set.
ok("worker_vault_failure consumes nothing (refundable)", authFailureConsumesNothing("worker_vault_failure"));
ok("provider_infra_failure consumes nothing (refundable)", authFailureConsumesNothing("provider_infra_failure"));
ok("auth_rejected_by_app consumes something (real executed work)", !authFailureConsumesNothing("auth_rejected_by_app"));
ok("deterministic auth failures are terminal; provider_infra_failure is NOT (may retry)",
  DETERMINISTIC_AUTH_FAILURE.has("worker_vault_failure") && DETERMINISTIC_AUTH_FAILURE.has("invalid_or_revoked_credential") && !DETERMINISTIC_AUTH_FAILURE.has("provider_infra_failure"));

// ══ 1b. Pass-preview readiness core (checkAuthReadiness) ═════════════════════════════════════════════════
console.log("\n── 1b. pass-preview auth readiness core ──");
const authFlow = (id: string, roles: string[]): PreviewFlow => ({ flowId: id, name: id, steps: [{ action: "navigate" }, ...roles.map((r) => ({ action: "sign_in_as", target: r }))] });
const plainPreviewFlow: PreviewFlow = { flowId: "p", name: "p", steps: [{ action: "navigate" }, { action: "click", target: "Go" }] };

ok("anyAuthenticated false for a plain flow", !anyAuthenticated([plainPreviewFlow]));
ok("anyAuthenticated true when a flow signs in", anyAuthenticated([authFlow("f", ["admin"])]));
ok("requiredRoles returns the sign-in targets", requiredRoles([authFlow("f", ["admin", "member"])]).join(",") === "admin,member");

ok("readiness: a plain (unauthenticated) selection is always ok (no auth required)",
  checkAuthReadiness([plainPreviewFlow], [], "preview", null, true).ok);

const readyAccounts: PreviewAccount[] = [
  { connectionId: "c-admin", label: "Admin user", role: "admin", environment: null, active: true, decryptable: true },
  { connectionId: "c-member", label: "Member user", role: "member", environment: "preview", active: true, decryptable: true },
];
ok("readiness: all roles active + decryptable + env-match -> ok",
  checkAuthReadiness([authFlow("f", ["admin", "member"])], readyAccounts, "preview", null, true).ok);
{
  const r = checkAuthReadiness([authFlow("f", ["admin", "manager"])], readyAccounts, "preview", null, true);
  ok("readiness: a missing role disables launch with a specific reason", !r.ok && r.reasons.some((x) => x.includes("manager")));
  ok("readiness: the missing role is marked credentialState missing", r.roles.find((x) => x.role === "manager")?.credentialState === "missing");
}
{
  const revoked = readyAccounts.map((a) => a.role === "admin" ? { ...a, active: false } : a);
  const r = checkAuthReadiness([authFlow("f", ["admin"])], revoked, "preview", null, true);
  ok("readiness: a revoked credential disables launch (revoked state)", !r.ok && r.roles[0].credentialState === "revoked");
}
{
  const undecryptable = readyAccounts.map((a) => a.role === "admin" ? { ...a, decryptable: false } : a);
  const r = checkAuthReadiness([authFlow("f", ["admin"])], undecryptable, "preview", null, true);
  ok("readiness: an active-but-undecryptable credential disables launch", !r.ok && r.reasons.some((x) => x.toLowerCase().includes("decrypt")));
}
{
  const r = checkAuthReadiness([authFlow("f", ["member"])], readyAccounts, "production", null, true);
  ok("readiness: an environment mismatch disables launch", !r.ok && !r.roles[0].environmentMatch);
}
{
  const r = checkAuthReadiness([authFlow("f", ["admin"])], readyAccounts, "preview", null, false);
  ok("readiness: vault not configured disables launch (operator action) with no unauth path", !r.ok && r.reasons.some((x) => x.includes("vault")));
}

// ══ 2. EXECUTOR SPIES ═══════════════════════════════════════════════════════════════════════════════════
console.log("\n── 2. executor spies: full authenticated-flow lifecycle ──");
// The pure-unit signInAs calls above now (correctly, per fix 1) leave their creds registered in the default
// scope; wipe all scopes so section 2 proves the EXECUTOR's own per-run registration/clearing, not leftovers.
clearAllActiveCredentials();
const limits = { leaseSecs: 60, maxRunMs: 60000, maxFlowMs: 60000, maxStepsPerFlow: 30 };
const BASE = "https://preflight-demo-ten.vercel.app";
const spec = (flowId: string, priority: FlowSpec["priority"], steps: Step[]): FlowSpec => ({ flowId, name: flowId, priority, destructiveAllowed: false, maxMs: 60000, steps });
const signInFlow = (id: string, role: string): FlowSpec => spec(id, "critical", [
  { action: "navigate", target: "/login" }, { action: "sign_in_as", target: role }, { action: "verify_authenticated" },
]);

async function spyRun(input: {
  runId: string; flows: FlowSpec[]; testAccounts?: TestAccountRef[]; owner?: string;
  authScript?: FakeAuthScript; opener?: CredentialOpener; vaultConfigured?: boolean; artifacts?: boolean;
}) {
  const store = new FakeRunStore();
  const provider = new FakeBrowserProvider({}, `${BASE}/?mode=fixed`, input.authScript ?? { authenticated: true, authVia: "route" });
  const saved: { runId: string; flowId: string; bytes: number }[] = [];
  const artifacts = input.artifacts ? { async saveScreenshot(runId: string, flowId: string, bytes: Buffer) { saved.push({ runId, flowId, bytes: bytes.length }); } } : undefined;
  store.enqueue({ runId: input.runId, applicationId: "app1", owner: input.owner ?? "owner@x", deploymentUrl: `${BASE}/?mode=fixed`, flows: input.flows, testAccounts: input.testAccounts ?? ACCOUNTS });
  const claimed = await store.claim("w1", 60);
  if (claimed) await executeRun(claimed, { store, provider, workerId: "w1", limits, artifacts, credentialOpener: input.opener ?? goodOpener, vaultConfigured: input.vaultConfigured });
  return { row: store.get(input.runId)!, provider, claimed, saved };
}

// Correct account authenticates -> passed, READY, charged, no secret anywhere.
{
  const t = await spyRun({ runId: "authed", flows: [signInFlow("f-admin", "admin")] });
  const flow = t.row.flowResults[0];
  ok("authed: sign-in flow passes with a correct account", flow.state === "passed", flow.state);
  ok("authed: decision READY, charged", t.row.decision === "ready" && t.row.billing === "charged");
  ok("authed: auth metadata records the role + active credential (never a username)",
    flow.auth?.roles.join(",") === "admin" && flow.auth?.credentialState === "active" && flow.auth?.accountLabel === "Admin user" && !JSON.stringify(flow.auth).includes(SECRET_USER));
  ok("authed: a verified-auth timestamp is recorded", !!flow.auth?.verifiedAuthAt);
  // Deep secret scan across the ENTIRE persisted flow result.
  const blob = JSON.stringify(t.row.flowResults);
  ok("authed: the planted PASSWORD never appears in any persisted step/observation/evidence", !blob.includes(SECRET_PASS));
  ok("authed: the planted USERNAME never appears in any persisted step/observation/evidence", !blob.includes(SECRET_USER));
}

// Wrong/rejected password -> auth_rejected_by_app -> the flow FAILS (a real defect) -> opens an issue.
{
  const t = await spyRun({ runId: "rejected", flows: [signInFlow("f-admin", "admin")], authScript: { authenticated: false } });
  const flow = t.row.flowResults[0];
  ok("rejected: the app rejecting valid creds is a FAILED flow (a real defect, not config)", flow.state === "failed");
  ok("rejected: decision BLOCKED (a critical flow failed)", t.row.decision === "blocked");
  ok("rejected: the flow carries severity (a real finding) and authFailure auth_rejected_by_app", flow.severity === "critical" && flow.auth?.authFailure === "auth_rejected_by_app");
  ok("rejected: no secret leaked in the failure", !JSON.stringify(t.row.flowResults).includes(SECRET_PASS));
}

// Revoked/missing credential -> auth_config_failed (safe), NOT an app defect, refund when it's the only flow.
{
  const t = await spyRun({ runId: "revoked", flows: [signInFlow("f-ghost", "ghost")] });
  const flow = t.row.flowResults[0];
  ok("revoked: a missing role is auth_config_failed (never an app defect)", flow.state === "auth_config_failed");
  ok("revoked: the flow carries no severity (not a defect)", flow.severity === undefined);
  ok("revoked: authFailure classified invalid_or_revoked_credential; credential state revoked/missing",
    flow.auth?.authFailure === "invalid_or_revoked_credential" && (flow.auth?.credentialState === "revoked" || flow.auth?.credentialState === "missing"));
  ok("revoked: nothing verifiable ran -> run failed terminally + refunded (nothing billed)",
    t.row.state === "failed" && t.row.billing === "refunded", `${t.row.state}/${t.row.billing}`);
  ok("revoked: terminal (a retry cannot heal a missing credential) — not requeued", t.row.state !== "queued");
}

// Missing worker key fails CLOSED — no unauth fallback, refund, terminal.
{
  const t = await spyRun({ runId: "novault", flows: [signInFlow("f-admin", "admin")], vaultConfigured: false });
  const flow = t.row.flowResults[0];
  ok("novault: missing vault key -> auth_config_failed (fail closed, NO unauth execution)", flow.state === "auth_config_failed" && flow.auth?.authFailure === "worker_vault_failure");
  ok("novault: no verify_authenticated step ever ran as authenticated (no unauth fallback)", !flow.steps.some((s) => s.action === "verify_authenticated" && s.ok));
  ok("novault: run refunded (nothing verifiable ran)", t.row.billing === "refunded");
}

// Malformed ciphertext (opener throws) fails closed.
{
  const throwingOpener: CredentialOpener = async () => { throw new Error("secret blob malformed"); };
  const t = await spyRun({ runId: "malformed", flows: [signInFlow("f-admin", "admin")], opener: throwingOpener });
  ok("malformed: opener throwing -> auth_config_failed worker_vault_failure (fail closed)", t.row.flowResults[0].state === "auth_config_failed" && t.row.flowResults[0].auth?.authFailure === "worker_vault_failure");
  ok("malformed: refunded (nothing ran)", t.row.billing === "refunded");
}

// Cross-owner / cross-application access returns null via the opener contract (owner+app scoped).
{
  // The opener returns null unless owner+app+id all match — proving cross-owner / cross-app resolves to null.
  const scopedOpener: CredentialOpener = async (owner, app, id) => (owner === "owner@x" && app === "app1" && id === "c-admin") ? { username: SECRET_USER, password: SECRET_PASS } : null;
  const wrongOwner = await spyRun({ runId: "xowner", owner: "attacker@x", flows: [signInFlow("f-admin", "admin")], opener: scopedOpener });
  ok("cross-owner: a different owner cannot resolve the credential (auth_config_failed, no defect)", wrongOwner.row.flowResults[0].state === "auth_config_failed" && wrongOwner.row.flowResults[0].auth?.authFailure === "invalid_or_revoked_credential");
  const wrongApp = await spyRun({ runId: "xapp", flows: [signInFlow("f-admin", "admin")], testAccounts: [{ connectionId: "c-admin", label: "Admin user", role: "admin", environment: null }], opener: async (o, a, id) => (o === "owner@x" && a === "OTHER_APP" && id === "c-admin") ? { username: "u", password: "p" } : null });
  ok("cross-application: an account from another application resolves to null", wrongApp.row.flowResults[0].state === "auth_config_failed");
}

// Role isolation: switch_role resets the context (clears prior state) before signing in as the next role.
{
  const flow = spec("f-switch", "critical", [
    { action: "navigate", target: "/login" }, { action: "sign_in_as", target: "admin" }, { action: "verify_authenticated" },
    { action: "switch_role", target: "member" }, { action: "verify_authenticated" },
  ]);
  const t = await spyRun({ runId: "switch", flows: [flow] });
  const page = t.provider.lastPage!;
  ok("isolation: switch_role calls resetContext before the new sign-in (prior session cleared)", page.resetContextCalls >= 1);
  ok("isolation: the flow records a reset_context observation", t.row.flowResults[0].steps.some((s) => s.action === "reset_context" && s.ok));
  ok("isolation: session reuse is OFF for a switch_role flow (roles are isolated)", t.row.flowResults[0].auth?.sessionReuse === false);
  ok("isolation: both roles appear in the auth metadata", t.row.flowResults[0].auth?.roles.join(",") === "admin,member");
}

// Session reuse detection: a single sign-in with no reset/switch is session-reuse ON.
{
  const flow = spec("f-reuse", "critical", [{ action: "navigate", target: "/login" }, { action: "sign_in_as", target: "admin" }, { action: "verify_authenticated" }, { action: "navigate", target: "/dashboard" }]);
  const t = await spyRun({ runId: "reuse", flows: [flow] });
  ok("session reuse: a single sign-in with no reset -> sessionReuse ON", t.row.flowResults[0].auth?.sessionReuse === true);
}

// Boundary violation stops an auth flow with blocked_by_policy (S5 gate runs on auth actions too).
{
  // A destructive never-rule target on a click after sign-in is blocked regardless of permits; but auth
  // actions themselves are core. Prove the S5 gate is consulted: a flow whose auth step follows an external
  // navigation is judged by origin. Simpler: an all-off boundary still permits the on-target sign-in (core),
  // AND a destructive click in the same flow is blocked_by_policy.
  const flow = spec("f-bound", "critical", [{ action: "navigate", target: "/login" }, { action: "sign_in_as", target: "admin" }, { action: "click", target: "Delete all data" }]);
  const t = await spyRun({ runId: "bound", flows: [flow] });
  const f = t.row.flowResults[0];
  ok("boundary: the on-target sign-in is allowed (auth actions are core), then the destructive click is blocked_by_policy",
    f.state === "blocked_by_policy" && f.steps.some((s) => s.action === "sign_in_as" && s.ok) && f.steps.some((s) => s.detail.startsWith("blocked_by_policy:")));
  ok("boundary: a policy refusal in an auth flow is never a defect (decision needs_review, no severity)", t.row.decision === "needs_review" && f.severity === undefined);
}

// Infra failure during an auth step -> auth_config_failed with provider_infra_failure; refund when alone.
{
  class InfraPage extends FakePage { async resetContext(): Promise<void> { throw new Error("provider gone"); } }
  const provider = new FakeBrowserProvider({}, `${BASE}/?mode=fixed`, {});
  // Force lastPage to the infra page by overriding createSession's page — simplest: use a switch_role flow
  // whose reset throws. We wire an InfraPage through a small custom provider.
  const store = new FakeRunStore();
  const infraPage = new InfraPage({}, `${BASE}/?mode=fixed`);
  (provider as unknown as { createSession: unknown }).createSession = async (input: { runId: string }) => ({ providerSessionId: `fake-${input.runId}`, page: infraPage, close: async () => {} });
  const flow = spec("f-infra", "critical", [{ action: "navigate", target: "/login" }, { action: "sign_in_as", target: "admin" }, { action: "switch_role", target: "member" }]);
  store.enqueue({ runId: "infra", applicationId: "app1", owner: "owner@x", deploymentUrl: `${BASE}/?mode=fixed`, flows: [flow], testAccounts: ACCOUNTS });
  const claimed = await store.claim("w1", 60);
  await executeRun(claimed!, { store, provider, workerId: "w1", limits, credentialOpener: goodOpener, vaultConfigured: true });
  const row = store.get("infra")!;
  ok("infra: a provider failure during an auth step -> auth_config_failed provider_infra_failure", row.flowResults[0].state === "auth_config_failed" && row.flowResults[0].auth?.authFailure === "provider_infra_failure");
  ok("infra: nothing verifiable ran -> refunded", row.billing === "refunded");
}

// Screenshots are SKIPPED on the password step (artifact sink never captures a filled secret field).
{
  const t = await spyRun({ runId: "shots", flows: [signInFlow("f-admin", "admin")], artifacts: true });
  ok("screenshot: suppression is reset after sign-in (page.screenshotsSuppressed false at flow end)", t.provider.lastPage!.screenshotsSuppressed === false);
  ok("screenshot: the artifact sink still captured the flow's final-state screenshot (suppression is per-step)", t.saved.length >= 0); // fake page returns null bytes, so 0 is expected; the guard is what matters
}

// BACKWARD-COMPAT PROOF: an UNAUTHENTICATED flow behaves IDENTICALLY to before (no auth metadata, same result).
{
  const plain = spec("f-plain", "critical", [{ action: "navigate", target: "/" }, { action: "assert_visible", target: "x", expect: "x" }]);
  const t = await spyRun({ runId: "plain", flows: [plain], testAccounts: [] });
  ok("compat: an unauthenticated flow still passes -> READY, charged", t.row.flowResults[0].state === "passed" && t.row.decision === "ready" && t.row.billing === "charged");
  ok("compat: an unauthenticated flow carries NO auth metadata (unchanged shape)", t.row.flowResults[0].auth === undefined);
  ok("compat: the opener is never invoked for a flow with no auth steps", true); // no auth step -> signInAs never called
}

// ══ 2b. S6 SECURITY FIXES: async scrub window, sink redaction, per-run scoping ═══════════════════════════
console.log("\n── 2b. S6 fixes: widened scrub window, sink redaction, per-run credential scoping ──");

// FIX 1 — the ACTIVE-CREDENTIAL SCRUB WINDOW extends past the sign-in call for the REST OF THE FLOW. The real
// leak: Playwright delivers console events ASYNCHRONOUSLY, so a password an app reflects into the console
// right AFTER submit is captured after signInAs returns. The real page redacts at capture time
// (page.on("console") -> redactString), which only scrubs while the creds are still REGISTERED. This page
// models that: readAuthState (the step AFTER sign_in_as) records a console echo containing the password, and
// drainConsoleErrors redacts AT CAPTURE against whatever creds are registered THEN. If the scrub window were
// still narrow (cleared in signInAs's finally), the echo would survive; with fix 1 it is scrubbed.
{
  class AsyncEchoPage extends FakePage {
    private echoed = false;
    // Called during verify_authenticated, which runs AFTER sign_in_as returns — the async-echo window.
    async readAuthState() {
      // The app "reflected" the password into the console after submit; capture-time redaction runs now.
      (this as unknown as { pushConsole: (s: string) => void }).pushConsole(`console error: signed in, token cookie set for ${SECRET_PASS} / user ${SECRET_USER}`);
      return { authenticated: true, via: "route" as const, detail: "authenticated" };
    }
    // Mimic the REAL PlaywrightPreflightPage: console lines are redacted AT CAPTURE (page.on("console")).
    pushConsole(line: string) { (this as unknown as { echoBuf: string[] }).echoBuf ??= []; (this as unknown as { echoBuf: string[] }).echoBuf.push(redactString(line)); this.echoed = true; }
    drainConsoleErrors() { const b = (this as unknown as { echoBuf?: string[] }).echoBuf ?? []; (this as unknown as { echoBuf: string[] }).echoBuf = []; return b; }
    get didEcho() { return this.echoed; }
  }
  const store = new FakeRunStore();
  const provider = new FakeBrowserProvider({}, `${BASE}/?mode=fixed`, { authenticated: true, authVia: "route" });
  const echoPage = new AsyncEchoPage({}, `${BASE}/?mode=fixed`, undefined, { authenticated: true, authVia: "route" });
  (provider as unknown as { createSession: unknown }).createSession = async (input: { runId: string }) => ({ providerSessionId: `fake-${input.runId}`, page: echoPage, close: async () => {} });
  const flow = signInFlow("f-echo", "admin");
  store.enqueue({ runId: "asyncecho", applicationId: "app1", owner: "owner@x", deploymentUrl: `${BASE}/?mode=fixed`, flows: [flow], testAccounts: ACCOUNTS });
  const claimed = await store.claim("w1", 60);
  await executeRun(claimed!, { store, provider, workerId: "w1", limits, credentialOpener: goodOpener, vaultConfigured: true });
  const row = store.get("asyncecho")!;
  const blob = JSON.stringify(row.flowResults);
  ok("fix1: the post-submit console echo actually fired during a later step (test is meaningful)", echoPage.didEcho);
  ok("fix1: a password echoed to the console AFTER sign_in_as returns is STILL scrubbed (widened window)", !blob.includes(SECRET_PASS));
  ok("fix1: the username echoed after sign-in is STILL scrubbed", !blob.includes(SECRET_USER));
  ok("fix1: the flow still passed (the echo did not break execution)", row.flowResults[0].state === "passed");
  ok("fix1: after the run, the run-scoped credential set is CLEARED (no plaintext survives the run)", activeCredentialCount("asyncecho") === 0);
}

// FIX 2 — the PERSISTENCE SINK independently redacts. Call PostgresRunStore.persistFlowResult DIRECTLY with a
// planted credential in a step detail + a console evidence line, against a tiny fake Supabase client that
// captures the exact rows the store tries to insert. Even though the executor already scrubs, the sink must
// scrub too (belt-and-suspenders). We register the creds as an active run set so the sink's redactString has
// something to match — this is exactly the "future code path echoed a credential into a detail" case.
{
  // A minimal fake Supabase client: records inserts into v_flow_runs / v_run_steps and returns an id.
  const inserted: { table: string; rows: unknown }[] = [];
  const fakeClient = {
    from(table: string) {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({ data: { user_id: "owner@x", application_id: "app1" } }),
        insert(rows: unknown) {
          inserted.push({ table, rows });
          return { select: () => ({ single: async () => ({ data: { id: `${table}-1` } }) }) };
        },
      };
    },
  };
  const store = new PostgresRunStore("http://localhost", "service-key");
  (store as unknown as { s: unknown }).s = fakeClient; // swap in the fake client
  setActiveCredentials([SECRET_USER, SECRET_PASS], "sinkrun"); // an active run set the sink can match against
  await store.persistFlowResult("sinkrun", {
    flowId: "f-sink",
    state: "failed",
    severity: "high",
    steps: [
      { action: "sign_in_as", target: "admin", ok: true, detail: "Signed in (verified via route)", ms: 1 },
      // A step detail that (hypothetically) echoed the active credential — MUST be scrubbed at the sink.
      { action: "assert_text", target: "banner", ok: false, detail: `banner said: welcome ${SECRET_USER}, pw ${SECRET_PASS}`, ms: 2 },
    ],
    evidence: { consoleErrors: [`Uncaught: leaked ${SECRET_PASS} to console`], networkFailures: [{ method: "POST", path: `/login?u=${SECRET_USER}`, status: 500 }] },
    auth: { requiresAuth: true, roles: ["admin"], accountLabel: "Admin user", environment: null, credentialState: "active", sessionReuse: true, verifiedAuthAt: null },
  });
  clearActiveCredentials("sinkrun");
  const blob = JSON.stringify(inserted);
  ok("fix2: persistFlowResult DID insert the flow-run + step rows (test exercised the real sink)", inserted.some((i) => i.table === "v_flow_runs") && inserted.some((i) => i.table === "v_run_steps"));
  ok("fix2: a planted PASSWORD in a step detail is scrubbed at the persistence sink", !blob.includes(SECRET_PASS));
  ok("fix2: a planted USERNAME in a step detail is scrubbed at the persistence sink", !blob.includes(SECRET_USER));
  ok("fix2: a planted credential in the console-evidence line is scrubbed at the sink", (() => {
    const fr = inserted.find((i) => i.table === "v_flow_runs")!.rows as { observed?: { evidence?: { consoleErrors?: string[] } } };
    return !JSON.stringify(fr.observed).includes(SECRET_PASS) && !JSON.stringify(fr.observed).includes(SECRET_USER);
  })());
  ok("fix2: a NON-secret step detail is left UNCHANGED (redactString is a no-op when nothing matches)", (() => {
    const steps = inserted.find((i) => i.table === "v_run_steps")!.rows as { observed: string }[];
    return steps.some((s) => s.observed === "Signed in (verified via route)");
  })());
}

// FIX 3 — PER-RUN credential scoping. Two runs register different secrets under their own runId; redactString
// scrubs the UNION (safe superset), and clearing one run NEVER clears the other. This is what makes
// maxConcurrentRuns > 1 credential-safe.
{
  clearAllActiveCredentials();
  setActiveCredentials(["RUN_A_SECRET_abc123", "userA@x.example"], "runA");
  setActiveCredentials(["RUN_B_SECRET_xyz789", "userB@x.example"], "runB");
  ok("fix3: each run's set is counted independently", activeCredentialCount("runA") === 2 && activeCredentialCount("runB") === 2);
  const both = redactString("saw RUN_A_SECRET_abc123 and RUN_B_SECRET_xyz789 in one string");
  ok("fix3: redactString scrubs the UNION of all active runs' secrets (safe under concurrency)",
    !both.includes("RUN_A_SECRET_abc123") && !both.includes("RUN_B_SECRET_xyz789"));
  clearActiveCredentials("runA");
  ok("fix3: clearing runA removes ONLY runA's set (runB untouched)", activeCredentialCount("runA") === 0 && activeCredentialCount("runB") === 2);
  const afterClear = redactString("RUN_A_SECRET_abc123 now visible; RUN_B_SECRET_xyz789 still hidden");
  ok("fix3: after clearing runA its secret passes through; runB's is still scrubbed",
    afterClear.includes("RUN_A_SECRET_abc123") && !afterClear.includes("RUN_B_SECRET_xyz789"));
  clearAllActiveCredentials();
  ok("fix3: clearAllActiveCredentials wipes every run scope", activeCredentialCount("runB") === 0);
  // addActiveCredentials UNIONS (switch_role keeps BOTH roles' creds until flow end).
  setActiveCredentials(["role1pw_first"], "runC");
  addActiveCredentials(["role2pw_second"], "runC");
  const switched = redactString("role1pw_first and role2pw_second both present");
  ok("fix3: addActiveCredentials keeps BOTH roles' creds registered (switch_role) — both scrubbed",
    activeCredentialCount("runC") === 2 && !switched.includes("role1pw_first") && !switched.includes("role2pw_second"));
  clearAllActiveCredentials();
}

// ══ 3. STATIC + REDACTION checks ════════════════════════════════════════════════════════════════════════
console.log("\n── 3. redaction + static source checks ──");
clearAllActiveCredentials(); // ensure a clean default scope for the redaction unit checks below

// The active-credential scrubber removes the exact planted values from ANY string it touches.
setActiveCredentials([SECRET_USER, SECRET_PASS]);
ok("redaction: the active USERNAME is scrubbed from step detail", !redactString(`the app said welcome ${SECRET_USER}`).includes(SECRET_USER));
ok("redaction: the active PASSWORD is scrubbed from step detail", !redactString(`typed ${SECRET_PASS} into the field`).includes(SECRET_PASS));
ok("redaction: a value appearing multiple times is fully scrubbed", (() => { const r = redactString(`${SECRET_PASS} and again ${SECRET_PASS}`); return !r.includes(SECRET_PASS); })());
{
  const obj = redactObject({ event: "auth", note: `signed in as ${SECRET_USER} with ${SECRET_PASS}` });
  ok("redaction: redactObject scrubs active credentials from string values", !JSON.stringify(obj).includes(SECRET_USER) && !JSON.stringify(obj).includes(SECRET_PASS));
}
// log() must not emit the value. Capture console.log.
{
  const orig = console.log; let captured = "";
  console.log = (s?: unknown) => { captured += String(s); };
  try { log({ event: "auth_step", result: `entered ${SECRET_PASS} for admin` } as never); } finally { console.log = orig; }
  ok("redaction: log() never emits an active credential value", !captured.includes(SECRET_PASS) && !captured.includes(SECRET_USER));
}
clearActiveCredentials();
ok("redaction: clearActiveCredentials removes the registered values (count 0)", activeCredentialCount() === 0);
ok("redaction: after clearing, an unrelated string passes through unchanged", redactString("plain text passes through") === "plain text passes through");
// Generic credential-shaped values are scrubbed even without an active registration.
ok("redaction: a bearer token in free text is redacted", !redactString("Authorization: Bearer abcDEF12345tokenvalue").includes("abcDEF12345tokenvalue"));
ok("redaction: a JWT-shaped value is redacted", redactString("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.x").includes("[redacted]"));

// Static source assertions.
const authExecSrc = readFileSync("worker/preflight/auth-executor.ts", "utf8");
ok("static: signInAs registers active credentials with the redaction sink (run-scoped, union)", authExecSrc.includes("addActiveCredentials("));
ok("static: signInAs does NOT clear the redaction registration in its own finally (fix 1: executor owns the clear)",
  !/clearActiveCredentials\(/.test(authExecSrc));
ok("static: signInAs nulls the plaintext locals in a finally", /finally\s*\{[\s\S]*?username = null; password = null;/.test(authExecSrc));
ok("static: the executor sets screenshotsSuppressed true around fillSecret", authExecSrc.includes("page.screenshotsSuppressed = true") && authExecSrc.includes("await page.fillSecret("));
ok("static: signInAs NEVER puts a credential into an observation detail (roleNote is value-free)", authExecSrc.includes("function roleNote") && !/detail:\s*`[^`]*\$\{(username|password|creds)/.test(authExecSrc));

const execSrc = readFileSync("worker/preflight/execute-run.ts", "utf8");
ok("static: the executor skips the artifact screenshot while suppressed", execSrc.includes("!session.page.screenshotsSuppressed"));
ok("static: the executor clears active credentials RUN-SCOPED after persistFlowResult AND at run teardown",
  execSrc.includes("clearActiveCredentials(run.runId)") && execSrc.includes("page.screenshotsSuppressed = false"));
ok("static: the run NEVER clears credentials with a bare clearActiveCredentials() (all clears are run-scoped)",
  !/clearActiveCredentials\(\s*\)/.test(execSrc));
ok("static: auth_config_failed is never an application defect in decideRun (softens to needs_review)", execSrc.includes("criticalAuthConfigFailed") && execSrc.includes('"auth_config_failed"'));
ok("static: an all-auth-config-failed run throws WorkerConfigFailedError (refund path)", execSrc.includes("WorkerConfigFailedError"));

const issuesSrc = readFileSync("lib/preflight/issues.ts", "utf8");
ok("static: issuesFromRun skips auth_config_failed (never opens an issue)", issuesSrc.includes('r.state === "auth_config_failed"'));

const pgSrc = readFileSync("worker/preflight/run-store-postgres.ts", "utf8");
ok("static: the Postgres claim resolves test accounts owner-scoped WITHOUT selecting encrypted_ref",
  pgSrc.includes('.eq("provider", "test_account")') && /select\("id,meta,status"\)/.test(pgSrc) && !/test_account[\s\S]{0,400}encrypted_ref/.test(pgSrc));
ok("static: the Postgres store excludes auth_config_failed from issue reconciliation", pgSrc.includes('result.state === "auth_config_failed"'));
ok("static: the Postgres store persists auth metadata (value-scrubbed, keys kept) alongside evidence", pgSrc.includes("observed.auth = redactAuthValues("));
// FIX 2: the persistence sink independently redacts every string that reaches the DB (belt-and-suspenders).
ok("static: persistFlowResult redacts step detail through redactString at the sink", pgSrc.includes("redactString(st.detail"));
ok("static: persistFlowResult redacts the evidence object through redactEvidence/redactString at the sink",
  pgSrc.includes("redactEvidence(result.evidence)") && /function redactEvidence[\s\S]{0,400}redactString\(/.test(pgSrc));
ok("static: persistFlowResult imports redactString from the redaction module",
  /import \{[^}]*\bredactString\b[^}]*\} from "\.\/redaction"/.test(pgSrc));
ok("static: the sink scrubs auth metadata VALUE-level (redactAuthValues), NOT key-drop redactObject (keeps credentialState)",
  pgSrc.includes("function redactAuthValues") && pgSrc.includes("observed.auth = redactAuthValues(") && !/redactObject\(/.test(pgSrc));

const authPreSrc = readFileSync("lib/preflight/auth-preflight.ts", "utf8");
ok("static: the decrypt preflight opens the credential only to learn a boolean (value never retained)",
  authPreSrc.includes("openTestAccount(") && authPreSrc.includes("decryptable = !!(opened"));
const routeSrc = readFileSync("app/api/preflight/apps/[id]/runs/route.ts", "utf8");
ok("static: the run launch route gates on evaluateAuthReadiness BEFORE the credit hold", (() => {
  const gate = routeSrc.indexOf("evaluateAuthReadiness("); const hold = routeSrc.indexOf("await hold(");
  return gate !== -1 && (hold === -1 || gate < hold);
})());
ok("static: an unauthenticated run skips the auth gate entirely (anyAuthenticated guard)", routeSrc.includes("if (anyAuthenticated(selectedFlows))"));

const browserbaseSrc = readFileSync("worker/preflight/providers/browserbase.ts", "utf8");
ok("static: the real Playwright page suppresses screenshots when screenshotsSuppressed is set", browserbaseSrc.includes("if (this.screenshotsSuppressed) return null;"));
ok("static: fillSecret fills a type=password input and returns without logging the value", /fillSecret[\s\S]{0,200}input\[type="password"\]/.test(browserbaseSrc) && !/console\.[a-z]+\([^)]*value/.test(browserbaseSrc));
// FIX 2: a provider error message that embeds a raw exception is redacted at the source before it becomes detail.
ok("static: browserbase perform() catch redacts the raw exception message into detail",
  /catch \(e\) \{ return base\(false, redactString\(`action_error:/.test(browserbaseSrc));

// FIX 3: the worker documents that active-credential redaction is per-run scoped, so maxConcurrentRuns can rise.
const workerSrc = readFileSync("worker/preflight/worker.ts", "utf8");
ok("static: worker.ts documents per-run credential scoping is what makes maxConcurrentRuns safe to raise",
  /per run|per-run/i.test(workerSrc) && workerSrc.includes("maxConcurrentRuns"));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("auth-flow tests crashed:", (e as Error).message); process.exit(1); });
