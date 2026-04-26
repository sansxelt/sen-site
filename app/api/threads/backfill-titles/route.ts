import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import { listMessages, listThreads } from "../../../../lib/chat-history";
import { generateAndSetThreadTitle } from "../../../../lib/thread-title";

export const runtime = "nodejs";

// POST /api/threads/backfill-titles
//
// Re-runs AI title generation for any of the user's threads whose
// current title still looks like a placeholder ("New chat") or a
// raw snippet of the first user message. Cheap (Haiku per thread)
// and idempotent, once a thread has a real title, it stays.
//
// Called silently from the chat history rail on mount so users who
// have old crap-titled threads ("jo", "hi", "yo") see their sidebar
// improve without doing anything.
export async function POST(request: Request) {
  let email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    const session = await auth();
    email = session?.user?.email ?? null;
  }
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const threads = await listThreads(email);
  if (threads.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  let updated = 0;
  // Process serially, Haiku is fast and we don't want to burst
  // against rate limits if the user has 50+ snippet-titled threads.
  for (const thread of threads) {
    const messages = await listMessages(email, thread.id);
    const firstUser = messages.find((m) => m.role === "user");
    const firstAssistant = messages.find((m) => m.role === "assistant");
    if (!firstUser || !firstAssistant) continue;

    if (!isSnippetTitle(thread.title, firstUser.content)) continue;

    try {
      await generateAndSetThreadTitle(email, thread.id);
      updated += 1;
    } catch (err) {
      console.warn("backfill-titles thread failed:", thread.id, err);
    }
  }

  return NextResponse.json({ updated });
}

// A title "looks like a placeholder" if it's the literal fallback,
// or it's effectively the first user message verbatim (with the
// usual truncation suffix). Anything else is treated as user-set
// or AI-generated and left alone.
function isSnippetTitle(title: string, firstUserContent: string): boolean {
  const t = title.trim();
  if (!t) return true;
  if (t === "New chat") return true;
  const first = firstUserContent.replace(/\s+/g, " ").trim();
  if (!first) return false;
  // Exact match to first user message.
  if (t === first) return true;
  // Truncated form (matches lib/chat-history.ts deriveTitle).
  if (t === first.slice(0, 59).trimEnd() + "…") return true;
  // Heuristic: the title is a strict prefix of the first message AND
  // very short (< 30 chars), also looks like the auto-snippet.
  if (t.length < 30 && first.toLowerCase().startsWith(t.toLowerCase())) return true;
  return false;
}
