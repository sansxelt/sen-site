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

// v0.1.4 — Optional image attachments on a user turn. Each image is
// passed to the server as base64 (no data: prefix) plus its MIME type
// so the chat route can hand it straight to Anthropic vision. Images
// are only valid on user-role turns; the server ignores them on
// assistant turns. Capped at 1MB per image client-side before send.
export type ChatImageAttachment = {
  media_type: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  data: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  images?: ChatImageAttachment[];
};

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
    // Server reads this to log usage events with surface="desktop"
    // instead of falling back to "web". Lets the dashboard split
    // desktop vs web traffic correctly.
    "x-sansxel-surface": "desktop",
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

// ── Sources (v0.1.4 — RAG scaffold) ─────────────────────────────────

export type ChatSource = {
  id: string;
  owner_email: string;
  title: string;
  body: string;
  byte_size: number;
  created_at: string;
};

export async function listSources(token: string): Promise<ChatSource[]> {
  const res = await fetch(`${API_BASE}/api/sources`, {
    method: "GET",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`listSources ${res.status}`);
  const data = (await res.json()) as { sources: ChatSource[] };
  return data.sources ?? [];
}

export async function uploadSource(
  token: string,
  file: File,
): Promise<ChatSource> {
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch(`${API_BASE}/api/sources`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-sansxel-surface": "desktop",
    },
    body: form,
  });
  if (!res.ok) {
    throw new Error(await readErrorDetail(res, `uploadSource ${res.status}`));
  }
  const data = (await res.json()) as { source: ChatSource };
  return data.source;
}

