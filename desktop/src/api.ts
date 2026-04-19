import { fetch } from "@tauri-apps/plugin-http";
import { API_BASE } from "./auth";

export type Note = {
  id: string;
  email: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ModelTier = "fast" | "balanced" | "smart";
export type ChatInputMode = "text" | "voice";

export type ModelOption = {
  tier: ModelTier;
  display_name: string;
  blurb: string;
  locked?: boolean; // true if the user's plan can't actually use this tier
};

export const ALL_MODEL_OPTIONS: ReadonlyArray<ModelOption> = [
  {
    tier: "fast",
    display_name: "sansxel-1 fast",
    blurb: "Quick replies, simple tasks. Free for all plans.",
  },
  {
    tier: "balanced",
    display_name: "sansxel-1",
    blurb: "Default. Strong on writing, code, planning. Apprentice and up.",
  },
  {
    tier: "smart",
    display_name: "sansxel-1 deep",
    blurb: "Heaviest reasoning. Long context. Pro and up.",
  },
];

function authHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ── Notes ────────────────────────────────────────────────────────────

export async function listNotes(token: string): Promise<Note[]> {
  const res = await fetch(`${API_BASE}/api/notes`, {
    method: "GET",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`listNotes ${res.status}`);
  const data = (await res.json()) as { notes: Note[] };
  return data.notes ?? [];
}

export async function createNote(
  token: string,
  init?: { title?: string; body?: string },
): Promise<Note> {
  const res = await fetch(`${API_BASE}/api/notes`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(init ?? {}),
  });
  if (!res.ok) throw new Error(`createNote ${res.status}`);
  const data = (await res.json()) as { note: Note };
  return data.note;
}

export async function updateNote(
  token: string,
  id: string,
  patch: { title?: string; body?: string },
): Promise<Note> {
  const res = await fetch(`${API_BASE}/api/notes/${id}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`updateNote ${res.status}`);
  const data = (await res.json()) as { note: Note };
  return data.note;
}

export async function deleteNote(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/notes/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteNote ${res.status}`);
  }
}

// ── Account ──────────────────────────────────────────────────────────

export type AccountProfile = {
  email: string;
  display_name: string | null;
  focus_area: string | null;
  work_style: string | null;
  summary_style: string;
  release_channel: string;
};

