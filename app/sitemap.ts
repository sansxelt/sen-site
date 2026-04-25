import type { MetadataRoute } from "next";

const BASE = "https://www.sansxel.ai";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE,                  lastModified: new Date(), changeFrequency: "weekly",  priority: 1 },
    { url: `${BASE}/pricing`,     lastModified: new Date(), changeFrequency: "weekly",  priority: 0.9 },
    { url: `${BASE}/features`,    lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/download`,    lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/contact`,     lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/auth/signin`, lastModified: new Date(), changeFrequency: "yearly",  priority: 0.4 },
  ];
}
