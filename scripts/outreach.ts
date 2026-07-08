/**
 * Outreach PREP script. Automates the two-hour part (find launches, dig up their public AI
 * copy, run it through our own check, pull the flag), NOT the send. It writes a CSV of
 * personalized rows; you open it each morning and hand-send ~10 in fifteen minutes.
 *
 * It NEVER sends anything. It hard-caps total checks (real money on a real card) and total
 * kept targets, and logs exact credit spend for the run.
 *
 * The personalization engine is our own product: every DM contains a real, verbatim flag on
 * the target's real copy, produced by POST /api/v1/check. That is what makes it not-spam.
 *
 * Run:  pnpm outreach            (needs VRAELIS_API_KEY in .env.local or the shell)
 * Env:
 *   VRAELIS_API_KEY   (required)  a Scale-plan API key with the tests:write scope
 *   VRAELIS_BASE_URL  (optional)  default https://vraelis.com
 *   PRODUCTHUNT_TOKEN (optional)  a PH developer token; without it, PH is skipped
 *   OUTREACH_MAX_CHECKS (optional) cost ceiling, default 30 checks = up to 30 credits
 *   OUTREACH_KEEP_CAP   (optional) stop after this many kept targets, default 10
 */

import { writeFileSync, existsSync, readFileSync } from "node:fs";

// ── env ────────────────────────────────────────────────────────────────────────
// Best-effort .env.local loader so `pnpm outreach` works without exporting vars by hand.
function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();

const API_KEY = process.env.VRAELIS_API_KEY || "";
const BASE = (process.env.VRAELIS_BASE_URL || "https://vraelis.com").replace(/\/$/, "");
const PH_TOKEN = process.env.PRODUCTHUNT_TOKEN || "";
const MAX_CHECKS = Math.max(1, Number(process.env.OUTREACH_MAX_CHECKS) || 30); // cost ceiling
const KEEP_CAP = Math.max(1, Number(process.env.OUTREACH_KEEP_CAP) || 10);
const UA = "VraelisOutreachBot/1.0 (+https://vraelis.com; research; contact hello@vraelis.com)";
const AI_RE = /\b(ai|a\.i\.|llm|gpt|genai|agent|agentic|copilot|chatbot|prompt|neural|ml|machine learning)\b/i;

if (!API_KEY) { console.error("Missing VRAELIS_API_KEY (set it in .env.local or the shell)."); process.exit(1); }

// ── tiny global rate limiter: at most 1 external request/sec ─────────────────────
let lastReq = 0;
async function paced<T>(fn: () => Promise<T>): Promise<T> {
  const wait = Math.max(0, 1000 - (Date.now() - lastReq));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastReq = Date.now();
  return fn();
}
async function getText(url: string, timeoutMs = 12000): Promise<string | null> {
  return paced(async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/json" }, signal: ctrl.signal, redirect: "follow" });
      clearTimeout(t);
      if (!res.ok) return null;
      return await res.text();
    } catch { return null; }
  });
}

