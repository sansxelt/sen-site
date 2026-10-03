// /llms.txt: the plain-text index an AI assistant reads to learn what Vraelis is and where its docs live.
//
// Everything here is generated from the same sources the site renders (positioning.ts for the sentence,
// coverage.ts for what works today, sectors.ts for the solutions, use-cases.ts for the recorded checks,
// docs.ts for the pages), so it cannot say something the site does not.
// The proxy's matcher skips *.txt, so this answers on every host without a rewrite.
import { stealthConfigured, verifyStealthCookie } from "@/lib/stealth";
import { SUPPORT } from "@/app/dev-preview/v6/_system/positioning";
import { SURFACES } from "@/app/dev-preview/v6/_content/coverage";
import { SECTORS } from "@/app/dev-preview/v6/_content/sectors";
import { USE_CASES } from "@/app/dev-preview/v6/_content/use-cases";
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
    // The sector pages and the recorded checks, the same lists the menus, the footer and /solutions read. The
    // URLs are built from the slug: s.href carries V6_BASE, which is a dev-preview path when the site is not
    // promoted. Each use case keeps its outcome line, which says what was checked (Larkspur is named there as
    // the simulated console Vraelis built), so a title is never read on its own as a real incident.
    "## Solutions",
    "",
    ...SECTORS.map((s) => `- [${s.label}](${SITE}${s.slug === "enterprise" ? "/enterprise" : `/solutions/${s.slug}`}): ${s.line}`),
    `- [All solutions](${SITE}/solutions)`,
    "",
    "## Use cases",
    "",
    ...USE_CASES.map((u) => `- [${u.title}](${SITE}/use-cases/${u.slug}): ${u.outcome}`),
    `- [All use cases](${SITE}/use-cases)`,
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
    // The API and CLI reference moved from /developers to the docs on 2026-10-02 (plan C, llms routes).
    `- [The API](${SITE}/docs/api)`,
    `- [The command line](${SITE}/docs/cli)`,
    `- [What changed](${SITE}/changelog)`,
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
