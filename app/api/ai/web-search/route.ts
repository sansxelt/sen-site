import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import { recordUsage } from "../../../../lib/usage";

export const runtime = "nodejs";

// POST /api/ai/web-search
// Body: { query: string }
// Returns: { results: Array<{ title, url, snippet }> } (capped at 8)
//
// Thin wrapper over Brave Search. Auth follows the same dual pattern
// as the other AI routes (Bearer token for desktop, NextAuth cookie
// for web). Surface header is mirrored into the usage event so the
// dashboard can split desktop vs web queries.

const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const MAX_RESULTS = 8;

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

type BraveWebResult = {
  title?: string;
  url?: string;
  description?: string;
};

type BraveResponse = {
  web?: {
    results?: BraveWebResult[];
  };
};

export async function POST(request: Request) {
  let email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    const session = await auth();
    email = session?.user?.email ?? null;
  }
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: { query?: unknown };
  try {
    payload = (await request.json()) as { query?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const query =
    typeof payload.query === "string" ? payload.query.trim() : "";
  if (!query) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }
  // Cap query length so a runaway message can't get the API to choke.
  const safeQuery = query.slice(0, 400);

  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Web search is not configured on this server." },
      { status: 503 },
    );
  }

  const surface =
    request.headers.get("x-sansxel-surface") === "desktop" ? "desktop" : "web";

  const startedAt = Date.now();
  try {
    const url = new URL(BRAVE_ENDPOINT);
    url.searchParams.set("q", safeQuery);
    url.searchParams.set("count", String(MAX_RESULTS));

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!res.ok) {
      console.warn("brave search failed:", res.status, await res.text().catch(() => ""));
      return NextResponse.json(
        { error: `Web search failed (${res.status}).` },
        { status: 502 },
      );
    }

    const data = (await res.json()) as BraveResponse;
    const raw = Array.isArray(data.web?.results) ? data.web!.results! : [];
    const results: WebSearchResult[] = raw
      .slice(0, MAX_RESULTS)
      .map((r) => ({
        title: typeof r.title === "string" ? r.title : "",
        url: typeof r.url === "string" ? r.url : "",
        snippet: typeof r.description === "string" ? r.description : "",
      }))
      .filter((r) => r.url && r.title);

    void recordUsage({
      email,
      kind: "web_search",
      model: "brave-search",
      surface,
      input_tokens: safeQuery.length,
      duration_ms: Date.now() - startedAt,
    });

    return NextResponse.json({ results });
  } catch (err) {
    console.error("ai/web-search failed:", err);
    return NextResponse.json(
      { error: "Could not run web search." },
      { status: 500 },
    );
  }
}
