// GET /api/projects/[id]/duel-stats — returns the GPT vs Claude
// scoreboard for this project plus recent winning responses.
// Used by the Project panel scoreboard + saved-winners list.

import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../../lib/desktop-auth";
import { getProjectDuelStats } from "../../../../../lib/duel-stats";

export const runtime = "nodejs";

async function emailFromRequest(request: Request): Promise<string | null> {
  const desktopEmail = await getDesktopUserEmailFromRequest(request);
  if (desktopEmail) return desktopEmail;
  const session = await auth();
  return session?.user?.email ?? null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const email = await emailFromRequest(request);
  if (!email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const stats = await getProjectDuelStats({ email, projectId: id });
  return NextResponse.json(stats, {
    headers: { "Cache-Control": "no-store" },
  });
}
