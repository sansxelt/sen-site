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
 * Debug: OUTREACH_EXTRACT_URL=https://example.com pnpm outreach
 *        prints exactly what the checker would see for one URL (no check, no cost, no key)
 * Env:
 *   VRAELIS_API_KEY   (required)  a Scale-plan API key with the tests:write scope
 *   VRAELIS_BASE_URL  (optional)  default https://vraelis.com
 *   PRODUCTHUNT_TOKEN (optional)  a PH developer token; without it, PH is skipped
 *   OUTREACH_MAX_CHECKS (optional) cost ceiling, default 40 checks = up to 40 credits
 *   OUTREACH_KEEP_CAP   (optional) stop after this many kept targets, default 25
 *   OUTREACH_QUALIFY_MIN (optional) min net text-generation signal to qualify, default 1
 *
 * Sources: Show HN + Product Hunt (token) + BetaList are live. YC directory and There's An
 * AI For That are NOT wired (YC is JS/Algolia with rotating keys; TAAFT sits behind a
 * Cloudflare challenge) -- add them only when there's a stable feed to hit.
 *
 * Qualification: the checker only helps products whose OUTPUT is prose a human reads. Each
 * target's copy is scored for text-generation signal and anything below the bar is skipped
 * BEFORE a credit is spent. The CSV is sorted best-fit first.
 *
 * Seen ledger (outreach-seen.txt): every domain we check or qualify-skip is recorded and
 * never processed again on a later run. A duplicate cold email is worse than no email.
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
const MAX_CHECKS = Math.max(1, Number(process.env.OUTREACH_MAX_CHECKS) || 40); // cost ceiling
const KEEP_CAP = Math.max(1, Number(process.env.OUTREACH_KEEP_CAP) || 25);
const QUALIFY_MIN = (process.env.OUTREACH_QUALIFY_MIN != null && process.env.OUTREACH_QUALIFY_MIN !== "")
  ? Number(process.env.OUTREACH_QUALIFY_MIN) : 1; // min net text-generation signal to qualify
const UA = "VraelisOutreachBot/1.0 (+https://vraelis.com; research; contact hello@vraelis.com)";
const AI_RE = /\b(ai|a\.i\.|llm|gpt|genai|agent|agentic|copilot|chatbot|prompt|neural|ml|machine learning)\b/i;

// ── qualification: does this product generate text a human reads? ──────────────────
// The checker only helps products whose OUTPUT is prose a person reads (support replies,
// chat, drafted emails, generated copy). A device-automation, robotics, or image tool can
// have flawless copy and still be a non-fit. fitScore = (text-generation signals) minus
// (non-text signals) in the scraped copy; higher = better fit. Anything below QUALIFY_MIN is
// skipped BEFORE a credit is spent, and the CSV is sorted best-fit first.
const TEXT_SIGNAL = /\b(writ(?:e|es|ing|ten)|generat(?:e|es|ing|ion|ive)|draft(?:s|ing|ed)?|repl(?:y|ies|ied)|emails?|messages?|messaging|copywriting|copy|content|chat(?:bot|s)?|conversations?|conversational|respon(?:d|se|ses|ds)|summar(?:y|ies|ize|ise|ization)|captions?|comments?|paraphrase|rewrite|rephrase|compose|answers?|answering|support|tickets?|blogs?|articles?|posts?|newsletters?|descriptions?|documentation|transcri(?:be|pt|ption)|translat(?:e|ion|es)|proofread|essays?|scripts?|prose|prompts?)\b/gi;
const NONTEXT_SIGNAL = /\b(images?|photos?|videos?|avatars?|3d|renders?|rendering|robot(?:ic|ics)?|hardware|devices?|drones?|sensors?|firmware|voice call|phone call|dialer|taps?|swipes?|spreadsheets?|crawl(?:er|ing)?|scrap(?:e|er|ing))\b/gi;
function fitScore(copy: string): number {
  return (copy.match(TEXT_SIGNAL) || []).length - (copy.match(NONTEXT_SIGNAL) || []).length;
}

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

