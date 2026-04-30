// v0.2.0 phase G — pick a duel winner.
//
// POST body: { thread_id, group_id, side: "left" | "right" }
// Marks the chosen row's duel_winner = true and DELETES the loser
// row, so /api/threads/[id] reads the thread back as solo from
// that turn forward.

import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../../lib/desktop-auth";
import { pickDuelWinner } from "../../../../../lib/duel-history";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    const session = await auth();
    email = session?.user?.email ?? null;
  }
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: {
    thread_id?: unknown;
    group_id?: unknown;
    side?: unknown;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const threadId =
    typeof payload.thread_id === "string" ? payload.thread_id.trim() : "";
  const groupId =
    typeof payload.group_id === "string" ? payload.group_id.trim() : "";
  const sideRaw = typeof payload.side === "string" ? payload.side.trim() : "";
  if (!threadId || !groupId || (sideRaw !== "left" && sideRaw !== "right")) {
    return NextResponse.json(
      { error: "thread_id, group_id, and side are required." },
      { status: 400 },
    );
  }

  const ok = await pickDuelWinner({
    email,
    threadId,
    groupId,
    winnerSide: sideRaw,
  });
  if (!ok) {
    return NextResponse.json(
      { error: "Could not pick a winner for that duel." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
