// /llms.txt: the plain-text index an AI assistant reads to learn what Vraelis is and where its docs live.
//
// Everything here is generated from the same sources the site renders (positioning.ts for the sentence,
// coverage.ts for what works today, docs.ts for the pages), so it cannot say something the site does not.
// The proxy's matcher skips *.txt, so this answers on every host without a rewrite.
import { stealthConfigured, verifyStealthCookie } from "@/lib/stealth";
import { SUPPORT } from "@/app/dev-preview/v6/_system/positioning";
import { SURFACES } from "@/app/dev-preview/v6/_content/coverage";
import { DOCS, DOC_GROUPS } from "@/app/dev-preview/v6/_content/docs";

const SITE = "https://vraelis.com";

// Behind the stealth curtain this says nothing. *.txt skips the proxy, which is where the curtain lives, so
// the route checks for itself: a curtained site must not publish its docs as text.
export function GET(req: Request) {
  const cookie = /(?:^|;\s*)vr_stealth=([^;]+)/.exec(req.headers.get("cookie") ?? "")?.[1];
  if (stealthConfigured() && !verifyStealthCookie(cookie ? decodeURIComponent(cookie) : undefined)) {
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const tier = (t: string) => (t === "Next" ? "not built yet" : t.toLowerCase());
  const lines = [
    "# Vraelis",
    "",
    `> ${SUPPORT}`,
    "",
    "A person approves every plan before it runs; an API key or an AI assistant cannot approve one. Results are evidence of what the live product did on that run. They are not a certification or legal advice.",
    "",
    "## What it can check",
    "",
    ...SURFACES.map((s) => `- ${s.name} (${tier(s.tier)}): ${s.brief}`),
    "",
    ...DOC_GROUPS.flatMap((g) => [
      `## Docs: ${g}`,
      "",
      ...DOCS.filter((d) => d.group === g).map((d) => `- [${d.title}](${SITE}/docs/${d.slug}): ${d.summary}`),
      "",
    ]),
    "## More",
    "",
    `- [Every docs page as Markdown](${SITE}/llms-full.txt)`,
    `- [Connect an AI assistant over MCP](${SITE}/agents)`,
    `- [API and CLI](${SITE}/developers)`,
    `- [What changed](${SITE}/changelog)`,
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
