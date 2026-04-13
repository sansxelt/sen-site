import crypto from "crypto";
import { cache } from "react";
import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";

export type ApiKeyRecord = {
  id: string;
  email: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

function generateRawKey(): string {
  return "sk_sen_" + crypto.randomBytes(24).toString("hex");
}

function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function keyPrefix(raw: string): string {
  // Show first 14 chars: "sk_sen_" (7) + 7 hex chars
  return raw.slice(0, 14) + "...";
}

export const listApiKeys = cache(async function listApiKeys(
  email: string,
): Promise<ApiKeyRecord[]> {
  if (!isDatabaseConfigured()) return [];

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("api_keys" as never)
    .select("id, email, name, key_prefix, created_at, last_used_at, revoked_at")
    .eq("email", email)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listApiKeys error:", error);
    return [];
  }

  return (data ?? []) as ApiKeyRecord[];
});

export async function createApiKey(
  email: string,
  name: string,
): Promise<{ record: ApiKeyRecord; rawKey: string }> {
  const supabase = getSupabaseAdminClient();
  const raw = generateRawKey();
  const hash = hashKey(raw);
  const prefix = keyPrefix(raw);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("api_keys" as never)
    .insert([
      {
        id,
        email,
        name: name.trim(),
        key_hash: hash,
        key_prefix: prefix,
        created_at: now,
        last_used_at: null,
        revoked_at: null,
      },
    ] as never)
    .select("id, email, name, key_prefix, created_at, last_used_at, revoked_at")
    .single();

  if (error) {
    throw error;
  }

  return { record: data as ApiKeyRecord, rawKey: raw };
}

export async function revokeApiKey(
  id: string,
  email: string,
): Promise<void> {
  if (!isDatabaseConfigured()) return;

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("api_keys" as never)
    .update({ revoked_at: new Date().toISOString() } as never)
    .eq("id", id)
    .eq("email", email); // ownership guard

  if (error) {
    throw error;
  }
}
