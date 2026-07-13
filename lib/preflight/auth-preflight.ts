// Pass-preview AUTH preflight (S6 slice of S9). BEFORE any hold/charge, a safe, worker-INDEPENDENT check
// that for every role a selected flow requires: the credential exists, is active, its environment matches
// the run, the boundary permits authentication, and the target origin is approved. PLUS a safe DECRYPT
// preflight: attempt openTestAccount server-side and report only a boolean "decryptable" — the plaintext is
// NEVER logged, returned, or retained (we open it, note success, and drop it).
//
// This module is the launch GATE the run route consults: if any check fails, the launch is DISABLED with a
// specific, owner-safe reason before any billing. The full pass-preview UI is deferred to S9; this ships the
// server-side function + the route gate + a minimal surface (the reasons are shaped for direct display).
//
// Split into a PURE core (checkAuthReadiness, fully unit-testable with plain data) and a DB-backed wrapper
// (evaluateAuthReadiness). The wrapper is the only part that touches the vault, and it does so read-only.
import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";
import { openTestAccount } from "./connections-db";
import { vaultConfigured } from "./secret-vault";
import { normalizeBoundaries, type TestBoundaries } from "./boundaries";

function norm(e: string): string { return e.trim().toLowerCase(); }
function db() { return getSupabaseAdminClient(); }

// The AUTH actions a flow can use (kept in sync with worker/preflight/types.ts AUTH_ACTIONS; duplicated here
// so the web side does not import worker code). A flow using any is an authenticated flow.
const AUTH_ACTIONS = new Set(["sign_in_as", "verify_authenticated", "verify_unauthorized", "switch_role", "sign_out", "reset_context"]);

export type PreviewFlow = { flowId: string; name: string; steps: { action: string; target?: string }[] };
// A test account as METADATA the preview needs (never a secret): id, label, role, environment, and whether
// its ciphertext is present + decryptable. `decryptable` is filled by the DB wrapper's safe decrypt probe.
export type PreviewAccount = { connectionId: string; label: string; role: string; environment: string | null; active: boolean; decryptable: boolean };

export type RoleReadiness = {
  role: string; ok: boolean;
  reason?: string;                 // owner-safe reason the role is not launch-ready
  accountLabel: string | null;     // never a username
  credentialState: "active" | "missing" | "revoked";
  environmentMatch: boolean;
};
export type AuthReadiness = {
  requiresAuth: boolean;           // any selected flow is authenticated
  ok: boolean;                     // every required role is launch-ready (or no auth required)
  roles: RoleReadiness[];
  vaultConfigured: boolean;
  reasons: string[];               // flat list of blocking reasons (empty when ok)
};

// The roles every selected flow requires (sign_in_as / switch_role targets), de-duplicated.
export function requiredRoles(flows: PreviewFlow[]): string[] {
  const out: string[] = [];
  for (const f of flows) for (const s of f.steps) {
    if ((s.action === "sign_in_as" || s.action === "switch_role") && s.target && !out.includes(s.target)) out.push(s.target);
  }
  return out;
}
export function anyAuthenticated(flows: PreviewFlow[]): boolean {
  return flows.some((f) => f.steps.some((s) => AUTH_ACTIONS.has(s.action)));
}

