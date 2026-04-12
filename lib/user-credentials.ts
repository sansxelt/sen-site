import { compare, hash } from "bcryptjs";
import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";

export type UserCredentialRecord = {
  created_at: string;
  email: string;
  password_hash: string;
  updated_at: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeCredentialRecord(
  data: Partial<UserCredentialRecord> & { email: string; password_hash: string },
) {
  return {
    created_at:
      typeof data.created_at === "string"
        ? data.created_at
        : new Date().toISOString(),
    email: normalizeEmail(data.email),
    password_hash: data.password_hash,
    updated_at:
      typeof data.updated_at === "string"
        ? data.updated_at
        : new Date().toISOString(),
  } satisfies UserCredentialRecord;
}

export async function getUserCredentialByEmail(email: string | null | undefined) {
  if (!email || !isDatabaseConfigured()) {
    return null;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("user_credentials" as never)
      .select("created_at, email, password_hash, updated_at")
      .eq("email", normalizeEmail(email))
      .maybeSingle();

    if (error) {
      console.error("Credential lookup failed:", error);
      return null;
    }

    return data ? normalizeCredentialRecord(data) : null;
  } catch (error) {
    console.error("Credential lookup threw:", error);
    return null;
  }
}

export async function createUserCredential(email: string, password: string) {
  const supabase = getSupabaseAdminClient();
  const normalizedEmail = normalizeEmail(email);
  const passwordHash = await hash(password, 12);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("user_credentials" as never)
    .insert(
      {
        email: normalizedEmail,
        password_hash: passwordHash,
        updated_at: now,
      } as never,
    )
    .select("created_at, email, password_hash, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return normalizeCredentialRecord(data);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}
