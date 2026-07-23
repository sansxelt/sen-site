import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    // /v/, /flip/ and /chat/ are RETIRED product surfaces whose pages were deleted; the proxy now redirects
    // them home. Disallowed anyway so crawlers stop spending crawl budget on redirect hops and so the old
    // URLs fall out of indexes as paths of their own.
    // /vote is the RETIRED human-evaluation surface and /guides the retired AI-output-QA content section;
    // both redirect (home / to /how-it-works) and must not be advertised for crawling.
    // /account is listed WITHOUT a trailing slash: the bare /account path is itself a retired route, and a
    // "/account/" rule would only match its subpaths.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/app/", "/account", "/auth/", "/v/", "/flip/", "/chat/", "/vote", "/guides"] },
    sitemap: "https://vraelis.com/sitemap.xml",
  };
}
