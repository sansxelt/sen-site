import { getSupabaseAdminClient } from "./supabase-admin";
import type { ModelTier } from "./ai-models";

export type DesktopPreferences = {
  default_tier: ModelTier;
  density: "compact" | "comfortable" | "spacious";
  accent: "purple" | "blue" | "green" | "amber" | "rose";
};

export const DEFAULT_PREFERENCES: DesktopPreferences = {
  default_tier: "balanced",
  density: "comfortable",
  accent: "purple",
};

function normalize(raw: unknown): DesktopPreferences {
  const r = (raw ?? {}) as Partial<DesktopPreferences>;
  return {
    default_tier:
      r.default_tier === "fast" ||
      r.default_tier === "balanced" ||
      r.default_tier === "smart"
        ? r.default_tier
        : DEFAULT_PREFERENCES.default_tier,
    density:
      r.density === "compact" ||
      r.density === "comfortable" ||
      r.density === "spacious"
        ? r.density
        : DEFAULT_PREFERENCES.density,
    accent:
      r.accent === "purple" ||
      r.accent === "blue" ||
      r.accent === "green" ||
      r.accent === "amber" ||
      r.accent === "rose"
        ? r.accent
        : DEFAULT_PREFERENCES.accent,
  };
}

export async function getPreferencesForEmail(
  email: string,
): Promise<DesktopPreferences> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from("desktop_preferences" as never)
      .select("prefs")
      .eq("email", email)
      .maybeSingle();
    const row = data as { prefs?: unknown } | null;
    return normalize(row?.prefs);
  } catch (err) {
    console.warn("getPreferencesForEmail fallback:", err);
    return DEFAULT_PREFERENCES;
  }
}

export async function savePreferencesForEmail(
  email: string,
  patch: Partial<DesktopPreferences>,
): Promise<DesktopPreferences> {
  const current = await getPreferencesForEmail(email);
  const next = normalize({ ...current, ...patch });

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("desktop_preferences" as never)
    .upsert(
      [
        {
          email,
          prefs: next,
          updated_at: new Date().toISOString(),
        },
      ] as never,
      { onConflict: "email" },
    );
  if (error) throw error;
  return next;
}
