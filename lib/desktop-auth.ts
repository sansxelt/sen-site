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
// store the raw token — only sha256(token) — so a database leak alone
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
