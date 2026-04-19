import { getSupabaseAdminClient } from "./supabase-admin";
import type { ModelTier } from "./ai-models";

export type TtsVoice =
  | "alloy" | "ash" | "ballad" | "coral" | "echo"
  | "fable" | "nova" | "onyx" | "sage" | "shimmer" | "verse";

export type Persona = "direct" | "warm" | "technical" | "playful";

export type DesktopPreferences = {
  default_tier: ModelTier;
  density: "compact" | "comfortable" | "spacious";
  accent: "purple" | "blue" | "green" | "amber" | "rose";
  send_on_enter: boolean;
  auto_speak_replies: boolean;
  conversational: boolean;
  window_mode: "normal" | "toolbar-top" | "toolbar-left" | "toolbar-right";
  voice: TtsVoice;
  persona: Persona;
};

export const DEFAULT_PREFERENCES: DesktopPreferences = {
  default_tier: "balanced",
  density: "comfortable",
  accent: "purple",
  send_on_enter: true,
  auto_speak_replies: false,
  conversational: false,
  window_mode: "normal",
  voice: "fable",
  persona: "warm",
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
    send_on_enter:
      typeof r.send_on_enter === "boolean"
        ? r.send_on_enter
        : DEFAULT_PREFERENCES.send_on_enter,
    auto_speak_replies:
      typeof r.auto_speak_replies === "boolean"
        ? r.auto_speak_replies
        : DEFAULT_PREFERENCES.auto_speak_replies,
    conversational:
      typeof r.conversational === "boolean"
        ? r.conversational
        : DEFAULT_PREFERENCES.conversational,
    window_mode:
      r.window_mode === "normal" ||
      r.window_mode === "toolbar-top" ||
      r.window_mode === "toolbar-left" ||
      r.window_mode === "toolbar-right"
        ? r.window_mode
        : DEFAULT_PREFERENCES.window_mode,
    voice:
      r.voice && (
        ["alloy", "ash", "ballad", "coral", "echo",
         "fable", "nova", "onyx", "sage", "shimmer", "verse"] as const
      ).includes(r.voice as TtsVoice)
        ? (r.voice as TtsVoice)
        : DEFAULT_PREFERENCES.voice,
    persona:
      r.persona === "direct" ||
      r.persona === "warm" ||
      r.persona === "technical" ||
      r.persona === "playful"
        ? r.persona
        : DEFAULT_PREFERENCES.persona,
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
