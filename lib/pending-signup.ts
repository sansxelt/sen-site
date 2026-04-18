import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";

/**
 * Pending signup = email + password the user submitted via the signup
 * form, stashed here until they click the verification link in their
 * email.  Only once the token is consumed does the row get promoted
 * into user_credentials + user_profiles (in /api/auth/verify).
 *
 * Tokens are 32-byte base64url strings (unguessable).  Expiry is 24h.
 */

const TOKEN_BYTES   = 32;
const EXPIRY_HOURS  = 24;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

function expiryFromNow(): Date {
  const d = new Date();
  d.setHours(d.getHours() + EXPIRY_HOURS);
  return d;
}

export type PendingSignupRecord = {
  email:         string;
  password_hash: string;
  display_name:  string | null;
  token:         string;
  expires_at:    string;
  created_at:    string;
};

/**
 * Create or replace a pending signup for the given email.  Using upsert
 * here means the user can "re-register" if they lose the first email —
 * the newer row overwrites, invalidating the older token.
 */
export async function upsertPendingSignup(args: {
  email:    string;
  password: string;
  name?:    string;
}): Promise<{ token: string; expiresAt: Date }> {
  if (!isDatabaseConfigured()) {
    throw new Error("Database is not configured.");
  }

  const supabase      = getSupabaseAdminClient();
  const email         = normalizeEmail(args.email);
  const passwordHash  = await hash(args.password, 12);
  const token         = generateToken();
  const expiresAt     = expiryFromNow();

  const { error } = await supabase
    .from("pending_signups" as never)
    .upsert(
      {
        email,
        password_hash: passwordHash,
        display_name:  args.name?.trim() || null,
        token,
        expires_at:    expiresAt.toISOString(),
      } as never,
      { onConflict: "email" },
    );

  if (error) {
    console.error("[pending-signup] upsert failed:", error);
    throw error;
  }

  return { token, expiresAt };
}

/**
 * Regenerate the token + expiry on an existing pending signup — used
 * by the Resend verification flow.  Returns null if no row exists.
 */
export async function rotatePendingToken(email: string): Promise<{
  token: string; expiresAt: Date;
} | null> {
  const supabase      = getSupabaseAdminClient();
  const normalized    = normalizeEmail(email);
  const token         = generateToken();
  const expiresAt     = expiryFromNow();

  const { data, error } = await supabase
    .from("pending_signups" as never)
    .update({
      token,
      expires_at: expiresAt.toISOString(),
    } as never)
    .eq("email", normalized)
    .select("email")
    .maybeSingle();

  if (error) {
    console.error("[pending-signup] rotate failed:", error);
    throw error;
  }
  if (!data) return null;
  return { token, expiresAt };
}

export async function findPendingByToken(token: string): Promise<PendingSignupRecord | null> {
  if (!isDatabaseConfigured() || !token) return null;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pending_signups" as never)
    .select("email, password_hash, display_name, token, expires_at, created_at")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.error("[pending-signup] findByToken failed:", error);
    return null;
  }
  return (data ?? null) as PendingSignupRecord | null;
}

export async function findPendingByEmail(email: string): Promise<PendingSignupRecord | null> {
  if (!isDatabaseConfigured() || !email) return null;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pending_signups" as never)
    .select("email, password_hash, display_name, token, expires_at, created_at")
    .eq("email", normalizeEmail(email))
    .maybeSingle();

  if (error) {
    console.error("[pending-signup] findByEmail failed:", error);
    return null;
  }
  return (data ?? null) as PendingSignupRecord | null;
}

export async function deletePendingSignup(email: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("pending_signups" as never)
    .delete()
    .eq("email", normalizeEmail(email));
}

export function isPendingExpired(record: PendingSignupRecord): boolean {
  return new Date(record.expires_at).getTime() <= Date.now();
}
