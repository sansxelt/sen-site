// v0.1.16, Persistent chat threads + messages.
//
// Server-side store keyed by user email. Same account → same threads
// from any device (web mobile, web desktop, Tauri). All helpers fail
// open (return empty / null) on transient DB errors so a flaky
// Supabase never breaks the chat, worst case the user gets an
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
  // v0.2.0 — project this thread is attached to (null for plain
  // chats). The chat history rail groups threads by this id so
  // projects act as folders/categories for the user's chats.
  project_id?: string | null;
};

export type StoredMessage = {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  images: Array<{ media_type: string; data: string }> | null;
  created_at: string;
  // v0.2.0 phase G — duel turn columns. Null on every solo turn,
  // populated on side-by-side duel turns. duel_winner is true on
  // a chosen winner row (loser deleted) and null while the duel is
  // still open. See lib/duel-history.ts.
  duel_group_id?: string | null;
  duel_side?: "left" | "right" | null;
  duel_model?: string | null;
  duel_winner?: boolean | null;
};

const TITLE_FALLBACK = "New chat";
const TITLE_MAX_LEN = 60;

// URL-only / URL-leading first messages make terrible sidebar titles
// ("https://www.youtube.com/watch?v=…"). Detect them and leave the
// fallback in place so the Haiku regen at end-of-stream produces a
// real title from the assistant's response. Same for files, code
// fences, and "look at this image" trivia.
const URL_ONLY_PATTERN = /^\s*https?:\/\/\S+\s*$/i;
const URL_LEADING_PATTERN = /^\s*https?:\/\/\S+/i;

function deriveTitle(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return TITLE_FALLBACK;
  // Pure URL → no useful snippet possible; let Haiku regen own it.
  if (URL_ONLY_PATTERN.test(trimmed)) return TITLE_FALLBACK;
  // URL + a tiny prefix ("check this https://…") is also useless;
  // anything <12 chars before the URL doesn't describe the request.
  if (URL_LEADING_PATTERN.test(trimmed) && trimmed.length < 80) {
    return TITLE_FALLBACK;
  }
  return trimmed.length <= TITLE_MAX_LEN
    ? trimmed
    : trimmed.slice(0, TITLE_MAX_LEN - 1).trimEnd() + "…";
}

/** Lists the user's threads, newest first. Filters out threads
 * that have zero messages, those are abandoned + look like ghosts
 * in the sidebar. Returns [] on any failure. */
export async function listThreads(email: string): Promise<ChatThread[]> {
  if (!email || !isDatabaseConfigured()) return [];
  try {
    const supabase = getSupabaseAdminClient();
    // Inner join on chat_messages so threads with no messages drop
    // out automatically. distinct on thread id to avoid dupes per
    // message row.
    const { data, error } = await supabase
      .from("chat_threads" as never)
      .select("id, email, title, created_at, updated_at, project_id, chat_messages!inner(id)")
      .eq("email", email.toLowerCase())
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) {
      console.warn("listThreads primary failed:", error.message);
      // Fallback 1: drop the chat_messages inner join, keep
      // project_id (handles plain-DB hiccups + threads with zero
      // messages that the join filtered out).
      const fallback = await supabase
        .from("chat_threads" as never)
        .select("id, email, title, created_at, updated_at, project_id")
        .eq("email", email.toLowerCase())
        .order("updated_at", { ascending: false })
        .limit(100);
      if (fallback.error) {
        console.warn("listThreads fallback failed:", fallback.error.message);
        // Fallback 2: drop project_id too (handles deploys where
        // the v0.2.0-projects migration hasn't been applied yet,
        // which would otherwise blow up the entire rail).
        const minimal = await supabase
          .from("chat_threads" as never)
          .select("id, email, title, created_at, updated_at")
          .eq("email", email.toLowerCase())
          .order("updated_at", { ascending: false })
          .limit(100);
        if (minimal.error) {
          console.warn("listThreads minimal failed:", minimal.error.message);
          return [];
        }
        return (minimal.data ?? []) as unknown as ChatThread[];
      }
      return (fallback.data ?? []) as unknown as ChatThread[];
    }
    // Deduplicate (the inner join may yield multiple rows per thread).
    const seen = new Set<string>();
    const out: ChatThread[] = [];
    for (const row of (data ?? []) as unknown as ChatThread[]) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
    }
    return out;
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
      .select("id, email, title, created_at, updated_at, project_id")
      .eq("id", threadId)
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (error) {
      console.warn("getThread project_id select failed:", error.message);
      // Fallback when project_id column isn't present yet.
      const minimal = await supabase
        .from("chat_threads" as never)
        .select("id, email, title, created_at, updated_at")
        .eq("id", threadId)
        .eq("email", email.toLowerCase())
        .maybeSingle();
      if (minimal.error) {
        console.warn("getThread minimal failed:", minimal.error.message);
        return null;
      }
      return (minimal.data as unknown as ChatThread) ?? null;
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
      .select(
        "id, thread_id, role, content, images, created_at, duel_group_id, duel_side, duel_model, duel_winner",
      )
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    if (error) {
      // Fallback when the duel migration hasn't run yet — re-query
      // without the duel columns so old deploys still load history.
      const fallback = await supabase
        .from("chat_messages" as never)
        .select("id, thread_id, role, content, images, created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (fallback.error) {
        console.warn("listMessages failed:", error.message);
        return [];
      }
      return (fallback.data ?? []) as unknown as StoredMessage[];
    }
    return (data ?? []) as unknown as StoredMessage[];
  } catch (err) {
    console.warn("listMessages threw:", err);
    return [];
  }
}

