// Machine-readable public index. Company, product and current guides use the site's own sources.
import { stealthConfigured, verifyStealthCookie } from "@/lib/stealth";
import { SUPPORT } from "@/app/dev-preview/v6/_system/positioning";
import { SECURITY_PAGES } from "@/app/dev-preview/v6/_content/security-direction";
import { PRIMARY_SECTORS } from "@/app/dev-preview/v6/_content/sectors";
import { CURRENT_DOC_SLUGS, getDoc } from "@/app/dev-preview/v6/_content/docs";

const SITE = "https://vraelis.com";
export function GET(req: Request) {
  const cookie = /(?:^|;\s*)vr_stealth=([^;]+)/.exec(req.headers.get("cookie") ?? "")?.[1];
  if (stealthConfigured() && !verifyStealthCookie(cookie ? decodeURIComponent(cookie) : undefined)) {
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const lines = [
    "# Vraelis", "", `> ${SUPPORT}`, "",
    "Vraelis is in private development. Public workspace access is closed. These references do not describe an available deployment.", "",
    "## Company and security scope", "",
    `- [Company](${SITE}/company)`,
    `- [AI cybersecurity scope](${SITE}/platform)`,
    `- [Research](${SITE}/research)`, "",
    "## First product", "",
    `- [Vraelis Contour](${SITE}/contour): ${SECURITY_PAGES.contour.intro}`, "",
    "## Application areas", "",
    ...PRIMARY_SECTORS.map(s => `- [${s.label}](${SITE}${s.href.replace(/^\/dev-preview\/v6/, "")}): ${s.line}`),
    `- [Government and institutions](${SITE}/government)`,
    `- [System integrators](${SITE}/integrators)`,
    `- [Enterprise](${SITE}/enterprise)`, "",
    "## Current documentation", "",
    ...CURRENT_DOC_SLUGS.map(slug => { const doc = getDoc(slug)!; return `- [${doc.title}](${SITE}/docs/${doc.slug}): ${doc.summary}`; }), "",
    "## Further reading", "",
    `- [Current guides as Markdown](${SITE}/llms-full.txt)`,
    `- [Development status](${SITE}/beta)`,
    `- [Scope and limitations](${SITE}/limitations)`,
    `- [Security](${SITE}/security)`,
    `- [Changelog](${SITE}/changelog)`, "",
  ];
  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": stealthConfigured() ? "private, no-store" : "public, max-age=3600" },
  });
}
