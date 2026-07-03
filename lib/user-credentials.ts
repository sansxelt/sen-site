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

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

// Canonical form of an email for anti-abuse dedup: lowercase, strip the +tag from the local
// part (all domains), and strip dots from the local part for Gmail only (gmail/googlemail
// ignore them; dots are significant elsewhere). Used ONLY to enforce one account per real
// inbox so free-credit signups can't be farmed via aliases. Login stays keyed on the real
// address, so existing accounts are never affected.
export function canonicalizeEmail(email: string): string {
  const e = normalizeEmail(email);
  const at = e.lastIndexOf("@");
  if (at < 1 || at === e.length - 1) return e;
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);
  // Gmail: ignore dots, and fold googlemail.com (its alternate domain for the SAME inbox)
  // onto gmail.com so an alias across the two domains resolves to one account.
  if (GMAIL_DOMAINS.has(domain)) { local = local.replace(/\./g, ""); domain = "gmail.com"; }
  return local ? `${local}@${domain}` : e;
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

// Look up a credentials account by the CANONICAL form of an email (see canonicalizeEmail).
// Used at registration to block a new alias of an inbox that already has an account. Returns
// null when none exists; safe because the unique index guarantees at most one row.
export async function getUserCredentialByCanonical(email: string | null | undefined) {
  if (!email || !isDatabaseConfigured()) {
    return null;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("user_credentials" as never)
      .select("created_at, email, password_hash, updated_at")
      .eq("canonical_email", canonicalizeEmail(email))
      .maybeSingle();

    if (error) {
      console.error("Canonical credential lookup failed:", error);
      return null;
    }

    return data ? normalizeCredentialRecord(data) : null;
  } catch (error) {
    console.error("Canonical credential lookup threw:", error);
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
        canonical_email: canonicalizeEmail(normalizedEmail),
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
