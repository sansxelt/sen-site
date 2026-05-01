import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import {
  deleteThread,
  getThread,
  listMessages,
  renameThread,
  setThreadAutoRename,
  setThreadProject,
} from "../../../../lib/chat-history";
import { getProjectWithPins } from "../../../../lib/projects";

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

// PATCH /api/threads/[id], body: { title? } and/or { project_id? }.
// project_id may be a uuid (assign), null (detach), or omitted
// (untouched). When assigning, we verify the project belongs to the
// caller before writing.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const email = await emailFromRequest(request);
  if (!email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const payload = (await request.json().catch(() => ({}))) as {
    title?: string;
    project_id?: string | null;
    auto_rename?: boolean;
  };

  let didTouch = false;

  if (typeof payload.title === "string") {
    if (!payload.title.trim()) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }
    // Manual rename: byUser=true (default) clears auto_rename so
    // the AI title regen stops overwriting the user's choice.
    const ok = await renameThread(email, id, payload.title);
    if (!ok) return NextResponse.json({ error: "Rename failed." }, { status: 500 });
    didTouch = true;
  }

  if (typeof payload.auto_rename === "boolean") {
    const ok = await setThreadAutoRename(email, id, payload.auto_rename);
    if (!ok) {
      return NextResponse.json({ error: "Auto-rename toggle failed." }, { status: 500 });
    }
    didTouch = true;
  }

  if (payload.project_id !== undefined) {
    let nextId: string | null = null;
    if (payload.project_id) {
      // Confirm caller owns the project before linking the thread.
      const project = await getProjectWithPins(email, payload.project_id);
      if (!project) {
        return NextResponse.json({ error: "Project not found." }, { status: 404 });
      }
      nextId = project.id;
    }
    const ok = await setThreadProject(email, id, nextId);
    if (!ok) return NextResponse.json({ error: "Project assign failed." }, { status: 500 });
    didTouch = true;
  }

  if (!didTouch) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
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
