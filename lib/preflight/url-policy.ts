// URL policy for Vraelis Preflight — the STRING-LEVEL classifier + normalizer used for the bounded
// discovery crawl and (pre-navigation) for the browser layer. This is the first SSRF boundary: it rejects
// non-http(s) schemes, embedded credentials, obviously-blocked hosts (localhost, private/loopback/link-
// local/cloud-metadata IP literals), and nonstandard ports; and it classifies every URL relative to the
// approved app origin.
//
// IMPORTANT residual risk (documented, not hidden): a hostname's TRUE address is only known after DNS.
// The crawl gets that defense from lib/safe-fetch.ts (DNS-pinned, rebinding-proof). A real BROWSER does
// its own DNS+sockets and bypasses safe-fetch entirely, so the browser layer additionally relies on the
// isolated provider (Browserbase) network + per-run allowlist. This module is the pre-DNS gate, not the
// whole defense.
import net from "node:net";
import { isPrivateIp } from "../safe-fetch";

export type UrlCategory = "document" | "same_origin_api" | "static_asset" | "approved_integration" | "unknown_third_party" | "blocked";
export type UrlPolicy = { approvedOrigins: string[]; extraOrigins?: string[]; allowPorts?: number[] };
export type Classification = { url: string | null; origin: string | null; category: UrlCategory; allowed: boolean; reason: string };

const ASSET_EXT = /\.(css|js|mjs|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|eot|map|avif|mp4|webm)$/i;

// A host string is obviously blocked without DNS: localhost-ish names, or a private/reserved IP LITERAL.
export function hostIsObviouslyBlocked(host: string): string | null {
  const h = host.toLowerCase();
  if (!h) return "empty_host";
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return "internal_host";
  // IPv6 literal in brackets, or bare.
  const bare = h.startsWith("[") && h.endsWith("]") ? h.slice(1, -1) : h;
  const kind = net.isIP(bare);
  if (kind === 4 && isPrivateIp(bare)) return "private_ipv4";
  if (kind === 6 && isPrivateIp(bare)) return "private_ipv6";
  // cloud metadata (also caught by isPrivateIp's 169.254/16, but be explicit for the common literal)
  if (bare === "169.254.169.254" || bare === "[fd00:ec2::254]" || bare === "fd00:ec2::254") return "metadata_host";
  return null;
}

// Normalize for dedup + safety. Rejects (returns null) on: parse failure, non-http(s), embedded
// credentials, or an obviously-blocked host. Strips the fragment, the default port, and a lone trailing
// slash; lowercases the host.
export function normalizeUrl(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;                       // credentials in URL
  if (hostIsObviouslyBlocked(u.hostname)) return null;
  u.hash = "";
  // drop default ports
  if ((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) u.port = "";
  let s = u.toString();
  // collapse a bare trailing slash on a path-only URL ("https://x.com/" -> "https://x.com/") keep root slash
  if (u.pathname !== "/" && s.endsWith("/") && !u.search) s = s.slice(0, -1);
  return s;
}

export function originOf(raw: string): string | null {
  try { const u = new URL(raw); return `${u.protocol}//${u.host}`; } catch { return null; }
}
export function sameOrigin(a: string, b: string): boolean {
  const oa = originOf(a), ob = originOf(b);
  return !!oa && oa === ob;
}

// Classify a URL relative to the run's policy. Port policy: 443/80 always allowed; others only if in
// allowPorts. Origin buckets: approved app origin(s) -> document/same-origin-api/static; extra approved ->
// approved_integration; anything else -> unknown_third_party (a subresource, not a navigable target).
export function classify(raw: string, policy: UrlPolicy): Classification {
  const url = normalizeUrl(raw);
  if (!url) return { url: null, origin: null, category: "blocked", allowed: false, reason: "unnormalizable_or_blocked" };
  const u = new URL(url);
  const blocked = hostIsObviouslyBlocked(u.hostname);
  if (blocked) return { url, origin: originOf(url), category: "blocked", allowed: false, reason: blocked };
  const port = u.port ? Number(u.port) : (u.protocol === "https:" ? 443 : 80);
  const portOk = port === 443 || port === 80 || (policy.allowPorts ?? []).includes(port);
  if (!portOk) return { url, origin: originOf(url), category: "blocked", allowed: false, reason: "port_not_allowed" };

  const origin = originOf(url)!;
  const approved = new Set(policy.approvedOrigins.map((o) => originOf(o)).filter(Boolean) as string[]);
  const extra = new Set((policy.extraOrigins ?? []).map((o) => originOf(o)).filter(Boolean) as string[]);

  if (approved.has(origin)) {
    if (ASSET_EXT.test(u.pathname)) return { url, origin, category: "static_asset", allowed: true, reason: "same_origin_asset" };
    if (/\/api\//.test(u.pathname) || u.pathname.startsWith("/api")) return { url, origin, category: "same_origin_api", allowed: true, reason: "same_origin_api" };
    return { url, origin, category: "document", allowed: true, reason: "approved_origin" };
  }
  if (extra.has(origin)) return { url, origin, category: "approved_integration", allowed: true, reason: "approved_integration" };
  // Unknown third party: permitted to LOAD as a subresource is a per-run network decision, but it is never
  // a navigable document target. The classifier marks it not-allowed for navigation.
  return { url, origin, category: "unknown_third_party", allowed: false, reason: "unknown_third_party" };
}

// Is `candidate` a valid NEXT crawl target given the run origin (same-origin only)? Used to bound the
// deterministic discovery crawl.
export function isCrawlableSameOrigin(candidate: string, runOrigin: string): boolean {
  const c = normalizeUrl(candidate);
  if (!c) return false;
  const co = originOf(c);
  return !!co && co === originOf(runOrigin) && !ASSET_EXT.test(new URL(c).pathname);
}
