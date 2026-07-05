import type { MetadataRoute } from "next";

// Canonical host is the apex, matching lib/og-meta.ts (previously this used www, which
// conflicted with the canonical tags). Lists the live Vraelis marketing + public surfaces
// only; the app (/app/*), auth callbacks, and the API are intentionally excluded from
// indexing (robots also disallows /api and /account).
const BASE = "https://vraelis.com";

type Entry = MetadataRoute.Sitemap[number];
type Freq = NonNullable<Entry["changeFrequency"]>;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const page = (path: string, priority: number, changeFrequency: Freq = "monthly"): Entry => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });

  return [
    page("/", 1, "weekly"),
    page("/pricing", 0.9, "weekly"),
    page("/how-it-works", 0.8),
    page("/developers", 0.8),
    page("/enterprise", 0.7),
    page("/r/check", 0.7),      // public sample AI check
    page("/r/sample", 0.5),     // public sample human-validation report
    page("/contact", 0.5),
    page("/signin", 0.4, "yearly"),
    page("/privacy", 0.3, "yearly"),
    page("/terms", 0.3, "yearly"),
    page("/data-rights", 0.3, "yearly"),
    page("/trademark", 0.3, "yearly"),
  ];
}
