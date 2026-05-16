import type { MetadataRoute } from "next";
import { ARTICLES, TOPICS } from "../lib/learn-content";
import { listPublishedPieces } from "../lib/learn-db";

const BASE = "https://www.VRAELIS.ai";

// Sitemap covers marketing surfaces, every Learn topic page, and
// every published article from both sources (hardcoded ARTICLES +
// DB-backed learn_pieces). Without this Google has no way to
// discover the content pages.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const marketing: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/home`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/product`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/download`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/signin`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
  ];

  const learnHubs: MetadataRoute.Sitemap = [
    { url: `${BASE}/learn`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/learn/all`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    ...TOPICS.map((t) => ({
      url: `${BASE}/learn/topics/${t.key}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...TOPICS.flatMap((t) =>
      t.subtopics.map((s) => ({
        url: `${BASE}/learn/topics/${t.key}/${s.key}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ),
  ];

  const hardcodedArticles: MetadataRoute.Sitemap = ARTICLES.map((a) => ({
    url: `${BASE}/learn/${a.slug}`,
    lastModified: new Date(a.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  // DB pieces, fail-open: if Supabase is unreachable the rest of
  // the sitemap still serves so we never 500 the route.
  let dbArticles: MetadataRoute.Sitemap = [];
  try {
    const pieces = await listPublishedPieces({ limit: 500 });
    dbArticles = pieces.map((p) => ({
      url: `${BASE}/learn/p/${p.slug}`,
      lastModified: p.published_at ? new Date(p.published_at) : now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    }));
  } catch (err) {
    console.warn("sitemap: listPublishedPieces failed", err);
  }

  return [...marketing, ...learnHubs, ...hardcodedArticles, ...dbArticles];
}
