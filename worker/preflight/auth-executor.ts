// Authenticated-flow execution (S6). The executor calls into here for every semantic auth step
// (sign_in_as / verify_authenticated / verify_unauthorized / switch_role / sign_out / reset_context). It is
// deliberately separated from execute-run so the SECURITY-critical credential handling is small, auditable,
// and unit-testable with a fake page + a fake credential opener (no DB, no browser).
//
// SECURITY CONTRACT (fail closed, non-negotiable):
//   - A credential is decrypted ONLY here, ONLY immediately before use, and its plaintext lives ONLY in
//     this function's local variables. It is NEVER returned, NEVER put into a StepObservation.detail,
//     NEVER logged, NEVER attached to an artifact. The username/password are registered with the redaction
//     layer (addActiveCredentials, run-scoped) so any accidental echo elsewhere is scrubbed at the sink. The
//     LOCALS are nulled the instant sign-in completes; the redaction registration is kept for the rest of
//     the flow (the executor clears it in its per-flow finally + at run teardown) so an async console echo
//     after submit is still scrubbed.
//   - The password-entry step marks the page so the artifact sink SKIPS a screenshot of the filled field.
//   - A missing/revoked credential, a missing vault key, a decrypt failure, MFA, CAPTCHA, or a provider
//     failure NEVER falls back to unauthenticated execution: the step fails with a distinct AuthFailureCode
//     and the flow ends. Only auth_rejected_by_app (the app refused VALID creds) is a real defect.
import type { AuthFailureCode, AuthState, PreflightPage, Step, StepObservation, TestAccountRef } from "./types";
import { addActiveCredentials } from "./redaction";

// Opens a role's sealed credential (owner + application scoped) at the moment of use. This is EXACTLY the
// signature of lib/preflight/connections-db.openTestAccount, so the worker injects that function directly;
// tests inject a fake. Returns null when the credential is revoked/missing (owner/app/id resolves to
// nothing). THROWS only for a vault failure (missing/malformed key, decrypt/tamper) — the executor
// classifies that as worker_vault_failure. NEVER logs/returns the value anywhere but this call's result.
export type CredentialOpener = (owner: string, applicationId: string, connectionId: string) => Promise<{ username: string; password: string } | null>;

// The result of one auth action: a deterministic observation plus the flow-level consequence. `authFailure`
// is set only on a failure that is NOT an application defect (fail-safe); `appDefect` true means the app
// rejected valid creds (a real broken-login finding -> the flow FAILS like any broken journey).
export type AuthActionResult = {
  obs: StepObservation;
  ok: boolean;
  authFailure?: AuthFailureCode;
  appDefect?: boolean;             // true only for auth_rejected_by_app
  verifiedAuthAt?: string;         // ISO of a confirmed successful authentication
};

// A short, OWNER-SAFE detail for a role. Never contains a username; only the role label the flow declared.
function roleNote(verb: string, role: string): string { return `${verb} for role "${role}"`.slice(0, 200); }

// Detect a challenge wall (MFA / CAPTCHA / bot protection) from OWNER-SAFE observed structure only. We
// NEVER attempt to solve one — we stop safely and classify. The page reports this via readAuthState.detail
// or the login UI; here we key off a small, conservative marker the page sets.
function challengeFromAuthDetail(detail: string): AuthFailureCode | null {
  const d = (detail || "").toLowerCase();
  if (/\b(mfa|2fa|one[-\s]?time|otp|verification code|authenticator)\b/.test(d)) return "mfa_required";
  if (/\b(captcha|recaptcha|hcaptcha|are you human|bot)\b/.test(d)) return "captcha_encountered";
  return null;
}

// Resolve a role LABEL to one of the run's approved test accounts (metadata only). Case-insensitive on the
// role, then the label, so a flow's "Admin" target matches meta.role "admin" or a label "Admin user".
export function resolveRole(accounts: TestAccountRef[], role: string): TestAccountRef | null {
  const want = (role || "").trim().toLowerCase();
  if (!want) return null;
  return accounts.find((a) => (a.role || "").trim().toLowerCase() === want)
    ?? accounts.find((a) => (a.label || "").trim().toLowerCase() === want)
    ?? null;
}