// ── robots.txt (courtesy): skip a page our UA is disallowed from ─────────────────
const robotsCache = new Map<string, string[]>();
async function disallowedPrefixes(origin: string): Promise<string[]> {
  if (robotsCache.has(origin)) return robotsCache.get(origin)!;
  const txt = await getText(`${origin}/robots.txt`, 6000);
  const rules: string[] = [];
  if (txt) {
    let applies = false;
    for (const raw of txt.split("\n")) {
      const line = raw.replace(/#.*/, "").trim();
      const ua = line.match(/^user-agent:\s*(.*)$/i);
      if (ua) { applies = ua[1].trim() === "*"; continue; }
      const dis = line.match(/^disallow:\s*(.*)$/i);
      if (dis && applies && dis[1].trim()) rules.push(dis[1].trim());
    }
  }
  robotsCache.set(origin, rules);
  return rules;
}
async function mayFetch(url: string): Promise<boolean> {
  try {
    const u = new URL(url);
    const rules = await disallowedPrefixes(u.origin);
    return !rules.some((p) => u.pathname.startsWith(p));
  } catch { return false; }
}

// ── HTML → marketing copy + social handles (dependency-light) ────────────────────
function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&rsquo;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
function firstMatch(html: string, re: RegExp): string { const m = html.match(re); return m ? decode(m[1]).trim() : ""; }

function extractCopy(html: string): { copy: string; handles: string[] } {
  // social handles for a best-effort founder DM target
  const handles = [...html.matchAll(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]{2,15})(?:[/"'?]|$)/g)]
    .map((m) => m[1])
    .filter((h) => !/^(intent|share|home|hashtag|i|search|explore|privacy|tos|settings)$/i.test(h));

  const ogTitle = firstMatch(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || firstMatch(html, /<title[^>]*>([^<]+)<\/title>/i);
  const ogDesc = firstMatch(html, /<meta[^>]+(?:property|name)=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    || firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);

  // strip head + non-content chrome so we grab the hero, not the nav/footer
  const body = html
    .replace(/<head[\s\S]*?<\/head>/i, "")
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ");
  const strip = (s: string) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const h1 = strip(body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "");
  const h2 = strip(body.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] || "");
  const ps = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => strip(m[1])).filter((t) => t.length > 40).slice(0, 2);

  const seen = new Set<string>();
  const copy = [ogTitle, h1, ogDesc, h2, ...ps]
    .map((s) => s.trim()).filter(Boolean)
    .filter((s) => { const k = s.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .join("\n\n").slice(0, 1500);

  return { copy, handles: [...new Set(handles)] };
}

// ── launch sources ───────────────────────────────────────────────────────────────
type Launch = { company: string; url: string; hnAuthor?: string };

function companyFromTitle(title: string): string {
  return title.replace(/^show hn:\s*/i, "").replace(/\s*[-–|:].*$/, "").trim().slice(0, 80) || title.slice(0, 80);
}

async function fromHackerNews(): Promise<Launch[]> {
  const since = Math.floor(Date.now() / 1000) - 24 * 3600;
  // Show HN stories from the last 24h via the Algolia HN API (JSON, no scraping).
  const raw = await getText(`https://hn.algolia.com/api/v1/search_by_date?tags=show_hn&numericFilters=created_at_i>${since}&hitsPerPage=100`);
  if (!raw) return [];
  let hits: { title?: string; url?: string; author?: string }[] = [];
  try { hits = JSON.parse(raw).hits || []; } catch { return []; }
  return hits
    .filter((h) => h.url && h.title && AI_RE.test(h.title))
    .map((h) => ({ company: companyFromTitle(h.title!), url: h.url!, hnAuthor: h.author }));
}

async function fromProductHunt(): Promise<Launch[]> {
  if (!PH_TOKEN) { console.log("  Product Hunt: skipped (set PRODUCTHUNT_TOKEN to enable)."); return []; }
  const query = `{ posts(first: 40, order: RANKING, topic: "artificial-intelligence") { edges { node { name website tagline } } } }`;
  try {
    const res = await paced(() => fetch("https://api.producthunt.com/v2/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${PH_TOKEN}`, "user-agent": UA },
      body: JSON.stringify({ query }),
    }));
    if (!res.ok) { console.log(`  Product Hunt: API ${res.status}, skipping.`); return []; }
    const j = await res.json();
    const edges = j?.data?.posts?.edges || [];
    return edges
      .map((e: { node?: { name?: string; website?: string; tagline?: string } }) => e.node)
      .filter((n: { name?: string; website?: string; tagline?: string }) => n?.website && n?.name && AI_RE.test(`${n.name} ${n.tagline || ""}`))
      .map((n: { name: string; website: string }) => ({ company: n.name.slice(0, 80), url: n.website }));
  } catch (e) { console.log("  Product Hunt: fetch failed, skipping.", e); return []; }
}

// ── the check (our own API) ──────────────────────────────────────────────────────
type Flag = { span: string; issue: string; severity: string; why: string; fix: string };
type CheckResp = { id: string; credits_charged: number; flags: Flag[]; report_url?: string };

async function runCheck(company: string, copy: string): Promise<CheckResp | null> {
  try {
    const res = await fetch(`${BASE}/api/v1/check`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ output_type: "marketing_copy", candidates: [copy], title: `Outreach: ${company}`, share: true }),
    });
    if (!res.ok) { const b = await res.text().catch(() => ""); console.log(`  check failed ${res.status}: ${b.slice(0, 120)}`); return null; }
    return (await res.json()) as CheckResp;
  } catch (e) { console.log("  check error:", e); return null; }
}

