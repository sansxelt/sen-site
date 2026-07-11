// Tests for deterministic discovery: extraction + sanitization + bounded same-origin crawl. Pure (fake
// fetcher; no network). Run: npx tsx scripts/preflight-discovery-verify.ts
import { extractSnapshot } from "../lib/preflight/discover-extract";
import { crawl, type FetchResult } from "../lib/preflight/discover-crawl";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

const ORIGIN = "https://acme.app";
const html = (extra = "") => `<!doctype html><html><head><title>Acme Projects</title>
<meta name="description" content="Manage projects. Reach billing@acme.com anytime."><script>var _next=1</script></head>
<body><nav><a href="/projects">Projects</a><a href="/pricing">Pricing</a><a href="/login">Log in</a>
<a href="https://evil.example/x">External</a><a href="/settings">Settings</a></nav>
<h1>Your projects</h1><h2>Recent</h2>
<form method="post" action="/api/projects"><input name="name" type="text"><input name="secret_token" type="hidden" value="TOKENABC123"><button>Create project</button></form>
<script>var apiKey="sk_live_leakme_999";</script>${extra}</body></html>`;

// ── Extraction + sanitization ──
{
  const s = extractSnapshot(html("<a href=\"/_next/static/x.js\">n</a>"), `${ORIGIN}/`, 200);
  ok("extract: title", s.title === "Acme Projects");
  ok("extract: email in meta redacted", !/@acme\.com/.test(s.metaDescription) && /\[email\]/.test(s.metaDescription));
  ok("extract: headings", s.headings.includes("Your projects") && s.headings.includes("Recent"));
  ok("extract: indicators (login/pricing/projects/create/settings)", ["login", "pricing", "projects", "create", "settings"].every((i) => s.indicators.includes(i)));
  ok("extract: form action + method + input", s.forms[0]?.action === "/api/projects" && s.forms[0]?.method === "POST" && s.forms[0]?.inputs.some((i) => i.name === "name"));
  ok("extract: apiRefs include /api/projects", s.apiRefs.includes("/api/projects"));
  ok("extract: framework nextjs", s.framework === "nextjs");
  const blob = JSON.stringify(s).toLowerCase();
  ok("SANITIZE: no script-derived secret leaks (sk_live / TOKENABC / apikey)", !blob.includes("sk_live") && !blob.includes("tokenabc123") && !blob.includes("apikey"));
  ok("SANITIZE: raw <script> content not present", !blob.includes("var _next") && !blob.includes("var apikey"));
}

// ── Bounded, same-origin crawl ──
const pages: Record<string, string> = {
  [`${ORIGIN}/`]: html(), [`${ORIGIN}/projects`]: html(), [`${ORIGIN}/pricing`]: html(), [`${ORIGIN}/login`]: html(), [`${ORIGIN}/settings`]: html(),
};
const fetched: string[] = [];
const fetcher = async (url: string): Promise<FetchResult> => { fetched.push(url); const h = pages[url]; return h ? { ok: true, status: 200, contentType: "text/html; charset=utf-8", html: h } : { ok: false, reason: "not_found", status: 404 }; };

async function main() {
{
  fetched.length = 0;
  const snap = await crawl(`${ORIGIN}/`, fetcher, { maxPages: 12, maxDepth: 2 });
  ok("crawl: visited multiple same-origin pages", snap.pages.length >= 4);
  ok("crawl: NEVER fetched the cross-origin link", !fetched.some((u) => u.includes("evil.example")));
  ok("crawl: only same-origin pages captured", snap.pages.every((p) => p.url.startsWith(ORIGIN)));
  ok("crawl: dedup (no url fetched twice)", new Set(fetched).size === fetched.length);
  ok("crawl: state completed (all ok)", snap.state === "completed");
  ok("crawl: content hash is stable + non-empty", typeof snap.contentHash === "string" && snap.contentHash.length === 32);
}
{
  const snap = await crawl(`${ORIGIN}/`, fetcher, { maxPages: 2, maxDepth: 2 });
  ok("crawl: maxPages bound respected", snap.pages.length === 2 && snap.truncated === true);
}
{
  const big = "x".repeat(3 * 1024 * 1024);
  const f = async (url: string): Promise<FetchResult> => (url === `${ORIGIN}/` ? { ok: true, status: 200, contentType: "text/html", html: `<html><a href="/big">b</a></html>` } : { ok: true, status: 200, contentType: "text/html", html: `<html><body>${big}</body></html>` });
  const snap = await crawl(`${ORIGIN}/`, f, { maxHtmlBytes: 2 * 1024 * 1024 });
  ok("crawl: oversized page -> failure + partial", snap.failures.some((x) => x.reason === "page_too_large") && snap.state === "partial");
}
{
  const f = async (): Promise<FetchResult> => ({ ok: true, status: 200, contentType: "application/json", html: "{}" });
  const snap = await crawl(`${ORIGIN}/`, f);
  ok("crawl: non-HTML -> failure (root) -> failed", snap.failures.some((x) => x.reason === "non_html") && snap.state === "failed");
}
{
  const snap = await crawl("http://127.0.0.1:3000/", fetcher, {});
  ok("crawl: private-ip root rejected pre-fetch", snap.state === "failed" && snap.failures[0]?.reason === "invalid_or_blocked_root" && !fetched.includes("http://127.0.0.1:3000/"));
}
{
  // A link to a blocked host in the page must never be enqueued/fetched.
  const f = async (url: string): Promise<FetchResult> => ({ ok: true, status: 200, contentType: "text/html", html: url === `${ORIGIN}/` ? `<html><a href="http://169.254.169.254/latest">meta</a><a href="/ok">ok</a></html>` : `<html>ok</html>` });
  const seen: string[] = []; const wrap = async (u: string) => { seen.push(u); return f(u); };
  const snap = await crawl(`${ORIGIN}/`, wrap, {});
  ok("crawl: blocked-host link never fetched", !seen.some((u) => u.includes("169.254")) && snap.pages.length >= 1);
}

}
main().then(() => { console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0); }).catch((e) => { console.error(e); process.exit(1); });
