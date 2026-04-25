// v0.1.16 — Persistent chat threads + messages.
//
// Server-side store keyed by user email. Same account → same threads
// from any device (web mobile, web desktop, Tauri). All helpers fail
// open (return empty / null) on transient DB errors so a flaky
// Supabase never breaks the chat — worst case the user gets an
// in-memory-only conversation that turn.
//
// Run sql/chat_threads.sql once in Supabase before this works.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";

export type ChatThread = {
  id: string;
  email: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type StoredMessage = {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  images: Array<{ media_type: string; data: string }> | null;
  created_at: string;
};

const TITLE_FALLBACK = "New chat";
const TITLE_MAX_LEN = 60;

function deriveTitle(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return TITLE_FALLBACK;
  return trimmed.length <= TITLE_MAX_LEN
    ? trimmed
    : trimmed.slice(0, TITLE_MAX_LEN - 1).trimEnd() + "…";
}

/** Lists the user's threads, newest first. Returns [] on any failure. */
export async function listThreads(email: string): Promise<ChatThread[]> {
  if (!email || !isDatabaseConfigured()) return [];
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("chat_threads" as never)
      .select("id, email, title, created_at, updated_at")
      .eq("email", email.toLowerCase())
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) {
      console.warn("listThreads failed:", error.message);
      return [];
    }
    return (data ?? []) as unknown as ChatThread[];
  } catch (err) {
    console.warn("listThreads threw:", err);
    return [];
  }
}

/** Returns thread metadata, or null if it doesn't belong to this user. */
export async function getThread(email: string, threadId: string): Promise<ChatThread | null> {
  if (!email || !threadId || !isDatabaseConfigured()) return null;
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("chat_threads" as never)
      .select("id, email, title, created_at, updated_at")
      .eq("id", threadId)
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (error) {
      console.warn("getThread failed:", error.message);
      return null;
    }
    return (data as unknown as ChatThread) ?? null;
  } catch (err) {
    console.warn("getThread threw:", err);
    return null;
  }
}

/** Returns ALL messages in a thread (creation order). [] on failure. */
export async function listMessages(email: string, threadId: string): Promise<StoredMessage[]> {
  const thread = await getThread(email, threadId);
  if (!thread) return [];
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("chat_messages" as never)
      .select("id, thread_id, role, content, images, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    if (error) {
      console.warn("listMessages failed:", error.message);
      return [];
    }
    return (data ?? []) as unknown as StoredMessage[];
  } catch (err) {
    console.warn("listMessages threw:", err);
    return [];
  }
}

/**
 * Creates a new thread for this user and returns it. Title defaults
 * to "New chat" — the first appendMessage will rename it to a snippet
 * of the first user turn.
 */
export async function createThread(email: string, title?: string): Promise<ChatThread | null> {
  if (!email || !isDatabaseConfigured()) return null;
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("chat_threads" as never)
      .insert([{ email: email.toLowerCase(), title: title ?? TITLE_FALLBACK }] as never)
      .select("id, email, title, created_at, updated_at")
      .single();
    if (error || !data) {
      console.warn("createThread failed:", error?.message);
      return null;
    }
    return data as unknown as ChatThread;
  } catch (err) {
    console.warn("createThread threw:", err);
    return null;
  }
}

/**
 * Appends a message to a thread. Auto-renames the thread on the first
 * user turn (title still equals fallback) so the sidebar shows a
 * useful label without an extra round-trip.
 *
 * Bumps `updated_at` so the sidebar's recent-first ordering reflects
 * activity even on assistant turns.
 */
export async function appendMessage(args: {
  email: string;
  threadId: string;
  role: "user" | "assistant" | "system";
  content: string;
  images?: Array<{ media_type: string; data: string }>;
}): Promise<void> {
  const { email, threadId, role, content } = args;
  if (!email || !threadId || !content || !isDatabaseConfigured()) return;
  try {
    const supabase = getSupabaseAdminClient();

    const { error: insertErr } = await supabase
      .from("chat_messages" as never)
      .insert([
        {
          thread_id: threadId,
          role,
          content,
          images: args.images && args.images.length ? args.images : null,
        },
      ] as never);
    if (insertErr) {
      console.warn("appendMessage insert failed:", insertErr.message);
      return;
    }

    // Title rename on first user turn — only if still the fallback.
    if (role === "user") {
      const thread = await getThread(email, threadId);
      if (thread && thread.title === TITLE_FALLBACK) {
        const newTitle = deriveTitle(content);
        await supabase
          .from("chat_threads" as never)
          .update({ title: newTitle, updated_at: new Date().toISOString() } as never)
          .eq("id", threadId)
          .eq("email", email.toLowerCase());
        return;
      }
    }

    // Always bump updated_at so listThreads ordering tracks activity.
    await supabase
      .from("chat_threads" as never)
      .update({ updated_at: new Date().toISOString() } as never)
      .eq("id", threadId)
      .eq("email", email.toLowerCase());
  } catch (err) {
    console.warn("appendMessage threw:", err);
  }
}

/** Renames a thread (no-op if it doesn't belong to the user). */
export async function renameThread(email: string, threadId: string, title: string): Promise<boolean> {
  if (!email || !threadId || !isDatabaseConfigured()) return false;
  const safe = title.trim().slice(0, TITLE_MAX_LEN) || TITLE_FALLBACK;
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("chat_threads" as never)
      .update({ title: safe, updated_at: new Date().toISOString() } as never)
      .eq("id", threadId)
      .eq("email", email.toLowerCase());
    if (error) {
      console.warn("renameThread failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("renameThread threw:", err);
    return false;
  }
}

/** Deletes a thread (cascades to its messages). */
export async function deleteThread(email: string, threadId: string): Promise<boolean> {
  if (!email || !threadId || !isDatabaseConfigured()) return false;
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("chat_threads" as never)
      .delete()
      .eq("id", threadId)
      .eq("email", email.toLowerCase());
    if (error) {
      console.warn("deleteThread failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("deleteThread threw:", err);
    return false;
  }
}
