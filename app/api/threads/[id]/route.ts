import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import {
  deleteThread,
  getThread,
  listMessages,
  renameThread,
} from "../../../../lib/chat-history";

export const runtime = "nodejs";

async function emailFromRequest(request: Request): Promise<string | null> {
  const desktopEmail = await getDesktopUserEmailFromRequest(request);
  if (desktopEmail) return desktopEmail;
  const session = await auth();
  return session?.user?.email ?? null;
}

// GET /api/threads/[id], fetch thread metadata + all messages.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const email = await emailFromRequest(request);
  if (!email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const thread = await getThread(email, id);
  if (!thread) return NextResponse.json({ error: "Thread not found." }, { status: 404 });

  const messages = await listMessages(email, id);
  return NextResponse.json(
    { thread, messages },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

// PATCH /api/threads/[id], body: { title }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const email = await emailFromRequest(request);
  if (!email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const payload = (await request.json().catch(() => ({}))) as { title?: string };
  const title = typeof payload.title === "string" ? payload.title : "";
  if (!title.trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const ok = await renameThread(email, id, title);
  if (!ok) return NextResponse.json({ error: "Rename failed." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/threads/[id], removes the thread + cascades messages.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const email = await emailFromRequest(request);
  if (!email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const ok = await deleteThread(email, id);
  if (!ok) return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