/**
 * Creates a new thread for this user and returns it. Title defaults
 * to "New chat", the first appendMessage will rename it to a snippet
 * of the first user turn.
 */
export async function createThread(
  email: string,
  title?: string,
  projectId?: string | null,
): Promise<ChatThread | null> {
  if (!email || !isDatabaseConfigured()) return null;
  try {
    const supabase = getSupabaseAdminClient();
    const row: Record<string, unknown> = {
      email: email.toLowerCase(),
      title: title ?? TITLE_FALLBACK,
    };
    if (projectId) row.project_id = projectId;
    const { data, error } = await supabase
      .from("chat_threads" as never)
      .insert([row] as never)
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
  /** Explicit timestamp for the row. Used by the chat route to make
   * sure the user message always sorts BEFORE the assistant placeholder
   * even though both inserts race against each other. Default = now. */
  createdAt?: string;
}): Promise<void> {
  const { email, threadId, role, content, createdAt } = args;
  if (!email || !threadId || !isDatabaseConfigured()) return;
  // Allow empty content if there are images attached (image-only
  // user turn). Without this, dropping an image and pressing send
  // with no caption left no row in chat_messages, so reloading the
  // thread showed the assistant analysis with no preceding turn.
  const hasImages = Boolean(args.images && args.images.length);
  if (!content && !hasImages) return;
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
          ...(createdAt ? { created_at: createdAt } : {}),
        },
      ] as never);
    if (insertErr) {
      console.warn("appendMessage insert failed:", insertErr.message);
      return;
    }

    // Title rename on first user turn, only if still the fallback.
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

/**
 * Inserts an empty assistant placeholder message + returns its id.
 * Used by the chat route at stream start so we can progressively
 * UPDATE the message body as deltas arrive, even if the client
 * disconnects, the latest saved chunk survives.
 */
export async function createAssistantPlaceholder(
  email: string,
  threadId: string,
  /** Explicit timestamp, pass a value strictly LATER than the user
   * message's timestamp to guarantee the placeholder sorts after it
   * even when both inserts race. Default = now. */
  createdAt?: string,
): Promise<string | null> {
  if (!email || !threadId || !isDatabaseConfigured()) return null;
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("chat_messages" as never)
      .insert([
        {
          thread_id: threadId,
          role: "assistant",
          content: "",
          ...(createdAt ? { created_at: createdAt } : {}),
        },
      ] as never)
      .select("id")
      .single();
    if (error || !data) {
      console.warn("createAssistantPlaceholder failed:", error?.message);
      return null;
    }
    return (data as { id: string }).id;
  } catch (err) {
    console.warn("createAssistantPlaceholder threw:", err);
    return null;
  }
}

