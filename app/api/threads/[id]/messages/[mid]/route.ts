import { NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../../../lib/desktop-auth";
import { getThread, updateMessageContent } from "../../../../../../lib/chat-history";

export const runtime = "nodejs";

async function emailFromRequest(request: Request): Promise<string | null> {
  const desktopEmail = await getDesktopUserEmailFromRequest(request);
  if (desktopEmail) return desktopEmail;
  const session = await auth();
  return session?.user?.email ?? null;
}

// PATCH /api/threads/[id]/messages/[mid]  Body: { content: string }
//
// Used by the client to mark a cancelled assistant message so the
// stored conversation reflects "(Cancelled by you.)" instead of just
// ending mid-token. Verifies the caller owns the parent thread.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; mid: string }> },
) {
  const { id, mid } = await params;
  const email = await emailFromRequest(request);
  if (!email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const thread = await getThread(email, id);
  if (!thread) return NextResponse.json({ error: "Thread not found." }, { status: 404 });

  const payload = (await request.json().catch(() => ({}))) as { content?: string };
  const content = typeof payload.content === "string" ? payload.content : "";
  if (content.length > 200_000) {
    return NextResponse.json({ error: "Content too large." }, { status: 413 });
  }

  await updateMessageContent(email, id, mid, content);
  return NextResponse.json({ ok: true });
}