export async function deleteSource(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/sources/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteSource ${res.status}`);
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

// Voices are branded with sansxel-original names. The `value` field
// (alloy/fable/etc.) is the OpenAI voice ID — kept stable so the
// server doesn't need to remap. Users only see `label` + `vibe`.
export const TTS_VOICES: ReadonlyArray<{ value: TtsVoice; label: string; vibe: string }> = [
  { value: "fable",   label: "Sage",    vibe: "Warm, steady, slightly British. Default." },
  { value: "onyx",    label: "Vesper",  vibe: "Deep and grounded. Late-night radio." },
  { value: "echo",    label: "Quill",   vibe: "Precise narrator. Audiobook clarity." },
  { value: "shimmer", label: "Glow",    vibe: "Friendly, sunlit. Easy to listen to." },
  { value: "nova",    label: "Halo",    vibe: "Bright, energetic, encouraging." },
  { value: "alloy",   label: "Drift",   vibe: "Neutral, fast, no character." },
  { value: "ash",     label: "Ember",   vibe: "Low, calm, slightly smoky." },
  { value: "ballad",  label: "Lyric",   vibe: "Smooth and melodic. Storyteller." },
  { value: "coral",   label: "Cove",    vibe: "Soft and conversational." },
  { value: "sage",    label: "Wise",    vibe: "Thoughtful, grounded, measured." },
  { value: "verse",   label: "Lilt",    vibe: "Light and lyrical." },
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

export type BgPattern = "none" | "dots" | "grid" | "gradient";
export type BubbleShape = "rounded" | "square" | "pill";

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
  // v0.1.4 — account-personalized UI knobs.
  bg_pattern: BgPattern;
  bubble_shape: BubbleShape;
  // v0.1.4 — i18n two-axis: system_language drives UI text. The
  // response language is detected per-message server-side, not stored.
  system_language: string;
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
  return parseJsonOrThrow<Subscription>(res, "subscription");
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
  daily_requests: number[]; // last 7 days, oldest → newest
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
  return parseJsonOrThrow<WeeklyUsageSummary>(res, "weekly usage");
}

// Defensive JSON parse — the previous version used res.json()
// directly which surfaces ugly stream-controller errors when the
// server (rarely) returns an HTML error page with a 200 status.
// This wraps it and emits a clean "<surface> returned an unexpected
// response" message instead.
async function parseJsonOrThrow<T>(res: Response, label: string): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error(`${label} returned an unexpected response`);
  }
}

// ── Thread summary ─────────────────────────────────────────────────
// Calls /api/ai/summarize-thread to generate a short title +
// description for a chat thread. Cheap (Haiku) + idempotent. The
// caller debounces calls so we don't fire one per keystroke.
export async function summarizeThread(
  token: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<{ title: string; description: string }> {
  const res = await fetch(`${API_BASE}/api/ai/summarize-thread`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`summarize ${res.status}`);
  return parseJsonOrThrow<{ title: string; description: string }>(
    res,
    "summary",
  );
}

// v0.1.4 — Share thread. Server stores a snapshot of the messages
// keyed by a public id and returns a stable share URL the user can
// hand off. The public viewing page lands in v0.1.5.
export async function shareThread(
  token: string,
  payload: { thread_id: string; title: string; messages: ChatMessage[] },
): Promise<{ share_url: string; public_id: string }> {
  const res = await fetch(`${API_BASE}/api/threads/share`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res, `share ${res.status}`);
    throw new Error(detail);
  }
  return parseJsonOrThrow<{ share_url: string; public_id: string }>(
    res,
    "share",
  );
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

// Returned only by the create call. `rawKey` is the full `sk_sen_…`
// secret — server only ever sends it back ONCE, so the UI must show
// it immediately and warn the user this is the only chance to copy it.
export type CreatedApiKey = {
  key: ApiKeySummary;
  rawKey: string;
};

async function readErrorDetail(res: Response, fallback: string): Promise<string> {
  try {
    const err = (await res.json()) as { error?: string };
    return err?.error ?? fallback;
  } catch {
    return fallback;
  }
}

export async function createDesktopApiKey(
  token: string,
  name: string,
): Promise<CreatedApiKey> {
  const res = await fetch(`${API_BASE}/api/desktop/keys`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    throw new Error(await readErrorDetail(res, `createDesktopApiKey ${res.status}`));
  }
  return (await res.json()) as CreatedApiKey;
}

export async function revokeDesktopApiKey(
  token: string,
  id: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/desktop/keys/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(await readErrorDetail(res, `revokeDesktopApiKey ${res.status}`));
  }
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

// ── AI image generation (one-shot) ───────────────────────────────────

export type ImageSize = "1024x1024" | "1024x1792" | "1792x1024";

export type GeneratedImage = {
  url: string; // data URL or hosted URL
  revised_prompt?: string;
};

export async function generateImage(
  token: string,
  prompt: string,
  size?: ImageSize,
): Promise<GeneratedImage> {
  const res = await fetch(`${API_BASE}/api/ai/image`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ prompt, size }),
  });
  if (!res.ok) {
    throw new Error(await readErrorDetail(res, `image ${res.status}`));
  }
  return (await res.json()) as GeneratedImage;
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
    agentMode?: boolean;
    // v0.1.4 — RAG: ids from the user's chat_sources table to inject
    // as reference material into the system prompt.
    sourceIds?: string[];
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
      agent_mode: options.agentMode ?? false,
      source_ids: options.sourceIds ?? [],
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

// ── AI web search ───────────────────────────────────────────────────

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export async function webSearch(
  token: string,
  query: string,
): Promise<WebSearchResult[]> {
  const res = await fetch(`${API_BASE}/api/ai/web-search`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    throw new Error(await readErrorDetail(res, `web-search ${res.status}`));
  }
  const data = await parseJsonOrThrow<{ results: WebSearchResult[] }>(
    res,
    "web search",
  );
  return data.results ?? [];
}

// ── AI deep research (streaming) ───────────────────────────────────

export async function* streamDeepResearch(
  token: string,
  topic: string,
  signal?: AbortSignal,
): AsyncGenerator<string, void, unknown> {
  const res = await fetch(`${API_BASE}/api/ai/deep-research`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ topic }),
    signal,
  });

  if (!res.ok || !res.body) {
    let detail = `deep-research ${res.status}`;
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
  const tail = decoder.decode();
  if (tail) yield tail;
}

// ── AI quiz (one-shot) ─────────────────────────────────────────────

export type QuizQuestion = {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
};

export type QuizResult = {
  questions: QuizQuestion[];
};

export async function generateQuiz(
  token: string,
  topic: string,
  count?: number,
): Promise<QuizResult> {
  const res = await fetch(`${API_BASE}/api/ai/quiz`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ topic, count }),
  });
  if (!res.ok) {
    throw new Error(await readErrorDetail(res, `quiz ${res.status}`));
  }
  return parseJsonOrThrow<QuizResult>(res, "quiz");
}
