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

// REMOVED: getUserCredentialByCanonical(email).
//
// It resolved an ACCOUNT from the FOLDED form of an address, and registration used it to refuse a second
// alias of one inbox. That made a folded email the account identity key. The owner's ruling is that
// folding is an anti-abuse signal ONLY: identity is the exact address, and for OAuth the provider's
// subject id.
//
// Deleted rather than left unused, because an exported "find the account for this folded address" helper
// is exactly what someone reaches for when adding the next signup path, and folded-email identity would
// come straight back. If you need the cluster of accounts behind one real inbox — for a RISK decision,
// which is the legitimate use — call resolveCanonicalCluster() in lib/preflight/free-grant-cluster.ts.
// That returns the whole cluster for a grant/abuse judgement and never claims one of them is "the" account.
//
// The canonical_email COLUMN is still written and still indexed (non-uniquely); only its role as an
// identity key is gone. See sql/vraelis-canonical-not-identity.sql.

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
