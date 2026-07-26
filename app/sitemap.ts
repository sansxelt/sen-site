import type { MetadataRoute } from "next";
import { publishedArticles } from "@/app/rank/research/_articles";
import { V6_EXACT, CLEAN_EXACT, v6Public } from "@/proxy";
import { DOCS } from "@/app/dev-preview/v6/_content/docs";

// The sitemap is DERIVED FROM THE ROUTING, not written alongside it.
//
// It used to be a hand-kept list, and the promotion showed why that fails. The moment
// NEXT_PUBLIC_VRAELIS_V6_PUBLIC was set, proxy.ts began serving design 06 at the clean paths and the
// sitemap did not know: it still advertised /how-it-works and /free-report, which are the PREVIOUS
// generation of the site, and it listed none of the nine routes design 06 added (/method, /platform,
// /agents, /company, /docs, /changelog, /integrations, /security, /readme). So the one file whose entire
// job is telling search engines what this site is was pointing them at the site being replaced and hiding
// the one that shipped.
//
// Importing the same maps proxy.ts routes with means the two cannot disagree again. If a route is added to
// V6_EXACT it appears here; if it is dropped, it stops appearing.
const BASE = "https://vraelis.com";

type Entry = MetadataRoute.Sitemap[number];
type Freq = NonNullable<Entry["changeFrequency"]>;

// Priority and change frequency are editorial, so they stay hand-set. Anything not named here is still
// listed, at a sensible default: a new route is included the moment it routes, rather than waiting for
// someone to remember this file.
const WEIGHT: Record<string, { p: number; f: Freq }> = {
  "/": { p: 1, f: "weekly" },
  "/pricing": { p: 0.9, f: "weekly" },
  "/platform": { p: 0.9, f: "monthly" },
  "/method": { p: 0.9, f: "monthly" },
  "/developers": { p: 0.8, f: "monthly" },
  "/docs": { p: 0.8, f: "weekly" },
  "/agents": { p: 0.8, f: "monthly" },
  "/enterprise": { p: 0.7, f: "monthly" },
  "/limitations": { p: 0.7, f: "monthly" },
  "/research": { p: 0.7, f: "weekly" },
  "/integrations": { p: 0.6, f: "monthly" },
  "/changelog": { p: 0.6, f: "weekly" },
  "/company": { p: 0.6, f: "monthly" },
  "/security": { p: 0.6, f: "monthly" },
  "/contact": { p: 0.5, f: "monthly" },
  "/readme": { p: 0.4, f: "monthly" },
  "/privacy": { p: 0.3, f: "yearly" },
  "/terms": { p: 0.3, f: "yearly" },
  "/refunds": { p: 0.3, f: "yearly" },
  "/subprocessors": { p: 0.3, f: "yearly" },
  "/data-rights": { p: 0.3, f: "yearly" },
  "/trademark": { p: 0.3, f: "yearly" },
};

// Never advertised, in either generation: a sign-in form and a checkout have nothing to index. /signin was
// previously listed, which is how a form ended up in the index.
const NEVER_INDEXED = new Set(["/signin", "/checkout"]);

// Advertised ONLY while design 06 is not serving.
//
// /how-it-works, /free-report, /demo and /sso still resolve after promotion, because the proxy falls
// through to the previous site for any clean path design 06 does not have, so an old bookmark keeps working
// rather than 404ing. That is right for a bookmark and wrong for a search engine: promoted, they render the
// previous generation's chrome and positioning, and nothing on the new site links to them. So they stay
// reachable and stop being advertised — but only once there is a newer site to be superseded by. Before
// promotion they ARE the live site and belong in the sitemap.
const SUPERSEDED_BY_V6 = new Set(["/how-it-works", "/free-report", "/demo", "/sso"]);

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entry = (path: string): Entry => {
    const w = WEIGHT[path] ?? { p: 0.5, f: "monthly" as Freq };
    return { url: `${BASE}${path}`, lastModified: now, changeFrequency: w.f, priority: w.p };
  };

  // Whichever generation is actually serving is the one described. Promoted, that is the design 06 map
  // plus any clean path it does not cover; unpromoted, it is the current site exactly as before.
  const promoted = v6Public();
  const serving = promoted
    ? [...new Set([...Object.keys(V6_EXACT), ...Object.keys(CLEAN_EXACT)])]
    : Object.keys(CLEAN_EXACT);

  const pages = serving
    .filter((p) => !NEVER_INDEXED.has(p) && !(promoted && SUPERSEDED_BY_V6.has(p)))
    .sort((a, b) => (WEIGHT[b]?.p ?? 0.5) - (WEIGHT[a]?.p ?? 0.5) || a.localeCompare(b))
    .map(entry);

  // TWO SECTIONS ROUTE BY PREFIX RATHER THAN BY AN EXACT MAPPING, so neither can come from the maps above
  // and both have to be listed explicitly. That is the seam this file has to keep watching: derivation
  // covers every exact route automatically, and silently covers no prefix route at all.

  // Research articles still render from the previous site (design 06's /research is a thesis page with
  // anchors, not an index of these), and nothing on the new site links to them, so they are listed only
  // while they remain the real published writing. Unpublished ones are filtered out and 404.
  const articles = publishedArticles().map((a) => ({
    url: `${BASE}/research/${a.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as Freq,
    priority: 0.6,
  }));

  // Docs articles are design 06's own, routed at /docs/<slug> by the prefix rule in proxy.ts. They return
  // 200 with index,follow and are linked from /docs, so they would be crawled eventually; being absent from
  // the sitemap only made that slower and less reliable. They exist as public pages just once promoted.
  const docs = promoted
    ? DOCS.map((d) => ({
        url: `${BASE}/docs/${d.slug}`,
        lastModified: now,
        changeFrequency: "monthly" as Freq,
        priority: 0.6,
      }))
    : [];

  return [...pages, ...docs, ...articles];
}
