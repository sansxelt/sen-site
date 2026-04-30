// v0.2.0 phase G+ — per-project duel scoreboard.
//
// Derives "GPT wins vs Claude wins" for a project from the existing
// chat_messages table — no new counters, no triggers, no risk of
// drift between a denormalized total and the actual data. When a
// user clicks Pick Winner the chosen row gets duel_winner = true,
// the loser row is deleted, and we count whatever's still on
// disk.
//
// Returns zeros + empty list on any DB hiccup so the UI degrades
// to "no scoreboard yet" rather than crashing.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { getProjectWithPins } from "./projects";

export type DuelSideKey = "left" | "right";

export type DuelWinnerRow = {
  id: string;
  thread_id: string;
  side: DuelSideKey;
  model: string | null;
  content: string;
  picked_at: string;
};

export type DuelStats = {
  gpt_wins: number;
  claude_wins: number;
  total: number;
  // Most recent winning responses, capped to keep the panel light.
  // Useful as "saved winners" — copy buttons + see what worked.
  recent: DuelWinnerRow[];
};

const EMPTY: DuelStats = {
  gpt_wins: 0,
  claude_wins: 0,
  total: 0,
  recent: [],
};

const RECENT_LIMIT = 6;

export async function getProjectDuelStats(args: {
  email: string;
  projectId: string;
}): Promise<DuelStats> {
  const { email, projectId } = args;
  if (!email || !projectId || !isDatabaseConfigured()) return EMPTY;
  // Owner check — reuse the projects helper so a guessed id can't
  // pull stats out of someone else's project.
  const project = await getProjectWithPins(email, projectId);
  if (!project) return EMPTY;

  try {
    const supabase = getSupabaseAdminClient();

    // Step 1: thread ids belonging to this project.
    const { data: threadRows } = await supabase
      .from("chat_threads" as never)
      .select("id")
      .eq("project_id", projectId)
      .eq("email", email.toLowerCase());
    const threadIds = ((threadRows ?? []) as Array<{ id: string }>).map(
      (r) => r.id,
    );
    if (threadIds.length === 0) return EMPTY;

    // Step 2: winner rows in those threads.
    const { data: winnerRows, error } = await supabase
      .from("chat_messages" as never)
      .select(
        "id, thread_id, content, duel_side, duel_model, created_at",
      )
      .in("thread_id", threadIds)
      .eq("duel_winner", true)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      console.warn("getProjectDuelStats query failed:", error.message);
      return EMPTY;
    }
    const rows = (winnerRows ?? []) as Array<{
      id: string;
      thread_id: string;
      content: string;
      duel_side: DuelSideKey | null;
      duel_model: string | null;
      created_at: string;
    }>;

    let gpt = 0;
    let claude = 0;
    const recent: DuelWinnerRow[] = [];
    for (const row of rows) {
      if (row.duel_side === "left") gpt += 1;
      else if (row.duel_side === "right") claude += 1;
      if (recent.length < RECENT_LIMIT && row.duel_side) {
        recent.push({
          id: row.id,
          thread_id: row.thread_id,
          side: row.duel_side,
          model: row.duel_model,
          content: row.content,
          picked_at: row.created_at,
        });
      }
    }
    return {
      gpt_wins: gpt,
      claude_wins: claude,
      total: gpt + claude,
      recent,
    };
  } catch (err) {
    console.warn("getProjectDuelStats threw:", err);
    return EMPTY;
  }
}