// The core sign-in. Returns an AuthActionResult; NEVER throws for a credential/auth problem (those become
// classified failures). Only a genuinely unexpected provider error propagates to the executor's catch.
// HOW LONG A SIGN-IN IS GIVEN TO BECOME OBSERVABLE.
//
// submitLogin resolves when the CLICK is done, not when the application has signed anyone in. Reading the
// session state at that instant asks whether an app is authenticated before it has had a chance to be.
//
// Measured against the demo deployment, from the click:
//     53ms   not authenticated, "still on the login screen"
//    567ms   the browser is on /dashboard, still no session evidence
//   1094ms   authenticated
//
// The old code read once, immediately, and turned that first observation into auth_rejected_by_app, whose
// own comment reads "the app refused VALID creds". Three consecutive production runs against an application
// whose sign-in works by hand were published as the customer's login being broken.
//
// Bounded by ATTEMPTS rather than wall-clock, because `now` is injectable and the suites freeze it; a
// deadline computed from a frozen clock never expires. A rejection still resolves as a rejection, it just
// takes the full window first, which is the right trade: a slow no is recoverable, a false no is not.
const AUTH_SETTLE = { attempts: 40, delayMs: 200 } as const;   // up to 8s

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Poll until the session becomes observable, the app declares a challenge, or the window closes. Returns
// the LAST state seen, so nothing here can manufacture a pass: only readAuthState decides.
async function settleAuthState(
  page: PreflightPage,
  expect: { route?: string; element?: string },
  settle: { attempts: number; delayMs: number },
): Promise<AuthState> {
  let state: AuthState = { authenticated: false, via: "none", detail: "no session evidence" };
  for (let i = 0; i < Math.max(1, settle.attempts); i++) {
    state = await page.readAuthState({ expectRoute: expect.route, expectElement: expect.element });
    if (state.authenticated) return state;
    // An MFA or CAPTCHA wall is a final answer, not something to wait out.
    if (challengeFromAuthDetail(state.detail)) return state;
    if (i < settle.attempts - 1 && settle.delayMs > 0) await sleep(settle.delayMs);
  }
  return state;
}

