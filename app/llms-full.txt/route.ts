// /llms-full.txt: every docs page as Markdown, in reading order, for assistants that want the whole thing in
// one request. Built with the same docToMarkdown the "Copy as Markdown" button uses.
import { stealthConfigured, verifyStealthCookie } from "@/lib/stealth";
import { SURFACES } from "@/app/dev-preview/v6/_content/coverage";
import { DOCS, docToMarkdown } from "@/app/dev-preview/v6/_content/docs";

// Behind the stealth curtain this says nothing. *.txt skips the proxy, which is where the curtain lives, so
// the route checks for itself: a curtained site must not publish its docs as text.
export function GET(req: Request) {
  const cookie = /(?:^|;\s*)vr_stealth=([^;]+)/.exec(req.headers.get("cookie") ?? "")?.[1];
  if (stealthConfigured() && !verifyStealthCookie(cookie ? decodeURIComponent(cookie) : undefined)) {
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const surfaces = SURFACES.map((s) => ({ name: s.name, brief: s.brief, tier: s.tier === "Next" ? "Not built yet" : s.tier }));
  const body = DOCS.map((d) => `${docToMarkdown(d, surfaces)}\nSource: https://vraelis.com/docs/${d.slug}\n`).join("\n---\n\n");
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