// ── DM draft (no em dashes; lowercase prose, verbatim quotes) ─────────────────────
function draftDm(company: string, flag: Flag, reportUrl: string): string {
  return [
    `hey, saw you launched ${company}. i built a checker that flags lines in AI-generated copy that read risky before users see them, and i ran your landing page through it.`,
    ``,
    `mostly clean. it flagged this: "${flag.span}", ${flag.why} suggested fix: ${flag.fix}`,
    ``,
    `full report: ${reportUrl}`,
    ``,
    `free, no strings, i'm testing whether the flags are actually good on real copy. if it caught something you'd change, tell me. if it's wrong, tell me that, it's more useful.`,
  ].join("\n").replace(/—/g, ", ");
}

// ── CSV ──────────────────────────────────────────────────────────────────────────
function csvCell(v: string): string { return `"${String(v ?? "").replace(/"/g, '""')}"`; }

async function main() {
  console.log(`Outreach prep. base=${BASE}  max checks=${MAX_CHECKS}  keep cap=${KEEP_CAP}`);
  console.log("Finding launches (last 24h)...");
  const raw = [...(await fromHackerNews()), ...(await fromProductHunt())];

  // dedup by hostname (same product on HN + PH)
  const byHost = new Map<string, Launch>();
  for (const l of raw) {
    try { const host = new URL(l.url).hostname.replace(/^www\./, ""); if (!byHost.has(host)) byHost.set(host, l); } catch { /* skip bad url */ }
  }
  const launches = [...byHost.values()];
  console.log(`  ${launches.length} AI launches found (deduped).`);

  const rows: string[][] = [];
  let checksRun = 0, creditsSpent = 0, kept = 0;

  for (const l of launches) {
    if (kept >= KEEP_CAP) { console.log(`Reached keep cap (${KEEP_CAP}).`); break; }
    if (checksRun >= MAX_CHECKS) { console.log(`Reached check ceiling (${MAX_CHECKS}).`); break; }

    if (!(await mayFetch(l.url))) { console.log(`- ${l.company}: robots.txt disallows, skipping.`); continue; }
    const html = await getText(l.url);
    if (!html) { console.log(`- ${l.company}: could not fetch page.`); continue; }
    const { copy, handles } = extractCopy(html);
    if (copy.length < 60) { console.log(`- ${l.company}: no usable marketing copy.`); continue; }

    const check = await runCheck(l.company, copy);
    checksRun++;
    if (!check) continue;
    creditsSpent += check.credits_charged || 0;

    const hot = (check.flags || []).filter((f) => f.severity === "high" || f.severity === "medium")
      .sort((a, b) => (a.severity === "high" ? -1 : 1) - (b.severity === "high" ? -1 : 1));
    if (!hot.length) { console.log(`- ${l.company}: clean (no HIGH/MEDIUM flag), dropped.`); continue; }
    if (!check.report_url) { console.log(`- ${l.company}: flagged but no share link returned, skipping.`); continue; }

    const flag = hot[0];
    const founder = handles[0] ? `@${handles[0]}` : (l.hnAuthor ? `hn:${l.hnAuthor}` : "");
    rows.push([
      l.company, l.url, founder, flag.span, flag.severity, flag.fix, check.report_url,
      draftDm(l.company, flag, check.report_url),
    ]);
    kept++;
    console.log(`+ ${l.company}: kept (${flag.severity} ${flag.issue}). ${kept}/${KEEP_CAP}`);
  }

  const day = new Date().toISOString().slice(0, 10);
  const file = `outreach-${day}.csv`;
  const header = ["company", "url", "founder_handle", "flagged_line", "severity", "suggested_fix", "report_url", "drafted_dm"];
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
  writeFileSync(file, csv);

  console.log("");
  console.log(`Done. Wrote ${rows.length} rows to ${file}`);
  console.log(`Checks run: ${checksRun}  |  Credits spent: ${creditsSpent}  |  Kept: ${kept}`);
  console.log("Nothing was sent. Open the CSV, read each drafted_dm, and hand-send the good ones.");
}

main().catch((e) => { console.error("outreach failed:", e); process.exit(1); });