/**
 * Updates an existing message's content (and bumps thread updated_at).
 * Called from the chat route on a throttle so partial assistant
 * output is always saved if the client disconnects mid-stream.
 */
export async function updateMessageContent(
  email: string,
  threadId: string,
  messageId: string,
  content: string,
): Promise<void> {
  if (!email || !threadId || !messageId || !isDatabaseConfigured()) return;
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("chat_messages" as never)
      .update({ content } as never)
      .eq("id", messageId);
    if (error) {
      console.warn("updateMessageContent failed:", error.message);
      return;
    }
    await supabase
      .from("chat_threads" as never)
      .update({ updated_at: new Date().toISOString() } as never)
      .eq("id", threadId)
      .eq("email", email.toLowerCase());
  } catch (err) {
    console.warn("updateMessageContent threw:", err);
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

/** Attaches (or detaches with null) a thread to a project. Returns
 * false if the thread isn't owned by this email or the DB isn't
 * configured. The project itself is NOT ownership-verified here,
 * the caller (route) does that before forwarding. */
export async function setThreadProject(
  email: string,
  threadId: string,
  projectId: string | null,
): Promise<boolean> {
  if (!email || !threadId || !isDatabaseConfigured()) return false;
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("chat_threads" as never)
      .update({
        project_id: projectId,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", threadId)
      .eq("email", email.toLowerCase());
    if (error) {
      console.warn("setThreadProject failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("setThreadProject threw:", err);
    return false;
  }
}

/** Truncates a thread at `fromMessageId`, deleting that message
 * AND every newer message in the same thread. Used by the edit-
 * and-resend flow: the user rewrites an old turn, the server
 * wipes everything from that turn forward, then the normal save
 * path appends the new (edited) user turn + a fresh assistant
 * response. Returns true on success, false on any failure;
 * caller treats false as "leave the thread alone." */
export async function deleteMessagesFromId(
  email: string,
  threadId: string,
  fromMessageId: string,
): Promise<boolean> {
  if (!email || !threadId || !fromMessageId || !isDatabaseConfigured()) {
    return false;
  }
  try {
    const supabase = getSupabaseAdminClient();
    // Confirm the thread is owned by the caller before touching it.
    const owned = await getThread(email, threadId);
    if (!owned) return false;
    // Fetch the message's created_at so we can delete by timestamp
    // (works even if id ordering isn't monotonic).
    const { data, error: lookupErr } = await supabase
      .from("chat_messages" as never)
      .select("created_at")
      .eq("id", fromMessageId)
      .eq("thread_id", threadId)
      .maybeSingle();
    if (lookupErr || !data) return false;
    const fromTs = (data as unknown as { created_at?: string }).created_at;
    if (!fromTs) return false;
    const { error: delErr } = await supabase
      .from("chat_messages" as never)
      .delete()
      .eq("thread_id", threadId)
      .gte("created_at", fromTs);
    if (delErr) {
      console.warn("deleteMessagesFromId failed:", delErr.message);
      return false;
    }
    // Bump the thread's updated_at so the rail re-sorts.
    await supabase
      .from("chat_threads" as never)
      .update({ updated_at: new Date().toISOString() } as never)
      .eq("id", threadId);
    return true;
  } catch (err) {
    console.warn("deleteMessagesFromId threw:", err);
    return false;
  }
}

/** Reads thread.project_id (nullable). Used by the chat route to
 * decide whether to inject project context into the system message.
 * Returns null on any error so a missing column / down DB just
 * degrades to "no project context", never blocks chat. */
export async function getThreadProjectId(
  email: string,
  threadId: string,
): Promise<string | null> {
  if (!email || !threadId || !isDatabaseConfigured()) return null;
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("chat_threads" as never)
      .select("project_id")
      .eq("id", threadId)
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (error || !data) return null;
    return ((data as unknown as { project_id?: string | null }).project_id) ?? null;
  } catch {
    return null;
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
