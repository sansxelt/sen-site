// Security tests for lib/preflight/url-policy.ts. Pure, no network/DB. Run: npx tsx scripts/preflight-url-policy-verify.ts
import { normalizeUrl, hostIsObviouslyBlocked, classify, sameOrigin, isCrawlableSameOrigin } from "../lib/preflight/url-policy";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const APP = "https://acme-app.vercel.app";
const policy = { approvedOrigins: [APP], extraOrigins: ["https://api.stripe.com"], allowPorts: [] as number[] };
const cl = (u: string) => classify(u, policy);

// ── Blocked hosts (SSRF) ──
ok("private IPv4 10/8 blocked", !!hostIsObviouslyBlocked("10.0.0.5"));
ok("loopback 127.0.0.1 blocked", !!hostIsObviouslyBlocked("127.0.0.1"));
ok("private 192.168 blocked", !!hostIsObviouslyBlocked("192.168.1.1"));
ok("172.16/12 blocked", !!hostIsObviouslyBlocked("172.16.9.9"));
ok("cloud metadata 169.254.169.254 blocked", !!hostIsObviouslyBlocked("169.254.169.254"));
ok("link-local 169.254 blocked", !!hostIsObviouslyBlocked("169.254.10.10"));
ok("localhost blocked", !!hostIsObviouslyBlocked("localhost"));
ok(".local blocked", !!hostIsObviouslyBlocked("printer.local"));
ok(".internal blocked", !!hostIsObviouslyBlocked("svc.internal"));
ok("IPv6 loopback ::1 blocked", !!hostIsObviouslyBlocked("::1"));
ok("IPv6 ULA fd00 blocked", !!hostIsObviouslyBlocked("fd00::1"));
ok("IPv6 link-local fe80 blocked", !!hostIsObviouslyBlocked("fe80::1"));
ok("public host NOT blocked", hostIsObviouslyBlocked("acme-app.vercel.app") === null);

// ── normalizeUrl rejects ──
ok("rejects http-with-credentials", normalizeUrl("https://user:pass@acme-app.vercel.app/") === null);
ok("rejects non-http scheme (file:)", normalizeUrl("file:///etc/passwd") === null);
ok("rejects javascript: scheme", normalizeUrl("javascript:alert(1)") === null);
ok("rejects data: scheme", normalizeUrl("data:text/html,<h1>x</h1>") === null);
ok("rejects private-ip literal URL", normalizeUrl("http://127.0.0.1:3000/admin") === null);
ok("rejects metadata URL", normalizeUrl("http://169.254.169.254/latest/meta-data/") === null);
ok("normalizes: strips fragment + default port", normalizeUrl("https://acme-app.vercel.app:443/x#frag") === "https://acme-app.vercel.app/x");
ok("normalizes: lowercases host", normalizeUrl("https://ACME-App.Vercel.App/Path") === "https://acme-app.vercel.app/Path");
{
  const a = normalizeUrl("https://acme-app.vercel.app/projects#top");
  const b = normalizeUrl("https://acme-app.vercel.app/projects");
  ok("dedup: fragment variants normalize equal", a === b, `${a} vs ${b}`);
}

// ── classify relative to policy ──
ok("approved-origin document allowed", cl(`${APP}/projects`).allowed && cl(`${APP}/projects`).category === "document");
ok("same-origin /api classified api (allowed)", cl(`${APP}/api/projects`).category === "same_origin_api");
ok("same-origin asset classified static", cl(`${APP}/_next/static/x.css`).category === "static_asset");
ok("approved integration (stripe) => approved_integration", cl("https://api.stripe.com/v1/x").category === "approved_integration");
ok("unknown third party NOT navigable", cl("https://evil.example.com/x").allowed === false && cl("https://evil.example.com/x").category === "unknown_third_party");
ok("redirect INTO a blocked destination => blocked (re-classify)", cl("http://169.254.169.254/").category === "blocked" && !cl("http://169.254.169.254/").allowed);
ok("nonstandard port blocked by default", cl("https://acme-app.vercel.app:8443/x").allowed === false && cl("https://acme-app.vercel.app:8443/x").reason === "port_not_allowed");
{
  // A nonstandard port is part of the web origin, so the approved origin must itself carry the port AND
  // the port must be whitelisted. (App on :8443 -> approvedOrigins includes the :8443 origin.)
  const p2 = { approvedOrigins: ["https://acme-app.vercel.app:8443"], allowPorts: [8443] };
  ok("nonstandard port allowed when the :port origin is approved + whitelisted", classify("https://acme-app.vercel.app:8443/x", p2).allowed === true);
}

// ── origin + crawl helpers ──
ok("sameOrigin true for same host", sameOrigin(`${APP}/a`, `${APP}/b`));
ok("sameOrigin false cross host", !sameOrigin(`${APP}/a`, "https://other.com/a"));
ok("crawlable: same-origin doc yes", isCrawlableSameOrigin(`${APP}/dashboard`, APP));
ok("crawlable: cross-origin no", !isCrawlableSameOrigin("https://other.com/x", APP));
ok("crawlable: same-origin asset no (not a doc)", !isCrawlableSameOrigin(`${APP}/logo.png`, APP));
ok("crawlable: blocked host no", !isCrawlableSameOrigin("http://127.0.0.1/x", APP));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
