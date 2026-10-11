import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  // A review build (the *.vercel.app deployment sent for review) is never crawled at all.
  if (process.env.VRAELIS_REVIEW_LABEL) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    // Current public guides are crawlable. Private and retired product surfaces are excluded.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/app/", "/account", "/auth/", "/v/", "/flip/", "/chat/", "/vote", "/dev-preview/", "/signin", "/signup", "/pricing", "/checkout", "/workspace-entry"] },
    sitemap: "https://vraelis.com/sitemap.xml",
  };
}
