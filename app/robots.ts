import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    // Current public guides are crawlable. Private and retired product surfaces are excluded.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/app/", "/account", "/auth/", "/v/", "/flip/", "/chat/", "/vote", "/dev-preview/", "/signin", "/signup", "/pricing", "/checkout", "/workspace-entry"] },
    sitemap: "https://vraelis.com/sitemap.xml",
  };
}
