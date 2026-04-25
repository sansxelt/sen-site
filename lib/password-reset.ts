import crypto from "crypto";
import { getSupabaseAdminClient } from "./supabase-admin";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export function generateResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function createPasswordResetToken(email: string) {
  const supabase = getSupabaseAdminClient();
  const token = generateResetToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  // Invalidate any existing tokens for this email first.
  await supabase
    .from("password_reset_tokens" as never)
    .delete()
    .eq("email", email);

  const { error } = await supabase
    .from("password_reset_tokens" as never)
    .insert({ email, token, expires_at: expiresAt } as never);

  if (error) {
    throw error;
  }

  return token;
}

export async function verifyResetToken(token: string) {
  if (!token) return null;

  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("password_reset_tokens" as never)
    .select("email, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return null;

  const record = data as {
    email: string;
    expires_at: string;
    used_at: string | null;
  };

  if (record.used_at) return null;
  if (new Date(record.expires_at) < new Date()) return null;

  return record.email;
}

export async function consumeResetToken(token: string) {
  const supabase = getSupabaseAdminClient();

  await supabase
    .from("password_reset_tokens" as never)
    .update({ used_at: new Date().toISOString() } as never)
    .eq("token", token);
}