// ── HTML → marketing copy (dependency-light) ─────────────────────────────────────
function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&rsquo;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
function firstMatch(html: string, re: RegExp): string { const m = html.match(re); return m ? decode(m[1]).trim() : ""; }
const normLine = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();

// Names of demo / mockup / code surfaces. Targets BEM element suffixes (__task, __log) and
// code-token prefixes (tk-) seen in agent-demo widgets, NOT bare "stage" or "hero" which
// often wrap the real headline too.
const DEMO_RE = /demo|example|examples|playground|prompt|terminal|snippet|sandbox|repl|console|widget|mockup|__task|__log|log-row|tk-/i;

// Remove the WHOLE subtree of any element whose class/id names it a demo surface. Depth-
// counts the matching close tag so nested <div>s inside the widget can't leave the example
// prompt behind (a plain non-greedy regex mispairs on the first inner </div>).
function stripDemoSubtrees(html: string): string {
  const open = /<([a-z][a-z0-9]*)\b([^>]*)>/gi;
  let s = html;
  for (let guard = 0; guard < 1000; guard++) {
    open.lastIndex = 0;
    let m: RegExpExecArray | null = null, hit: { start: number; tag: string; after: number } | null = null;
    while ((m = open.exec(s))) {
      if (m[0].endsWith("/>")) continue;
      const clsId = (m[2].match(/\b(?:class|id)\s*=\s*["']([^"']*)["']/gi) || []).join(" ");
      if (DEMO_RE.test(clsId)) { hit = { start: m.index, tag: m[1], after: open.lastIndex }; break; }
    }
    if (!hit) break;
    const close = new RegExp(`</?${hit.tag}\\b[^>]*>`, "gi");
    close.lastIndex = hit.after;
    let depth = 1, end = -1, c: RegExpExecArray | null = null;
    while ((c = close.exec(s))) {
      if (c[0].endsWith("/>")) continue;
      if (c[0][1] === "/") { if (--depth === 0) { end = close.lastIndex; break; } } else depth++;
    }
    if (end === -1) break; // unbalanced; stop rather than loop
    s = s.slice(0, hit.start) + " " + s.slice(end);
  }
  return s;
}

// Drop demo/example/placeholder chrome BEFORE reading copy, so an example prompt inside a
// demo widget ("Open Stripe and export this week's payouts") is never mistaken for marketing
// copy. Removes code/pre/kbd/button/inputs and any element named demo/example/prompt/etc.
function stripNonCopy(html: string): string {
  let b = html.replace(/<head[\s\S]*?<\/head>/i, "");
  b = b.replace(/<(script|style|noscript|svg|nav|footer|header|code|pre|kbd|samp|button|input|textarea|select|form|output)\b[\s\S]*?<\/\1>/gi, " ");
  return stripDemoSubtrees(b);
}

type Extracted = { copy: string; handles: string[]; dropped: string[] };