export async function signInAs(
  page: PreflightPage,
  role: string,
  account: TestAccountRef | null,
  opener: CredentialOpener,
  identity: { owner: string; applicationId: string; runId?: string },
  vaultConfigured: boolean,
  expect: { route?: string; element?: string },
  now: () => number,
  settle: { attempts: number; delayMs: number } = AUTH_SETTLE,
): Promise<AuthActionResult> {
  const t0 = now();
  const fail = (detail: string, authFailure: AuthFailureCode): AuthActionResult => ({
    obs: { action: "sign_in_as", target: role, ok: false, detail: detail.slice(0, 200), ms: now() - t0 },
    ok: false, authFailure,
  });

  // 1. The role must resolve to an approved, present account. A revoked/deleted account resolves to null.
  if (!account) return fail(`No active credential for role "${role}" (missing or revoked)`, "invalid_or_revoked_credential");

  // 2. Fail CLOSED if the vault is not configured: never fall back to unauthenticated execution.
  if (!vaultConfigured) return fail(roleNote("The worker vault is not configured; could not authenticate", role), "worker_vault_failure");

  // 3. Decrypt at the moment of use. A null return = revoked between claim and use (fail safe); a THROW =
  //    vault failure (missing/malformed key, tamper) -> worker_vault_failure, NEVER unauth fallback.
  let creds: { username: string; password: string } | null = null;
  try {
    creds = await opener(identity.owner, identity.applicationId, account.connectionId);
  } catch {
    return fail(roleNote("Could not decrypt the credential for authentication", role), "worker_vault_failure");
  }
  if (!creds || !creds.username || !creds.password) {
    return fail(`No active credential for role "${role}" (missing or revoked)`, "invalid_or_revoked_credential");
  }

  // Register the exact plaintext values with the redaction sink so any accidental echo (in an error banner
  // the app reflects, say) is scrubbed everywhere it could be persisted. Registration is scoped to this run
  // and — critically — is NOT cleared when this call returns: the executor keeps it for the REST OF THE FLOW
  // (cleared in its per-flow finally, after the flow's last observation is persisted) because Playwright
  // delivers console events asynchronously, so a password the app reflects into the console right after
  // submit can be captured AFTER sign-in returns. addActiveCredentials UNIONS with any prior role's values
  // (switch_role) so both stay scrubbed until flow end.
  let username: string | null = creds.username;
  let password: string | null = creds.password;
  addActiveCredentials([username, password], identity.runId);
  // Drop the returned object reference immediately; only the two locals hold the plaintext now.
  creds = null;

  try {
    // 4. Detect the login UI by accessible structure. No login screen where sign-in was required is a
    //    login_ui_not_found failure (fail safe — not an app defect: the flow may simply be pointed wrong).
    const ui = await page.detectLoginUi();
    if (!ui.found) return fail(roleNote("No login screen was found where authentication was required", role), "login_ui_not_found");
    if (!ui.identifierKind || !ui.hasSubmit) {
      return fail(roleNote("The login form's fields could not be located", role), "credential_field_not_found");
    }

    // 5. Fill the identity field, then the SECRET field. The page marks screenshots suppressed while the
    //    password is entered so the artifact sink never captures a filled secret field.
    const idOk = await page.fillIdentifier(ui.identifierKind, username);
    if (!idOk) return fail(roleNote("The identity field could not be filled", role), "credential_field_not_found");

    page.screenshotsSuppressed = true;
    let secretOk = false;
    try {
      secretOk = await page.fillSecret(password);
    } finally {
      page.screenshotsSuppressed = false;
    }
    // The password value is no longer needed; drop the local reference right away.
    password = null;
    if (!secretOk) return fail(roleNote("The password field could not be filled", role), "credential_field_not_found");

    // 6. Submit. A submit failure is a field/UI problem, not an app rejection.
    const submitted = await page.submitLogin();
    if (!submitted) return fail(roleNote("The login form could not be submitted", role), "credential_field_not_found");

    // 7. VERIFY the session by DETERMINISTIC observed evidence — never claim success just because submit
    //    was clicked. An expected route OR a visible authenticated element OR a session/cookie presence.
    const state = await settleAuthState(page, expect, settle);
    const chal = challengeFromAuthDetail(state.detail);
    if (chal) {
      // MFA / CAPTCHA: stop safely, classify, manual setup required. NEVER attempt to bypass.
      return fail(roleNote(chal === "mfa_required" ? "Multi-factor authentication is required (manual setup required)" : "A CAPTCHA / bot check was encountered (manual setup required)", role), chal);
    }
    if (!state.authenticated) {
      // The app rejected VALID test credentials. THIS is the one auth failure that is a real defect: a
      // broken login. The observation stays owner-safe (no value); the executor marks the flow failed.
      return {
        obs: { action: "sign_in_as", target: role, ok: false, detail: roleNote("The application rejected valid test credentials at sign-in", role), ms: now() - t0 },
        ok: false, authFailure: "auth_rejected_by_app", appDefect: true,
      };
    }

    const verifiedAuthAt = new Date(now()).toISOString();
    return {
      obs: { action: "sign_in_as", target: role, ok: true, detail: roleNote(`Signed in (verified via ${state.via})`, role), ms: now() - t0 },
      ok: true, verifiedAuthAt,
    };
  } finally {
    // Plaintext is dropped from OUR LOCALS no matter how we exit. The redaction sink registration is
    // DELIBERATELY kept past this call (the executor clears the run's set in its per-flow finally, after the
    // flow's last observation is persisted, and again at run teardown): a password an app reflects into the
    // console right after submit arrives ASYNCHRONOUSLY and would otherwise be captured unredacted here.
    username = null; password = null;
  }
}

