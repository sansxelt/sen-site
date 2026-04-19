import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";

type ShareMessage = { role: "user" | "assistant"; content: string };

type SharePayload = {
  thread_id?: unknown;
  title?: unknown;
  messages?: unknown;
};

const PUBLIC_SHARE_BASE = "https://sansxel.ai/s";

function makePublicId(): string {
  // 9 bytes of base64url ≈ 12 chars, plenty of entropy + readable URL.
  return randomBytes(9).toString("base64url");
}

function isShareMessage(value: unknown): value is ShareMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as { role?: unknown; content?: unknown };
  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string"
  );
}

// POST /api/threads/share — accept a snapshot of a thread, persist it,
// return a stable share URL the desktop can copy to the clipboard.
// The public viewing page (https://sansxel.ai/s/{id}) ships in v0.1.5.
export async function POST(request: Request) {
  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: SharePayload;
  try {
    payload = (await request.json()) as SharePayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const threadId = typeof payload.thread_id === "string" ? payload.thread_id.trim() : "";
  const title =
    typeof payload.title === "string" && payload.title.trim()
      ? payload.title.trim().slice(0, 200)
      : "Shared chat";
  const rawMessages = Array.isArray(payload.messages) ? payload.messages : null;

  if (!threadId || !rawMessages) {
    return NextResponse.json(
      { error: "thread_id and messages are required." },
      { status: 400 },
    );
  }

  const messages = rawMessages.filter(isShareMessage);
  if (messages.length === 0) {
    return NextResponse.json(
      { error: "Thread has no shareable messages." },
      { status: 400 },
    );
  }

  const publicId = makePublicId();

  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("shared_threads" as never)
      .insert([
        {
          id: publicId,
          owner_email: email,
          title,
          messages,
        },
      ] as never);
    if (error) throw error;
  } catch (err) {
    console.error("threads.share failed:", err);
    return NextResponse.json(
      { error: "Could not create share link." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      share_url: `${PUBLIC_SHARE_BASE}/${publicId}`,
      public_id: publicId,
    },
    { status: 201 },
  );
}
