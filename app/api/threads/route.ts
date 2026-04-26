import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../lib/desktop-auth";
import { createThread, listThreads } from "../../../lib/chat-history";

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
export async function POST(request: Request) {
  const email = await emailFromRequest(request);
  if (!email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const thread = await createThread(email);
  if (!thread) {
    return NextResponse.json({ error: "Could not create thread." }, { status: 500 });
  }
  return NextResponse.json({ thread }, { status: 200 });
}