function extractCopy(html: string): Extracted {
  // social handles for a best-effort founder DM target
  const handles = [...html.matchAll(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]{2,15})(?:[/"'?]|$)/g)]
    .map((m) => m[1])
    .filter((h) => !/^(intent|share|home|hashtag|i|search|explore|privacy|tos|settings)$/i.test(h));

  const ogTitle = firstMatch(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || firstMatch(html, /<title[^>]*>([^<]+)<\/title>/i);
  const ogDesc = firstMatch(html, /<meta[^>]+(?:property|name)=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    || firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);

  const body = stripNonCopy(html);
  const strip = (s: string) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const h1 = strip(body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "");
  const h2 = strip(body.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] || "");
  const ps = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => strip(m[1])).filter((t) => t.length > 40).slice(0, 4);

  const candidates = [ogTitle, h1, ogDesc, h2, ...ps].map((s) => s.trim()).filter(Boolean);

  // Dedupe: drop exact (normalized) repeats, substrings, AND near-duplicates, so the
  // <title> / <h1> / og:description (three phrasings of the same hero line) don't read to
  // the checker as "the opening repeats". Near-duplicate = a line whose significant
  // (non-stopword) tokens are mostly present in a longer kept line.
  const STOP = new Set("a an the of to and or for in on at is are be with into from this that it its as your you our we my i".split(" "));
  const sigTokens = (n: string) => n.split(" ").filter((w) => w.length >= 2 && !STOP.has(w));
  const nearDup = (aSig: string[], bNorm: string) => {
    if (aSig.length < 2) return false;
    const bSet = new Set(bNorm.split(" "));
    return aSig.filter((w) => bSet.has(w)).length / aSig.length >= 0.5;
  };
  const entries = candidates.map((raw, i) => ({ raw, i, n: normLine(raw) })).filter((e) => e.n.length > 0);
  const keep = new Set<number>();
  const keptNorms: string[] = [];
  for (const e of [...entries].sort((a, b) => b.n.length - a.n.length)) { // longest first
    const eSig = sigTokens(e.n);
    if (keptNorms.some((kn) => kn.includes(e.n) || nearDup(eSig, kn))) continue; // dup / substring / near-dup
    keep.add(e.i); keptNorms.push(e.n);
  }
  const kept = entries.filter((e) => keep.has(e.i)).sort((a, b) => a.i - b.i).map((e) => e.raw);
  const dropped = entries.filter((e) => !keep.has(e.i)).map((e) => e.raw);

  return { copy: kept.join("\n\n").slice(0, 1500), handles: [...new Set(handles)], dropped };
}

// ── launch sources ───────────────────────────────────────────────────────────────
type Launch = { company: string; url: string; source: string; hnUser?: string };

function companyFromTitle(title: string): string {
  return title.replace(/^show hn:\s*/i, "").replace(/\s*[-–|:].*$/, "").trim().slice(0, 80) || title.slice(0, 80);
}

async function fromHackerNews(): Promise<Launch[]> {
  const since = Math.floor(Date.now() / 1000) - 24 * 3600;
  const raw = await getText(`https://hn.algolia.com/api/v1/search_by_date?tags=show_hn&numericFilters=created_at_i>${since}&hitsPerPage=100`);
  if (!raw) return [];
  let hits: { title?: string; url?: string; author?: string }[] = [];
  try { hits = JSON.parse(raw).hits || []; } catch { return []; }
  return hits
    .filter((h) => h.url && h.title && AI_RE.test(h.title))
    .map((h) => ({ company: companyFromTitle(h.title!), url: h.url!, source: "Show HN", hnUser: h.author }));
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
      .map((n: { name: string; website: string }) => ({ company: n.name.slice(0, 80), url: n.website, source: "Product Hunt" }));
  } catch (e) { console.log("  Product Hunt: fetch failed, skipping.", e); return []; }
}