// verify_authenticated / verify_unauthorized: assert the CURRENT session state against observed evidence.
export async function verifyAuth(
  page: PreflightPage,
  action: "verify_authenticated" | "verify_unauthorized",
  expect: { route?: string; element?: string },
  now: () => number,
): Promise<AuthActionResult> {
  const t0 = now();
  let state: AuthState;
  try { state = await page.readAuthState({ expectRoute: expect.route, expectElement: expect.element }); }
  catch { return { obs: { action, ok: false, detail: "could not read session state", ms: now() - t0 }, ok: false, authFailure: "provider_infra_failure" }; }
  const wantAuthed = action === "verify_authenticated";
  const ok = state.authenticated === wantAuthed;
  return {
    obs: { action, ok, detail: (ok ? `session is ${wantAuthed ? "authenticated" : "unauthorized"} as expected` : `session is ${state.authenticated ? "authenticated" : "unauthorized"} (expected ${wantAuthed ? "authenticated" : "unauthorized"})`).slice(0, 200), ms: now() - t0 },
    ok,
    // A verify mismatch is a real finding about the app's authorization behavior (e.g. a page that should be
    // gated was reachable, or a valid session was not recognized) -> a normal failed step, no authFailure.
  };
}

// sign_out: perform the app's logout, then confirm the session is gone. A logout that does not clear the
// session is a real finding (failed), not a worker config problem.
export async function signOut(
  page: PreflightPage,
  logoutStep: Step | null,
  now: () => number,
  settle: { attempts: number; delayMs: number } = AUTH_SETTLE,
): Promise<AuthActionResult> {
  const t0 = now();
  try {
    if (logoutStep) await page.perform(logoutStep);
    // THE SAME RACE, IN REVERSE. Clicking sign out returns when the click is done, not when the session is
    // gone, and reading once at that instant reports "sign-out did not clear the session" against an
    // application that was about to clear it. Poll until it IS gone, and only then decide.
    let state: AuthState = { authenticated: true, via: "none", detail: "session still present" };
    for (let i = 0; i < Math.max(1, settle.attempts); i++) {
      state = await page.readAuthState();
      if (!state.authenticated) break;
      if (i < settle.attempts - 1 && settle.delayMs > 0) await sleep(settle.delayMs);
    }
    const ok = !state.authenticated;
    return { obs: { action: "sign_out", ok, detail: (ok ? "signed out; session cleared" : "sign-out did not clear the session").slice(0, 200), ms: now() - t0 }, ok };
  } catch {
    return { obs: { action: "sign_out", ok: false, detail: "sign-out could not complete", ms: now() - t0 }, ok: false, authFailure: "provider_infra_failure" };
  }
}

// reset_context: clear cookies/storage and open a fresh browser context. Used by switch_role between roles
// so a prior role's session can never leak into the next. Never a defect; a provider failure is infra.
export async function resetContext(page: PreflightPage, now: () => number): Promise<AuthActionResult> {
  const t0 = now();
  try {
    await page.resetContext();
    return { obs: { action: "reset_context", ok: true, detail: "cleared cookies + storage; fresh context", ms: now() - t0 }, ok: true };
  } catch {
    return { obs: { action: "reset_context", ok: false, detail: "could not reset the browser context", ms: now() - t0 }, ok: false, authFailure: "provider_infra_failure" };
  }
}

// Map an AuthFailureCode to whether it should REFUND when it was the only thing that "ran" (nothing billable
// executed). Vault/infra/config failures consume nothing; an app rejection is real executed work.
export function authFailureConsumesNothing(code: AuthFailureCode): boolean {
  return code === "worker_vault_failure" || code === "provider_infra_failure";
}

// Worker-config auth failures that a retry cannot heal WITHOUT operator action (a missing/malformed vault
// key, a revoked/missing credential, a missing login UI/field, an MFA/CAPTCHA wall). These are TERMINAL in
// both run stores, matching blocked_by_policy. provider_infra_failure is deliberately EXCLUDED — a provider
// blip may clear on retry, so it follows the normal attempt-count path. auth_rejected_by_app is never a
// run-level failure code (it is a normal failed flow), so it is not listed here.
export const DETERMINISTIC_AUTH_FAILURE: ReadonlySet<string> = new Set<string>([
  "worker_vault_failure", "invalid_or_revoked_credential",
  "login_ui_not_found", "credential_field_not_found",
  "mfa_required", "captcha_encountered",
]);
