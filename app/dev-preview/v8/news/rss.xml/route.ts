import { SITE_ORIGIN } from "@/lib/docs-host";
import { ARTICLES } from "../../_content/articles";

// The newsroom's RSS 2.0 feed: every story, newest first, with its summary and cover.
export const dynamic = "force-static";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rfc822 = (iso: string) => new Date(`${iso}T12:00:00Z`).toUTCString();

export function GET() {
  const items = ARTICLES.map((a) => {
    const url = `${SITE_ORIGIN}/news/${a.slug}`;
    return `    <item>
      <title>${esc(a.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${rfc822(a.date)}</pubDate>
      <category>${esc(a.kind)}</category>
      <description>${esc(a.dek)}</description>
    </item>`;
  }).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Vraelis News</title>
    <link>${SITE_ORIGIN}/news</link>
    <atom:link href="${SITE_ORIGIN}/news/rss.xml" rel="self" type="application/rss+xml"/>
    <description>Product updates, research and perspectives from Vraelis on trusted AI in the physical world.</description>
    <language>en</language>
    <lastBuildDate>${rfc822(ARTICLES[0].date)}</lastBuildDate>
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