// BetaList: the homepage lists new startups as /startups/<slug>. Each startup page carries an
// og:title / og:description (name + tagline, for the AI filter) and a /startups/<slug>/visit
// link that 301s to the product's real URL. Best-effort: any markup change degrades to zero
// rows, never throws. Costs ~1 request per startup page + 1 per visit-redirect (paced 1/sec).
async function resolveLocation(url: string): Promise<string> {
  return paced(async () => {
    try { const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "manual" }); return res.headers.get("location") || ""; }
    catch { return ""; }
  });
}
async function fromBetaList(limit = 15): Promise<Launch[]> {
  const home = await getText("https://betalist.com/");
  if (!home) { console.log("  BetaList: could not fetch, skipping."); return []; }
  const slugs = [...new Set([...home.matchAll(/href="(\/startups\/[a-z0-9-]+)"/gi)].map((m) => m[1]))].slice(0, limit);
  if (!slugs.length) { console.log("  BetaList: no startups found (markup may have changed), skipping."); return []; }
  const out: Launch[] = [];
  for (const slug of slugs) {
    const page = await getText(`https://betalist.com${slug}`);
    if (!page) continue;
    const name = firstMatch(page, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i).replace(/\s*[-–|:].*$/, "").trim();
    const tagline = firstMatch(page, /<meta[^>]+(?:property|name)=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    if (!name || !AI_RE.test(`${name} ${tagline}`)) continue;
    const loc = await resolveLocation(`https://betalist.com${slug}/visit`);
    const url = loc.replace(/([?&])ref=betalist(&|$)/i, "$1").replace(/[?&]$/, "");
    if (/^https?:\/\//i.test(url)) out.push({ company: name.slice(0, 80), url, source: "BetaList" });
  }
  console.log(`  BetaList: ${out.length} AI launch(es).`);
  return out;
}

// HN submitter is a real person with a real inbox (company X accounts have closed DMs).
// Pull an email from their profile's `about` field if they left one public.
async function hnUserEmail(username: string): Promise<string> {
  const raw = await getText(`https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(username)}.json`, 6000);
  if (!raw) return "";
  try {
    const about = decode(String(JSON.parse(raw)?.about || ""));
    const m = about.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    return m ? m[0] : "";
  } catch { return ""; }
}

// ── the check (our own API) ──────────────────────────────────────────────────────
type Flag = { span: string; issue: string; severity: string; why: string; fix: string };
type CheckResp = { id: string; credits_charged: number; flags: Flag[]; report_url?: string };

// HIGH flags, with overlaps collapsed: the model may flag both the short span
// ("automate any app") and the whole sentence containing it. Drop the longer one and keep
// the shorter, more quotable span. Shortest first, so the DM always quotes the tightest phrase.
function highFlags(flags: Flag[]): Flag[] {
  const n = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const high = (flags || []).filter((f) => f.severity === "high");
  return high
    .filter((f) => !high.some((g) => g !== f && n(g.span).length < n(f.span).length && n(f.span).includes(n(g.span))))
    .sort((a, b) => a.span.length - b.span.length);
}

async function runCheck(company: string, copy: string): Promise<CheckResp | null> {
  try {
    const res = await fetch(`${BASE}/api/v1/check`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": API_KEY },
      // title is rendered on the PUBLIC shared report the target opens, so it must be the
      // company name alone, never an internal "Outreach:" label. context: published, because
      // every page we scrape is already live (a landing page can't be "not ready to ship").
      body: JSON.stringify({ output_type: "marketing_copy", candidates: [copy], title: company, share: true, context: "published" }),
    });
    if (!res.ok) { const b = await res.text().catch(() => ""); console.log(`  check failed ${res.status}: ${b.slice(0, 120)}`); return null; }
    return (await res.json()) as CheckResp;
  } catch (e) { console.log("  check error:", e); return null; }
}

// ── DM draft (no em dashes; lowercase prose, verbatim quotes) ─────────────────────
function reasonPhrase(why: string): string {
  return why.trim().replace(/[.;]\s*$/, "").replace(/^([A-Z])(?![A-Z])/, (m) => m.toLowerCase());
}
function draftDm(company: string, source: string, flag: Flag, reportUrl: string): string {
  return [
    `hey, i saw ${company} on ${source}. i built a checker that flags lines in AI-generated copy that read risky before users see them.`,
    ``,
    `the only text of yours i could reach was your landing page, so i ran that. it flagged "${flag.span}". ${reasonPhrase(flag.why)}. suggested rewrite: "${flag.fix.trim().replace(/\.\s*$/, "")}".`,
    ``,
    `full report, no signup: ${reportUrl}`,
    ``,
    `that's just the demo. the real use is your product's own output, the text your users actually read. send me one and i'll run it free. i'm testing whether the flags hold up on real output, so if it's wrong, tell me, that's more useful than if it's right.`,
    ``,
    `nishanth`,
    `vraelis.com`,
  ].join("\n").replace(/—/g, ", ");
}

// For a QUALIFIED target whose landing page comes back CLEAN: no invented flag, a different,
// honest ask. We still ran their real page; we just have nothing to fault, so we say so.
function draftNoFlag(company: string, source: string, reportUrl: string): string {
  return [
    `hey, i saw ${company} on ${source}. i built a checker that flags lines in AI-generated copy that read risky before users see them.`,
    ``,
    `i ran your landing page through it and it came back clean, which is rarer than you'd think, so this isn't a "you have a problem" message.`,
    ``,
    `report, no signup: ${reportUrl}`,
    ``,
    `the real use is your product's own output, the text your users actually read. that's where the risky lines hide, not the landing page. send me a sample and i'll run it free. i'm testing whether the flags hold up on real output, so if it's wrong, tell me.`,
    ``,
    `nishanth`,
    `vraelis.com`,
  ].join("\n").replace(/—/g, ", ");
}

// ── seen ledger: a persisted list so we never process the same domain twice across runs. A
// duplicate cold email is worse than no email, so once a domain is checked (or qualify-skipped)
// it is recorded and skipped on every later run. Delete a line to re-open that domain.
const SEEN_FILE = "outreach-seen.txt";
function loadSeen(): Set<string> {
  try { return new Set(readFileSync(SEEN_FILE, "utf8").split("\n").map((s) => s.trim().toLowerCase()).filter(Boolean)); }
  catch { return new Set(); }
}
function saveSeen(seen: Set<string>) {
  try { writeFileSync(SEEN_FILE, [...seen].sort().join("\n") + "\n"); } catch { /* best effort */ }
}
function hostOf(url: string): string { try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } }

// ── CSV ──────────────────────────────────────────────────────────────────────────
function csvCell(v: string): string { return `"${String(v ?? "").replace(/"/g, '""')}"`; }

// ── debug: print exactly what the checker would see for one URL (no check, no cost) ──
async function extractOnly(url: string) {
  console.log(`Extract-only (no check, no cost): ${url}\n`);
  const html = await getText(url);
  if (!html) { console.log("could not fetch the page."); return; }
  const { copy, handles, dropped } = extractCopy(html);
  console.log(`=== DROPPED as near-duplicate / substring (${dropped.length}) ===`);
  dropped.forEach((d) => console.log(`  - ${d}`));
  console.log(`\n=== EXTRACTED COPY the checker would see ===\n${copy}`);
  console.log(`\n=== social handles: ${handles.join(", ") || "(none)"}`);
}

type Kept = { l: Launch; fit: number; founder: string; hnUser: string; hnEmail: string; flag: Flag | null; reportUrl: string };

async function main() {
  if (!API_KEY) { console.error("Missing VRAELIS_API_KEY (set it in .env.local or the shell)."); process.exit(1); }
  console.log(`Outreach prep. base=${BASE}  max checks=${MAX_CHECKS}  keep cap=${KEEP_CAP}  qualify fit>=${QUALIFY_MIN}`);
  const seen = loadSeen();
  console.log(`Seen ledger: ${seen.size} domain(s) already processed (will be skipped).`);
  console.log("Finding launches (last 24h)...");
  const raw = [...(await fromHackerNews()), ...(await fromProductHunt()), ...(await fromBetaList())];
  console.log("  YC directory + There's An AI For That: not wired (YC is JS/Algolia with rotating keys; TAAFT is behind a Cloudflare challenge). Add when there's a stable feed.");

  // dedup by hostname (same product across sources) and drop domains already in the ledger
  const byHost = new Map<string, Launch>();
  let skippedSeen = 0;
  for (const l of raw) {
    const host = hostOf(l.url);
    if (!host) continue;
    if (seen.has(host)) { skippedSeen++; continue; }
    if (!byHost.has(host)) byHost.set(host, l);
  }
  const launches = [...byHost.values()];
  console.log(`  ${raw.length} raw -> ${launches.length} new & deduped (${skippedSeen} skipped as already-seen).`);

  const kept: Kept[] = [];
  let checksRun = 0, creditsSpent = 0, cleanKept = 0;

  for (const l of launches) {
    if (kept.length >= KEEP_CAP) { console.log(`Reached keep cap (${KEEP_CAP}).`); break; }
    if (checksRun >= MAX_CHECKS) { console.log(`Reached check ceiling (${MAX_CHECKS}).`); break; }
    const host = hostOf(l.url);

    if (!(await mayFetch(l.url))) { console.log(`- ${l.company}: robots.txt disallows, skipping.`); continue; }
    const html = await getText(l.url);
    if (!html) { console.log(`- ${l.company}: could not fetch page.`); continue; }
    const { copy, handles, dropped } = extractCopy(html);
    if (dropped.length) console.log(`  ${l.company}: dropped ${dropped.length} near-duplicate line(s) before checking.`);
    if (copy.length < 60) { console.log(`- ${l.company}: no usable marketing copy.`); continue; }

    // QUALIFY before spending a credit: does this product generate text a human reads? A
    // low-fit product (device automation, image tool) is skipped and recorded as seen.
    const fit = fitScore(copy);
    if (fit < QUALIFY_MIN) { console.log(`- ${l.company}: fit ${fit} < ${QUALIFY_MIN} (not a text-generating product), skipped pre-check.`); seen.add(host); continue; }

    const check = await runCheck(l.company, copy);
    checksRun++;
    seen.add(host); // record every checked domain: never re-contact, never re-spend on it
    if (!check) continue;
    creditsSpent += check.credits_charged || 0;
    if (!check.report_url) { console.log(`- ${l.company}: no share link returned, skipping.`); continue; }

    // A HIGH flag is a verifiable/unbackable claim -> the DM quotes it (draftDm). A qualified
    // target with a CLEAN page is still worth an honest, no-flag note (draftNoFlag): we ran
    // their real page and have nothing to fault, which is itself the opener.
    const flag = highFlags(check.flags || [])[0] || null;
    const founder = handles[0] ? `@${handles[0]}` : "";
    const hnUser = l.hnUser || "";
    const hnEmail = hnUser ? await hnUserEmail(hnUser) : "";
    kept.push({ l, fit, founder, hnUser, hnEmail, flag, reportUrl: check.report_url });
    if (!flag) cleanKept++;
    console.log(`+ ${l.company}: kept [fit ${fit}] ${flag ? `(${flag.severity} ${flag.issue})` : "(clean page -> no-flag draft)"}. ${kept.length}/${KEEP_CAP}`);
  }

  // sort by fit (best-fit first); within equal fit, a flagged target outranks a clean one
  kept.sort((a, b) => b.fit - a.fit || Number(!!b.flag) - Number(!!a.flag));

  const day = new Date().toISOString().slice(0, 10);
  const file = `outreach-${day}.csv`;
  const header = ["company", "url", "channel", "fit", "founder_handle", "hn_user", "hn_email", "flagged_line", "severity", "suggested_fix", "report_url", "drafted_dm", "drafted_no_flag"];
  const rows = kept.map((r) => [
    r.l.company, r.l.url, r.l.source, String(r.fit), r.founder, r.hnUser, r.hnEmail,
    r.flag ? r.flag.span : "", r.flag ? r.flag.severity : "", r.flag ? r.flag.fix : "", r.reportUrl,
    r.flag ? draftDm(r.l.company, r.l.source, r.flag, r.reportUrl) : "",
    r.flag ? "" : draftNoFlag(r.l.company, r.l.source, r.reportUrl),
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
  writeFileSync(file, csv);
  saveSeen(seen);

  console.log("");
  console.log(`Done. Wrote ${rows.length} rows to ${file} (sorted best-fit first).`);
  console.log(`Checks run: ${checksRun}  |  Credits spent: ${creditsSpent}  |  Kept: ${kept.length} (${kept.length - cleanKept} flagged, ${cleanKept} clean)  |  Seen ledger now ${seen.size}.`);
  console.log("Nothing was sent. Open the CSV, read the drafted_dm / drafted_no_flag column, and hand-send the good ones.");
}

// debug: run ONE url through the real check (spends 1 credit) and print every flag, so you
// can confirm which survive the HIGH filter. Company defaults to the host label.
async function checkOne(url: string) {
  if (!API_KEY) { console.error("Missing VRAELIS_API_KEY (set it in .env.local or the shell)."); process.exit(1); }
  const company = (() => { try { return new URL(url).hostname.replace(/^www\./, "").split(".")[0]; } catch { return "the product"; } })();
  console.log(`Check-one (spends 1 credit): ${url}  company="${company}"\n`);
  const html = await getText(url);
  if (!html) { console.log("could not fetch the page."); return; }
  const { copy, dropped } = extractCopy(html);
  console.log(`dropped ${dropped.length} near-duplicate line(s).`);
  console.log(`\n=== extracted copy the checker saw ===\n${copy}\n`);
  const check = await runCheck(company, copy);
  if (!check) { console.log("check failed."); return; }
  console.log(`credits charged: ${check.credits_charged}   report: ${check.report_url}`);
  console.log(`\n=== ALL flags returned ===`);
  (check.flags || []).forEach((f) => console.log(`  [${f.severity}] ${f.issue}: "${f.span}"`));
  const high = highFlags(check.flags || []);
  console.log(`\n=== ${high.length} HIGH flag(s) survive the filter (overlaps collapsed) ===`);
  high.forEach((f) => console.log(`  "${f.span}"  ->  ${f.fix}`));
}

// debug: verify the no-cost machinery (qualification fit + BetaList source + seen ledger)
// WITHOUT spending a credit. OUTREACH_SELFTEST=1 pnpm outreach
async function selfTest() {
  console.log("Self-test (no checks, no cost).\n");
  const cases: [string, string, boolean][] = [
    ["device/automation (mobilerun)", "Give AI a phone. Plug your AI into a real phone. Network, SIM, API, device, all from code. Provision real Android and iOS devices on demand. Reads the screen. Taps, swipes, types. Automate any app and receive SMS.", false],
    ["support/chat product", "Our AI writes support replies and drafts emails for your team. It generates chat responses, answers tickets, and summarizes long threads into one message.", true],
    ["image generator", "Generate stunning images and video from a prompt. Create avatars, photos, and 3d renders. Our diffusion model renders hardware-accelerated visuals.", false],
    ["copywriting tool", "The fastest copywriting assistant. Draft blog posts, rewrite marketing copy, compose newsletters, and generate product descriptions in seconds.", true],
  ];
  console.log(`QUALIFICATION (qualify fit >= ${QUALIFY_MIN}):`);
  let pass = 0;
  for (const [name, copy, shouldQualify] of cases) {
    const fit = fitScore(copy);
    const qualifies = fit >= QUALIFY_MIN;
    const ok = qualifies === shouldQualify;
    if (ok) pass++;
    console.log(`  ${ok ? "OK " : "XX "} ${name.padEnd(28)} fit=${String(fit).padStart(3)}  qualifies=${qualifies}  (expected ${shouldQualify})`);
  }
  console.log(`  ${pass}/${cases.length} qualification cases correct.\n`);

  console.log("SEEN LEDGER round-trip:");
  const s = new Set(["a.com", "b.com"]); s.add(hostOf("https://www.c.com/x"));
  console.log(`  hostOf("https://www.C.com/x") -> ${hostOf("https://www.C.com/x")} (want c.com); set now {${[...s].join(", ")}}\n`);

  console.log("BETALIST source (live, no cost):");
  const bl = await fromBetaList(8);
  bl.slice(0, 8).forEach((l) => console.log(`  - ${l.company}  ->  ${l.url}`));
  console.log(`  ${bl.length} launch(es) resolved.`);
}

const entry = process.env.OUTREACH_SELFTEST ? selfTest()
  : process.env.OUTREACH_EXTRACT_URL ? extractOnly(process.env.OUTREACH_EXTRACT_URL)
  : process.env.OUTREACH_CHECK_URL ? checkOne(process.env.OUTREACH_CHECK_URL)
  : main();
entry.catch((e) => { console.error("outreach failed:", e); process.exit(1); });
