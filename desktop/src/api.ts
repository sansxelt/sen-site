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

export async function* streamChat(
  token: string,
  messages: ChatMessage[],
  context?: { note_title?: string; note_body?: string },
  signal?: AbortSignal,
): AsyncGenerator<string, void, unknown> {
  const res = await fetch(`${API_BASE}/api/ai/chat`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ messages, context }),
    signal,
  });

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
