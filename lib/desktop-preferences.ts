import { getSupabaseAdminClient } from "./supabase-admin";
import type { ModelTier } from "./ai-models";

export type TtsVoice =
  | "alloy" | "ash" | "ballad" | "coral" | "echo"
  | "fable" | "nova" | "onyx" | "sage" | "shimmer" | "verse";

export type Persona = "direct" | "warm" | "technical" | "playful";

export type BgPattern = "none" | "dots" | "grid" | "gradient";
export type BubbleShape = "rounded" | "square" | "pill";

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
  // v0.1.4, account-personalized UI knobs.
  bg_pattern: BgPattern;
  bubble_shape: BubbleShape;
  // v0.1.4, i18n: manual UI language. Response language is detected
  // per-message and never persisted.
  system_language: string;
  // v0.1.8, let VRAELIS-1 invoke client-side tools (navigate,
  // create_api_key, search_threads, …). Off = text-only responses.
  tools_enabled: boolean;
  // v0.1.16, Theme preference, synced cross-device. "system" follows
  // the OS via prefers-color-scheme; "light" / "dark" pin the choice.
  theme: "light" | "dark" | "system";
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
  bg_pattern: "none",
  bubble_shape: "rounded",
  system_language: "en",
  tools_enabled: true,
  theme: "dark",
};

const BG_PATTERN_VALUES = ["none", "dots", "grid", "gradient"] as const;
const BUBBLE_SHAPE_VALUES = ["rounded", "square", "pill"] as const;
// Keep this list in sync with lib/i18n/index.ts. Anything outside it
// falls back to "en" rather than persisting unexpected language codes.
const SYSTEM_LANGUAGE_VALUES = [
  "en", "es", "fr", "de", "ja", "zh", "pt", "ko", "hi", "ar",
] as const;

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
    bg_pattern:
      r.bg_pattern && (BG_PATTERN_VALUES as readonly string[]).includes(r.bg_pattern)
        ? (r.bg_pattern as BgPattern)
        : DEFAULT_PREFERENCES.bg_pattern,
    bubble_shape:
      r.bubble_shape && (BUBBLE_SHAPE_VALUES as readonly string[]).includes(r.bubble_shape)
        ? (r.bubble_shape as BubbleShape)
        : DEFAULT_PREFERENCES.bubble_shape,
    system_language:
      typeof r.system_language === "string" &&
      (SYSTEM_LANGUAGE_VALUES as readonly string[]).includes(r.system_language)
        ? r.system_language
        : DEFAULT_PREFERENCES.system_language,
    tools_enabled:
      typeof r.tools_enabled === "boolean"
        ? r.tools_enabled
        : DEFAULT_PREFERENCES.tools_enabled,
    theme:
      r.theme === "light" || r.theme === "dark" || r.theme === "system"
        ? r.theme
        : DEFAULT_PREFERENCES.theme,
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
