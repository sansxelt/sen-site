import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import { getPlanForEmail } from "../../../../lib/account-billing";
import { descriptorForTier } from "../../../../lib/ai-models";
import { recordUsage } from "../../../../lib/usage";
import { decideDeepResearchRequest } from "../../../../lib/plan-limits";

export const runtime = "nodejs";

const client = new Anthropic();

// POST /api/ai/deep-research
// Body: { topic: string }
// Streams a multi-source synthesis (text/plain).
//
// Pipeline:
//   1. Run a Brave web search via the internal /api/ai/web-search route.
//   2. For the top 3 results, fetch the page and strip HTML to plain text.
//   3. Compose a synthesis prompt with the gathered context.
//   4. Stream the synthesis from sansxel-1 (Sonnet/balanced tier).

const MAX_PAGES = 3;
const MAX_PAGE_CHARS = 3000;
const FETCH_TIMEOUT_MS = 8000;

const SYSTEM_PROMPT = `You are sansxel-1's deep research mode.

You are given a topic and several short excerpts pulled from web pages.
Synthesize a clear, well-structured briefing on the topic.

Rules:
- Lead with the answer, no preamble.
- Use markdown: short intro paragraph, then headed sections, then a brief takeaway.
- Cite sources inline as [1], [2], [3] matching the order of the provided excerpts.
- End with a "Sources" list mapping each number to its URL.
- If the excerpts are thin or contradictory, say so honestly.
- Skip filler. Keep the writing tight.`;

type DeepResearchBody = { topic?: unknown };

type SearchResult = { title: string; url: string; snippet: string };

function originFromRequest(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

async function runWebSearch(
  request: Request,
  topic: string,
): Promise<SearchResult[]> {
  // Reuse the existing /api/ai/web-search route by calling it with the
  // same auth headers we received. Avoids re-implementing Brave glue.
  const origin = originFromRequest(request);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const authHeader = request.headers.get("authorization");
  if (authHeader) headers.Authorization = authHeader;
  const cookie = request.headers.get("cookie");
  if (cookie) headers.cookie = cookie;
  const surface = request.headers.get("x-sansxel-surface");
  if (surface) headers["x-sansxel-surface"] = surface;

  const res = await fetch(`${origin}/api/ai/web-search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: topic }),
  });
  if (!res.ok) {
    throw new Error(`web-search ${res.status}`);
  }
  const data = (await res.json()) as { results?: SearchResult[] };
  return Array.isArray(data.results) ? data.results : [];
}

function stripHtml(html: string): string {
  return html
    // Drop scripts/styles wholesale.
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    // All other tags: just remove the tag.
    .replace(/<[^>]+>/g, " ")
    // Common entities.
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Collapse whitespace.
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPageText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; sansxel-deep-research/1.0; +https://sansxel.ai)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return "";
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      return "";
    }
    const html = await res.text();
    const text = stripHtml(html);
    return text.slice(0, MAX_PAGE_CHARS);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  let email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    const session = await auth();
    email = session?.user?.email ?? null;
  }
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: DeepResearchBody;
  try {
    payload = (await request.json()) as DeepResearchBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const topic = typeof payload.topic === "string" ? payload.topic.trim() : "";
  if (!topic) {
    return NextResponse.json({ error: "Missing topic." }, { status: 400 });
  }
  const safeTopic = topic.slice(0, 400);

  // Plan gate — Plus / Pro / Teams / Enterprise only.
  const plan = await getPlanForEmail(email);
  const decision = decideDeepResearchRequest({ plan });
  if (decision.kind === "blocked") {
    return NextResponse.json(
      {
        error: decision.reason,
        limit: decision.limit,
        used: decision.used,
        reset: decision.reset,
      },
      { status: 429 },
    );
  }

  const surface =
    request.headers.get("x-sansxel-surface") === "desktop" ? "desktop" : "web";

  // 1) Web search
  let searchResults: SearchResult[] = [];
  try {
    searchResults = await runWebSearch(request, safeTopic);
  } catch (err) {
    console.error("deep-research search failed:", err);
    return NextResponse.json(
      { error: "Could not run web search for this topic." },
      { status: 502 },
    );
  }

  if (searchResults.length === 0) {
    return NextResponse.json(
      { error: "No web results for this topic." },
      { status: 404 },
    );
  }

  // 2) Fetch top-3 pages in parallel
  const top = searchResults.slice(0, MAX_PAGES);
  const pageTexts = await Promise.all(top.map((r) => fetchPageText(r.url)));

  // 3) Compose synthesis prompt
  const excerpts = top
    .map((r, i) => {
      const body = pageTexts[i] || r.snippet || "(no readable content)";
      return `[${i + 1}] ${r.title}\nURL: ${r.url}\nExcerpt:\n${body}`;
    })
    .join("\n\n---\n\n");

  const userMessage = `Topic: ${safeTopic}\n\nGathered excerpts:\n\n${excerpts}\n\nWrite the briefing now.`;

  // Always use the balanced tier for deep research synthesis. Plus
  // and up are guaranteed to have it via the plan gate above, so we
  // bypass resolveTier and go straight to Sonnet.
  const descriptor = descriptorForTier("balanced");

  try {
    const stream = await client.messages.stream({
      model: descriptor.model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const startedAt = Date.now();
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        let inputTokens = 0;
        let outputTokens = 0;
        try {
          for await (const event of stream) {
            if (event.type === "message_start") {
              inputTokens = event.message?.usage?.input_tokens ?? 0;
            }
            if (event.type === "message_delta") {
              outputTokens = event.usage?.output_tokens ?? outputTokens;
            }
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
        } catch (err) {
          console.error("ai/deep-research stream error:", err);
        } finally {
          controller.close();
          void recordUsage({
            email,
            kind: "deep_research",
            model: descriptor.model,
            surface,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            total_tokens: inputTokens + outputTokens,
            duration_ms: Date.now() - startedAt,
          });
        }
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "x-sansxel-plan": plan,
        "x-sansxel-sources": String(top.length),
      },
    });
  } catch (err) {
    console.error("ai/deep-research failed:", err);
    return NextResponse.json(
      { error: "Could not start deep research." },
      { status: 500 },
    );
  }
}
