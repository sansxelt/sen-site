import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../lib/desktop-auth";
import { createThread, listThreads } from "../../../lib/chat-history";
import { getProjectWithPins } from "../../../lib/projects";

export const runtime = "nodejs";

async function emailFromRequest(request: Request): Promise<string | null> {
  const desktopEmail = await getDesktopUserEmailFromRequest(request);
  if (desktopEmail) return desktopEmail;
  const session = await auth();
  return session?.user?.email ?? null;
}

// GET /api/threads, list the user's saved chat threads (newest first).
export async function GET(request: Request) {
  const email = await emailFromRequest(request);
  if (!email) return NextResponse.json({ threads: [] }, { status: 401 });
  const threads = await listThreads(email);
  return NextResponse.json(
    { threads },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

// POST /api/threads, create a new empty thread. Returns { thread }.
// Body: { project_id? } — when provided, the new thread is filed
// under that project from creation. Used by the rail's "Start a
// chat here" CTA to skip the localStorage-then-send race that
// could land new chats in "All chats" instead of inside the
// project section the user clicked.
export async function POST(request: Request) {
  const email = await emailFromRequest(request);
  if (!email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    project_id?: string;
  };
  let projectId: string | null = null;
  const requested =
    typeof body.project_id === "string" && body.project_id.trim()
      ? body.project_id.trim()
      : null;
  if (requested) {
    // Ownership check — don't let a malicious client pin a thread
    // to someone else's project. getProjectWithPins enforces
    // owner_email = caller, returns null otherwise.
    const owned = await getProjectWithPins(email, requested);
    if (owned) projectId = owned.id;
  }
  const thread = await createThread(email, undefined, projectId);
  if (!thread) {
    return NextResponse.json({ error: "Could not create thread." }, { status: 500 });
  }
  return NextResponse.json({ thread }, { status: 200 });
}
