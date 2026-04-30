// v0.2.0 phase G — duel-turn persistence helpers.
//
// Solo chat persistence stays in lib/chat-history.ts. This file owns
// the duel-specific bits so the regular chat code path doesn't grow
// unrelated branches.
//
// Migration prerequisite: docs/v0.2.0-duel.sql (adds duel_group_id /
// duel_side / duel_model / duel_winner to chat_messages). Helpers
// fail open: if the columns are missing the inserts will error and
// the duel route degrades to a non-persisted "ephemeral" duel —
// streaming still works, just nothing saved across reloads.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { getThread } from "./chat-history";

export type DuelSide = "left" | "right";

export type DuelMessageRow = {
  id: string;
  thread_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  duel_group_id: string | null;
  duel_side: DuelSide | null;
  duel_model: string | null;
  duel_winner: boolean | null;
};

// Inserts an empty assistant placeholder belonging to a duel group.
// Returns the new row id, or null on any failure (caller treats
// null as "skip persistence for this side"). The caller has
// already verified thread ownership.
export async function createDuelPlaceholder(args: {
  threadId: string;
  groupId: string;
  side: DuelSide;
  model: string;
  createdAt: string;
}): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("chat_messages" as never)
      .insert([
        {
          thread_id: args.threadId,
          role: "assistant",
          content: "",
          created_at: args.createdAt,
          duel_group_id: args.groupId,
          duel_side: args.side,
          duel_model: args.model,
          duel_winner: null,
        },
      ] as never)
      .select("id")
      .single();
    if (error || !data) {
      console.warn("createDuelPlaceholder failed:", error?.message);
      return null;
    }
    return (data as { id: string }).id;
  } catch (err) {
    console.warn("createDuelPlaceholder threw:", err);
    return null;
  }
}

// Used by the duel route to write the final buffer (and clear the
// duel_winner flag explicitly — null means "still open"). Same row
// shape as updateMessageContent in chat-history.ts; kept separate
// because the duel route also needs to bump updated_at on the
// thread without going through the helper.
export async function setDuelMessageContent(args: {
  messageId: string;
  threadId: string;
  content: string;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("chat_messages" as never)
      .update({ content: args.content } as never)
      .eq("id", args.messageId);
    if (error) {
      console.warn("setDuelMessageContent failed:", error.message);
      return;
    }
    await supabase
      .from("chat_threads" as never)
      .update({ updated_at: new Date().toISOString() } as never)
      .eq("id", args.threadId);
  } catch (err) {
    console.warn("setDuelMessageContent threw:", err);
  }
}

// Wipes both rows of a duel group. Used by Retry Both — the client
// re-runs a fresh duel against the same user prompt, so the old
// pair is no longer canonical and shouldn't sit in history.
// Returns false if the thread isn't owned by this email.
export async function discardDuelGroup(args: {
  email: string;
  threadId: string;
  groupId: string;
}): Promise<boolean> {
  const { email, threadId, groupId } = args;
  if (!email || !threadId || !groupId || !isDatabaseConfigured()) return false;
  try {
    const owned = await getThread(email, threadId);
    if (!owned) return false;
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("chat_messages" as never)
      .delete()
      .eq("thread_id", threadId)
      .eq("duel_group_id", groupId);
    if (error) {
      console.warn("discardDuelGroup failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("discardDuelGroup threw:", err);
    return false;
  }
}

// Picks a winner for a duel group: marks the chosen row's
// duel_winner = true and DELETES the loser row outright. After this
// runs the thread reads as a normal solo conversation again — the
// canonical assistant turn for that round is the winner's row.
//
// Owner-checks the thread before touching anything.
export async function pickDuelWinner(args: {
  email: string;
  threadId: string;
  groupId: string;
  winnerSide: DuelSide;
}): Promise<boolean> {
  const { email, threadId, groupId, winnerSide } = args;
  if (!email || !threadId || !groupId || !isDatabaseConfigured()) return false;
  try {
    const owned = await getThread(email, threadId);
    if (!owned) return false;

    const supabase = getSupabaseAdminClient();

    // Mark winner.
    const { error: winErr } = await supabase
      .from("chat_messages" as never)
      .update({ duel_winner: true } as never)
      .eq("thread_id", threadId)
      .eq("duel_group_id", groupId)
      .eq("duel_side", winnerSide);
    if (winErr) {
      console.warn("pickDuelWinner mark winner failed:", winErr.message);
      return false;
    }

    // Delete loser (the other side in the same group).
    const loserSide: DuelSide = winnerSide === "left" ? "right" : "left";
    const { error: delErr } = await supabase
      .from("chat_messages" as never)
      .delete()
      .eq("thread_id", threadId)
      .eq("duel_group_id", groupId)
      .eq("duel_side", loserSide);
    if (delErr) {
      console.warn("pickDuelWinner delete loser failed:", delErr.message);
      return false;
    }

    await supabase
      .from("chat_threads" as never)
      .update({ updated_at: new Date().toISOString() } as never)
      .eq("id", threadId);
    return true;
  } catch (err) {
    console.warn("pickDuelWinner threw:", err);
    return false;
  }
}
