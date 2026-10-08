// Current public guides as Markdown. Historical implementation guides remain in the docs archive.
import { stealthConfigured, verifyStealthCookie } from "@/lib/stealth";
import { SUPPORT } from "@/app/dev-preview/v6/_system/positioning";
import { SECURITY_PAGES } from "@/app/dev-preview/v6/_content/security-direction";
import { CURRENT_DOC_SLUGS, getDoc, docToMarkdown } from "@/app/dev-preview/v6/_content/docs";

export function GET(req: Request) {
  const cookie = /(?:^|;\s*)vr_stealth=([^;]+)/.exec(req.headers.get("cookie") ?? "")?.[1];
  if (stealthConfigured() && !verifyStealthCookie(cookie ? decodeURIComponent(cookie) : undefined)) {
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const intro = `# Vraelis\n\n${SUPPORT}\n\n## First product\n\n${SECURITY_PAGES.contour.intro}\nSource: https://vraelis.com/contour\n\nPublic workspace access is closed. These guides describe private development and supported reference components.\n`;
  const docs = CURRENT_DOC_SLUGS.map(slug => { const doc = getDoc(slug)!; return `${docToMarkdown(doc)}\nSource: https://vraelis.com/docs/${doc.slug}\n`; }).join("\n---\n\n");
  return new Response(`${intro}\n---\n\n${docs}`, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": stealthConfigured() ? "private, no-store" : "public, max-age=3600" },
  });
}
