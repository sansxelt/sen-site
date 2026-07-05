import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/app/", "/account/", "/auth/"] },
    sitemap: "https://vraelis.com/sitemap.xml",
  };
}
