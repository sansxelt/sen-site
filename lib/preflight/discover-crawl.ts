// Bounded, same-origin, SSRF-safe discovery crawl. Deterministic + pure given an injected fetcher (the
// production fetcher wraps lib/safe-fetch.ts, which DNS-pins + blocks private IPs; tests inject a map).
// Every URL is re-validated before it enters the queue and before fetch. Hard bounds cap pages, depth,
// per-page + total bytes, and wall-clock. Raw HTML is never returned — only sanitized snapshots.
import crypto from "node:crypto";
import { normalizeUrl, originOf, isCrawlableSameOrigin } from "./url-policy";
import { extractSnapshot, type PageSnapshot } from "./discover-extract";

export type FetchResult = { ok: true; status: number; contentType: string; html: string } | { ok: false; reason: string; status?: number };
export type Fetcher = (url: string) => Promise<FetchResult>;
export type CrawlOptions = { maxPages?: number; maxDepth?: number; maxHtmlBytes?: number; maxTotalBytes?: number; maxMs?: number; now?: () => number };
export type DiscoverySnapshot = { state: "completed" | "partial" | "failed"; pages: PageSnapshot[]; failures: { url: string; reason: string }[]; contentHash: string; pagesCount: number; sourceUrl: string; truncated: boolean };

const DEFAULTS = { maxPages: 12, maxDepth: 2, maxHtmlBytes: 2 * 1024 * 1024, maxTotalBytes: 10 * 1024 * 1024, maxMs: 20000 };

export async function crawl(rootUrl: string, fetcher: Fetcher, opts: CrawlOptions = {}): Promise<DiscoverySnapshot> {
  const o = { ...DEFAULTS, ...opts };
  const now = o.now ?? (() => Date.now());
  const deadline = now() + o.maxMs;
  const root = normalizeUrl(rootUrl);
  if (!root) return { state: "failed", pages: [], failures: [{ url: rootUrl, reason: "invalid_or_blocked_root" }], contentHash: "", pagesCount: 0, sourceUrl: rootUrl, truncated: false };
  const origin = originOf(root)!;

  const seen = new Set<string>([root]);
  const queue: { url: string; depth: number }[] = [{ url: root, depth: 0 }];
  const pages: PageSnapshot[] = [];
  const failures: { url: string; reason: string }[] = [];
  let totalBytes = 0, truncated = false;

  while (queue.length && pages.length < o.maxPages) {
    if (now() > deadline) { truncated = true; break; }
    const { url, depth } = queue.shift()!;
    let res: FetchResult;
    try { res = await fetcher(url); } catch (e) { failures.push({ url, reason: `fetch_error: ${(e as Error).message}`.slice(0, 80) }); continue; }
    if (!res.ok) { failures.push({ url, reason: res.reason.slice(0, 80) }); continue; }
    if (!/text\/html/i.test(res.contentType)) { failures.push({ url, reason: "non_html" }); continue; }
    const bytes = Buffer.byteLength(res.html, "utf8");
    if (bytes > o.maxHtmlBytes) { failures.push({ url, reason: "page_too_large" }); continue; }
    totalBytes += bytes;
    if (totalBytes > o.maxTotalBytes) { truncated = true; failures.push({ url, reason: "total_budget_exceeded" }); break; }

    const snap = extractSnapshot(res.html, url, res.status);
    pages.push(snap);

    // Enqueue same-origin, crawlable, not-yet-seen children (bounded by depth).
    if (depth < o.maxDepth) {
      for (const link of snap.links) {
        const abs = link.startsWith("http") ? link : `${origin}${link.startsWith("/") ? "" : "/"}${link}`;
        const n = normalizeUrl(abs);
        if (!n || seen.has(n)) continue;
        if (!isCrawlableSameOrigin(n, origin)) continue;   // same-origin docs only; re-validates safety
        seen.add(n);
        queue.push({ url: n, depth: depth + 1 });
        if (seen.size > o.maxPages * 6) break;             // guard against link explosion
      }
    }
  }

  if (queue.length && pages.length >= o.maxPages) truncated = true;
  // Deterministic, content-free fingerprint of what was observed (url + title + indicators per page).
  const canonical = pages.map((p) => `${p.url}|${p.title}|${p.indicators.join(",")}`).sort().join("\n");
  const contentHash = crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 32);
  const state: DiscoverySnapshot["state"] = pages.length === 0 ? "failed" : failures.length || truncated ? "partial" : "completed";
  return { state, pages, failures: failures.slice(0, 40), contentHash, pagesCount: pages.length, sourceUrl: root, truncated };
}
