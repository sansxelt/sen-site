import { createHash, randomBytes } from "node:crypto";
import { getSupabaseAdminClient } from "./supabase-admin";

export const DESKTOP_REQUEST_TTL_MIN = 15;

export type DesktopRequestStatus =
  | "pending"
  | "approved"
  | "redeemed"
  | "expired";

export type DesktopAuthRequest = {
  request_id: string;
  email: string | null;
  status: DesktopRequestStatus;
  device_label: string | null;
  created_at: string;
  approved_at: string | null;
  redeemed_at: string | null;
  expires_at: string;
};

export type DesktopSession = {
  id: string;
  email: string;
  token_hash: string;
  device_label: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

// Tokens are 32 random bytes, base64url-encoded (43 chars). We never
// store the raw token, only sha256(token), so a database leak alone
// can't sign anyone in.
export function generateSessionToken(): { token: string; hash: string } {
  const raw = randomBytes(32);
  const token = raw.toString("base64url");
  const hash = sha256Hex(token);
  return { token, hash };
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// ── desktop_auth_requests ────────────────────────────────────────────

export async function createDesktopAuthRequest(
  deviceLabel: string | null,
): Promise<DesktopAuthRequest> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("desktop_auth_requests" as never)
    .insert([{ device_label: deviceLabel }] as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as DesktopAuthRequest;
}

export async function getDesktopAuthRequest(
  requestId: string,
): Promise<DesktopAuthRequest | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("desktop_auth_requests" as never)
    .select("*")
    .eq("request_id", requestId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as DesktopAuthRequest) ?? null;
}

export async function approveDesktopAuthRequest(
  requestId: string,
  email: string,
): Promise<DesktopAuthRequest> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("desktop_auth_requests" as never)
    .update({
      email,
      status: "approved",
      approved_at: new Date().toISOString(),
    } as never)
    .eq("request_id", requestId)
    .eq("status", "pending")
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as DesktopAuthRequest;
}

export async function markRequestRedeemed(requestId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("desktop_auth_requests" as never)
    .update({
      status: "redeemed",
      redeemed_at: new Date().toISOString(),
    } as never)
    .eq("request_id", requestId)
    .eq("status", "approved");
  if (error) throw error;
}

export function isRequestUsable(req: DesktopAuthRequest): boolean {
  return (
    req.status !== "redeemed" &&
    req.status !== "expired" &&
    new Date(req.expires_at).getTime() > Date.now()
  );
}

// ── desktop_sessions ────────────────────────────────────────────────

export async function createDesktopSession(
  email: string,
  tokenHash: string,
  deviceLabel: string | null,
): Promise<DesktopSession> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("desktop_sessions" as never)
    .insert([
      {
        email,
        token_hash: tokenHash,
        device_label: deviceLabel,
      },
    ] as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as DesktopSession;
}

export async function findActiveSessionByToken(
  token: string,
): Promise<DesktopSession | null> {
  const supabase = getSupabaseAdminClient();
  const tokenHash = sha256Hex(token);
  const { data, error } = await supabase
    .from("desktop_sessions" as never)
    .select("*")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as DesktopSession) ?? null;
}

export async function touchSession(sessionId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("desktop_sessions" as never)
    .update({ last_used_at: new Date().toISOString() } as never)
    .eq("id", sessionId);
}

// ── Bearer-token auth for desktop API calls ─────────────────────────

// Pulls the desktop session token off an Authorization: Bearer header,
// validates it against desktop_sessions, and returns the user's email
// (or null if missing / revoked / not found). Touches last_used_at as
// a side effect so we have basic activity tracking.
export async function getDesktopUserEmailFromRequest(
  request: Request,
): Promise<string | null> {
  const auth = request.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  if (!token) return null;

  try {
    const session = await findActiveSessionByToken(token);
    if (!session) return null;
    touchSession(session.id).catch((err) =>
      console.warn("touchSession failed:", err),
    );
    return session.email;
  } catch (err) {
    console.warn("getDesktopUserEmailFromRequest:", err);
    return null;
  }
}

// ── Account-wide desktop revocation ─────────────────────────────────
//
// Per-SESSION revocation already existed: desktop_sessions carries revoked_at and
// findActiveSessionByToken filters on it, so signing out one device works and always did. What did not
// exist is ACCOUNT-WIDE revocation — the security event that must reach every device at once.
//
// The web session counter (lib/v-session-revocation.ts) cannot cover these: a desktop call authenticates
// with an opaque bearer token, never a JWT, so there is no `tv` claim to compare. Desktop sessions
// therefore need their own account-wide sweep, invoked from the same security events.
//
// DELIBERATELY NOT invoked by ordinary web sign-out. Closing a browser tab must not sign a laptop app out;
// that would make the desktop client unusable for anyone who also uses the site. It IS invoked by password
// reset and administrative revocation, which is what "this account may be compromised" actually means.
//
// Tokens are never logged. The table stores sha256(token) only, and this function works from the email —
// it never sees, returns, or records a raw token.
export async function revokeAllDesktopSessions(
  email: string,
  reason: string,
): Promise<{ revoked: number } | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("desktop_sessions" as never)
      .update({ revoked_at: new Date().toISOString() } as never)
      .eq("email", normalized)
      .is("revoked_at", null)
      .select("id");
    if (error) {
      console.error("[desktop-auth] account-wide revocation failed:", error.message);
      return null;
    }
    const revoked = ((data as unknown as { id: string }[]) ?? []).length;
    // Count and reason only — never an identifier that could be correlated back to a token.
    console.warn(`[desktop-auth] revoked ${revoked} desktop session(s):`, reason);
    return { revoked };
  } catch (e) {
    console.error("[desktop-auth] account-wide revocation threw:", e);
    return null;
  }
}

/** Revoke ONE desktop session by its id. The ordinary "sign this device out" path. */
export async function revokeDesktopSession(sessionId: string): Promise<boolean> {
  if (!sessionId) return false;
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("desktop_sessions" as never)
      .update({ revoked_at: new Date().toISOString() } as never)
      .eq("id", sessionId)
      .is("revoked_at", null);
    if (error) {
      console.error("[desktop-auth] single revocation failed:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[desktop-auth] single revocation threw:", e);
    return false;
  }
}