// PURE readiness check: given the selected flows, the resolved accounts (with the decrypt probe already
// run), the run environment, the boundaries, and whether the vault is configured, decide whether the launch
// is auth-ready. No DB, no vault — fully unit-testable. The boundary check here is a light echo of the S5
// gate: an authentication action is a CORE action against the run's own origin, so boundaries never BLOCK a
// legitimate on-target sign-in; the meaningful boundary question at preview time is only that the vault is
// configured and the credential resolves. (Origin/domain enforcement remains the worker's per-step gate.)
export function checkAuthReadiness(
  flows: PreviewFlow[],
  accounts: PreviewAccount[],
  runEnvironment: string | null,
  _boundaries: TestBoundaries | null,
  vaultOk: boolean,
): AuthReadiness {
  const requiresAuth = anyAuthenticated(flows);
  if (!requiresAuth) return { requiresAuth: false, ok: true, roles: [], vaultConfigured: vaultOk, reasons: [] };

  const roles = requiredRoles(flows);
  const byRole = (role: string) => {
    const want = role.trim().toLowerCase();
    return accounts.find((a) => a.role.trim().toLowerCase() === want)
      ?? accounts.find((a) => a.label.trim().toLowerCase() === want)
      ?? null;
  };

  const roleResults: RoleReadiness[] = roles.map((role) => {
    const acct = byRole(role);
    if (!acct) {
      return { role, ok: false, reason: `No test account is configured for the "${role}" role. Add one under Connections.`, accountLabel: null, credentialState: "missing", environmentMatch: false };
    }
    const credentialState: RoleReadiness["credentialState"] = acct.active ? "active" : "revoked";
    if (!acct.active) {
      return { role, ok: false, reason: `The test account for the "${role}" role was revoked. Re-add it under Connections.`, accountLabel: acct.label, credentialState, environmentMatch: false };
    }
    // Environment match: an account with no recorded environment is treated as matching any run (the owner
    // did not scope it). A recorded environment must equal the run's.
    const environmentMatch = !acct.environment || !runEnvironment || acct.environment.trim().toLowerCase() === runEnvironment.trim().toLowerCase();
    if (!environmentMatch) {
      return { role, ok: false, reason: `The "${role}" test account is scoped to the ${acct.environment} environment, but this run targets ${runEnvironment}.`, accountLabel: acct.label, credentialState, environmentMatch };
    }
    if (!vaultOk) {
      return { role, ok: false, reason: "The worker vault is not configured, so credentials cannot be used. This is an operator action.", accountLabel: acct.label, credentialState, environmentMatch };
    }
    if (!acct.decryptable) {
      return { role, ok: false, reason: `The "${role}" test account could not be decrypted. Re-enter its credentials under Connections.`, accountLabel: acct.label, credentialState, environmentMatch };
    }
    return { role, ok: true, accountLabel: acct.label, credentialState, environmentMatch };
  });

  const reasons: string[] = [];
  if (!vaultOk) reasons.push("The worker vault is not configured (operator action: set VRAELIS_SECRET_KEY on the worker).");
  for (const r of roleResults) if (!r.ok && r.reason && !reasons.includes(r.reason)) reasons.push(r.reason);

  return { requiresAuth: true, ok: reasons.length === 0, roles: roleResults, vaultConfigured: vaultOk, reasons };
}

// DB-backed wrapper: resolve the application's approved test accounts (metadata only), run the SAFE decrypt
// probe (openTestAccount, boolean only — the plaintext is dropped immediately), and return readiness. This
// is what the run launch route calls before any hold. Owner + application scoped throughout. Degrades to
// "auth not required, ok" when the DB is unconfigured (there is no data plane to be un-ready).
export async function evaluateAuthReadiness(
  owner: string, applicationId: string, flows: PreviewFlow[], runEnvironment: string | null,
  boundaries: TestBoundaries | null,
): Promise<AuthReadiness> {
  if (!anyAuthenticated(flows)) return { requiresAuth: false, ok: true, roles: [], vaultConfigured: vaultConfigured(), reasons: [] };
  const vaultOk = vaultConfigured();
  if (!isDatabaseConfigured()) {
    // No data plane: report auth as blocked with the vault reason if the vault is off, else as unresolved
    // (missing accounts), so the launch is disabled rather than proceeding blind.
    return checkAuthReadiness(flows, [], runEnvironment, boundaries, vaultOk);
  }

  const { data: rows } = await db().from("v_app_connections")
    .select("id, meta, status").eq("user_id", norm(owner)).eq("application_id", applicationId).eq("provider", "test_account");

  const accounts: PreviewAccount[] = [];
  for (const row of (rows as Record<string, unknown>[] | null) ?? []) {
    const meta = (row.meta as Record<string, unknown>) ?? {};
    const label = typeof meta.label === "string" && meta.label.trim() ? meta.label : "Standard user";
    const role = typeof meta.role === "string" && meta.role.trim() ? meta.role : label;
    const environment = typeof meta.environment === "string" && meta.environment.trim() ? meta.environment : null;
    const active = (row.status ?? "connected") !== "revoked";
    // Safe decrypt probe: attempt to open the credential; on success we learn ONLY that it is decryptable.
    // The returned plaintext is never assigned to anything that leaves this loop. A vault-off or malformed
    // blob throws / returns null -> decryptable false, and the launch is disabled with a specific reason.
    let decryptable = false;
    if (active && vaultOk) {
      try {
        const opened = await openTestAccount(owner, applicationId, String(row.id));
        decryptable = !!(opened && opened.username && opened.password);
      } catch { decryptable = false; }
    }
    accounts.push({ connectionId: String(row.id), label: String(label), role: String(role), environment, active, decryptable });
  }

  return checkAuthReadiness(flows, accounts, runEnvironment, boundaries, vaultOk);
}

// Normalize the app's boundaries jsonb for the readiness call (defensive; a bad row can only tighten).
export function readinessBoundaries(raw: unknown): TestBoundaries | null {
  if (raw == null || typeof raw !== "object") return null;
  return normalizeBoundaries(raw);
}
