import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    // /v/, /flip/ and /chat/ are RETIRED product surfaces kept alive only so existing links and data do not
    // break. They describe products Vraelis is not, so they must never compete in search or in a link
    // preview. Disallowed here AND noindexed in their own layouts, because robots.txt is a crawl hint while
    // the meta tag is what actually keeps an already-known URL out of an index.
    // /vote is the RETIRED human-evaluation surface and /guides the retired AI-output-QA content section;
    // both now redirect home / to /how-it-works, and must not be advertised for crawling.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/app/", "/account/", "/auth/", "/v/", "/flip/", "/chat/", "/vote", "/guides"] },
    sitemap: "https://vraelis.com/sitemap.xml",
  };
}
