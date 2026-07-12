// Account profile fields. Display name lives where profile data already lives: the existing
// v_profiles.display_name column (sql/vraelis-rank.sql) — no new table or migration required.
// ensureProfile (lib/v-db) only seeds the name at first sign-in; these helpers are the
// user-editable path. Degrades gracefully: reads return null and writes return false when the
// database is not configured, and the API layer turns that into an honest error message.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";

export const DISPLAY_NAME_MAX = 60;

const norm = (email: string) => email.trim().toLowerCase();

// Trim, collapse whitespace, strip control characters, cap the length. Empty -> null (cleared).
export function cleanDisplayName(raw: string): string | null {
  const cleaned = raw
    .replace(/\s+/g, " ") // tabs/newlines become single spaces BEFORE control-char stripping
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, DISPLAY_NAME_MAX)
    .trim();
  return cleaned.length ? cleaned : null;
}

export async function getDisplayName(email: string): Promise<string | null> {
  if (!email || !isDatabaseConfigured()) return null;
  const s = getSupabaseAdminClient();
  const { data } = await s.from("v_profiles" as never).select("display_name").eq("user_id", norm(email)).maybeSingle();
  return (data as unknown as { display_name: string | null } | null)?.display_name ?? null;
}

export async function setDisplayName(email: string, displayName: string | null): Promise<boolean> {
  if (!email || !isDatabaseConfigured()) return false;
  const s = getSupabaseAdminClient();
  // Upsert on user_id: updates only the display_name column when the row exists (other
  // columns keep their values / defaults), and creates the profile row if it doesn't.
  const { error } = await s.from("v_profiles" as never).upsert(
    { user_id: norm(email), display_name: displayName } as never,
    { onConflict: "user_id" } as never,
  );
  if (error) {
    console.error("setDisplayName:", error.message);
    return false;
  }
  return true;
}
