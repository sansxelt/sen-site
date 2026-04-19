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

// ── AI chat (streaming) ─────────────────────────────────────────────

export type StreamMeta = {
  tier_requested: ModelTier | null;
  tier_resolved: ModelTier | null;
  plan: string | null;
};

export async function* streamChat(
  token: string,
  messages: ChatMessage[],
  options: {
    context?: { note_title?: string; note_body?: string };
    tier?: ModelTier;
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
    }),
    signal: options.signal,
  });

  if (options.onMeta) {
    options.onMeta({
      tier_requested:
        (res.headers.get("x-sansxel-tier-requested") as ModelTier | null) ?? null,
      tier_resolved:
        (res.headers.get("x-sansxel-tier") as ModelTier | null) ?? null,
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