export async function getAccount(token: string): Promise<AccountProfile> {
  const res = await fetch(`${API_BASE}/api/desktop/account`, {
    method: "GET",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`getAccount ${res.status}`);
  const data = (await res.json()) as { email: string; profile: AccountProfile };
  return data.profile;
}

export async function patchAccount(
  token: string,
  patch: Partial<Pick<AccountProfile, "display_name" | "focus_area" | "work_style">>,
): Promise<AccountProfile> {
  const res = await fetch(`${API_BASE}/api/desktop/account`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`patchAccount ${res.status}`);
  const data = (await res.json()) as { profile: AccountProfile };
  return data.profile;
}

// ── Preferences ──────────────────────────────────────────────────────

export type WindowMode =
  | "normal"
  | "toolbar-top"
  | "toolbar-left"
  | "toolbar-right";

export type TtsVoice =
  | "alloy" | "ash" | "ballad" | "coral" | "echo"
  | "fable" | "nova" | "onyx" | "sage" | "shimmer" | "verse";

export const TTS_VOICES: ReadonlyArray<{ value: TtsVoice; label: string; vibe: string }> = [
  { value: "fable",   label: "Fable",    vibe: "British, expressive (default)" },
  { value: "onyx",    label: "Onyx",     vibe: "Deep, masculine" },
  { value: "echo",    label: "Echo",     vibe: "Steady, even" },
  { value: "shimmer", label: "Shimmer",  vibe: "Warm, friendly" },
  { value: "nova",    label: "Nova",     vibe: "Bright, energetic" },
  { value: "alloy",   label: "Alloy",    vibe: "Neutral" },
  { value: "ash",     label: "Ash",      vibe: "Calm, low" },
  { value: "ballad",  label: "Ballad",   vibe: "Smooth, mellow" },
  { value: "coral",   label: "Coral",    vibe: "Soft, conversational" },
  { value: "sage",    label: "Sage",     vibe: "Thoughtful, grounded" },
  { value: "verse",   label: "Verse",    vibe: "Lyrical, light" },
];

export type Persona = "direct" | "warm" | "technical" | "playful";

export const PERSONA_OPTIONS: ReadonlyArray<{
  value: Persona;
  label: string;
  blurb: string;
}> = [
  { value: "warm",      label: "Warm",      blurb: "Conversational, patient, slightly longer sentences (default)." },
  { value: "direct",    label: "Direct",    blurb: "Short sentences. No hedging. Lead with the answer." },
  { value: "technical", label: "Technical", blurb: "Precise terminology. Code-first. Cite assumptions." },
  { value: "playful",   label: "Playful",   blurb: "Witty, light, dry humor. Never mean." },
];

export type DesktopPreferences = {
  default_tier: ModelTier;
  density: "compact" | "comfortable" | "spacious";
  accent: "purple" | "blue" | "green" | "amber" | "rose";
  send_on_enter: boolean;
  auto_speak_replies: boolean;
  conversational: boolean;
  window_mode: WindowMode;
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

export async function getPreferences(token: string): Promise<DesktopPreferences> {
  const res = await fetch(`${API_BASE}/api/desktop/preferences`, {
    method: "GET",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`getPreferences ${res.status}`);
  const data = (await res.json()) as { prefs: DesktopPreferences };
  return data.prefs;
}

export async function patchPreferences(
  token: string,
  patch: Partial<DesktopPreferences>,
): Promise<DesktopPreferences> {
  const res = await fetch(`${API_BASE}/api/desktop/preferences`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`patchPreferences ${res.status}`);
  const data = (await res.json()) as { prefs: DesktopPreferences };
  return data.prefs;
}

// ── Subscription ────────────────────────────────────────────────────

export type Subscription = {
  plan: string;
  status: string;
  billing_cycle: string | null;
  seat_count: number;
  current_period_end: string | null;
  tiers: Array<{ tier: ModelTier; display_name: string; blurb: string }>;
};

export async function getSubscription(token: string): Promise<Subscription> {
  const res = await fetch(`${API_BASE}/api/desktop/subscription`, {
    method: "GET",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`getSubscription ${res.status}`);
  return (await res.json()) as Subscription;
}

// ── Usage ───────────────────────────────────────────────────────────

export type WeeklyUsageSummary = {
  chat_requests: number;
  voice_seconds: number;
  week_start: string;
  week_reset: string;
  weekly_chat_limit: number | null;
  weekly_voice_seconds_limit: number | null;
  pro_throttle: {
    smart_to_balanced: number;
    balanced_to_fast: number;
    current_tier: ModelTier | null;
    next_downshift_in: number | null;
  } | null;
  recent: Array<{
    id: string;
    kind: string;
    model: string | null;
    surface: string | null;
    total_tokens: number;
    audio_seconds: number | null;
    created_at: string;
  }>;
};

export async function getWeeklyUsage(token: string): Promise<WeeklyUsageSummary> {
  const res = await fetch(`${API_BASE}/api/desktop/usage`, {
    method: "GET",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`getWeeklyUsage ${res.status}`);
  return (await res.json()) as WeeklyUsageSummary;
}

// ── API keys ────────────────────────────────────────────────────────

export type ApiKeySummary = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
};

export async function listDesktopApiKeys(token: string): Promise<ApiKeySummary[]> {
  const res = await fetch(`${API_BASE}/api/desktop/keys`, {
    method: "GET",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`listDesktopApiKeys ${res.status}`);
  const data = (await res.json()) as { keys: ApiKeySummary[] };
  return data.keys ?? [];
}

// ── Voice ────────────────────────────────────────────────────────────

export async function transcribeAudio(
  token: string,
  blob: Blob,
): Promise<string> {
  const form = new FormData();
  form.append("audio", blob, "audio.webm");
  const res = await fetch(`${API_BASE}/api/ai/voice/transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`transcribe ${res.status}`);
  const data = (await res.json()) as { text: string };
  return data.text;
}

export async function fetchSpeech(
  token: string,
  text: string,
  voice?: TtsVoice,
): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/ai/voice/speak`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ text, voice }),
  });
  if (!res.ok) throw new Error(`speak ${res.status}`);
  return await res.blob();
}

// ── AI chat (streaming) ─────────────────────────────────────────────

export type StreamMeta = {
  tier_requested: ModelTier | null;
  tier_resolved: ModelTier | null;
  plan: string | null;
  persona: Persona | null;
  persona_delay_multiplier: number;
};

export async function* streamChat(
  token: string,
  messages: ChatMessage[],
  options: {
    context?: { note_title?: string; note_body?: string };
    tier?: ModelTier;
    inputMode?: ChatInputMode;
    persona?: Persona;
    signal?: AbortSignal;
    onMeta?: (meta: StreamMeta) => void;
  } = {},
): AsyncGenerator<string, void, unknown> {
  const res = await fetch(`${API_BASE}/api/ai/chat`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      messages,
      context: options.context,
      tier: options.tier,
      input_mode: options.inputMode,
      persona: options.persona,
    }),
    signal: options.signal,
  });

  if (options.onMeta) {
    const personaHeader = res.headers.get("x-sansxel-persona");
    const delayHeader = res.headers.get("x-sansxel-persona-delay-multiplier");
    options.onMeta({
      tier_requested:
        (res.headers.get("x-sansxel-tier-requested") as ModelTier | null) ?? null,
      tier_resolved:
        (res.headers.get("x-sansxel-tier") as ModelTier | null) ?? null,
      persona: personaHeader
        ? (personaHeader as Persona | null)
        : null,
      persona_delay_multiplier: delayHeader ? Number(delayHeader) : 1,
      plan: res.headers.get("x-sansxel-plan"),
    });
  }

  if (!res.ok || !res.body) {
    let detail = `chat ${res.status}`;
    try {
      const err = (await res.json()) as { error?: string };
      if (err?.error) detail = err.error;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      yield decoder.decode(value, { stream: true });
    }
  }
  // Flush final bytes
  const tail = decoder.decode();
  if (tail) yield tail;
}
