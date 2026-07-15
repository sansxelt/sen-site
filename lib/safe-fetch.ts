// SSRF-safe outbound fetch, shared by webhook delivery and SSO/OIDC. Resolve the host,
// reject if ANY resolved address is private/reserved (incl. cloud metadata 169.254.169.254),
// then PIN the connection to the validated addresses so it can't re-resolve to a private IP
// between the check and the connect (defeats DNS rebinding). https + port 443 only. Callers
// choose redirect handling (use "manual" — following redirects would re-open the hole).

import dns from "dns/promises";
import net from "net";
import { fetch as undiciFetch, Agent } from "undici";

// True if an IP literal is private/reserved/loopback/link-local (incl. cloud metadata
// 169.254.169.254). Covers IPv4 ranges + IPv6 (loopback, ULA, link-local, IPv4-mapped).
// Unknown → treated as unsafe.
export function isPrivateIp(ip: string): boolean {
  let addr = ip.trim().toLowerCase();
  if (addr.startsWith("::ffff:") && net.isIP(addr.slice(7)) === 4) addr = addr.slice(7); // IPv4-mapped
  const fam = net.isIP(addr);
  if (fam === 4) {
    const p = addr.split(".").map(Number);
    if (p.some((n) => Number.isNaN(n) || n > 255)) return true;
    return (
      p[0] === 0 || p[0] === 10 || p[0] === 127 ||
      (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||   // CGN 100.64/10
      (p[0] === 169 && p[1] === 254) ||                // link-local / metadata
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 0 && p[2] === 0) ||    // 192.0.0.0/24
      (p[0] === 192 && p[1] === 168) ||
      (p[0] === 198 && (p[1] === 18 || p[1] === 19)) || // 198.18.0.0/15 benchmarking
      p[0] >= 224                                      // multicast/reserved/broadcast
    );
  }
  if (fam === 6) {
    return addr === "::1" || addr === "::" || addr.startsWith("fc") || addr.startsWith("fd") || addr.startsWith("fe8") || addr.startsWith("fe9") || addr.startsWith("fea") || addr.startsWith("feb");
  }
  return true;
}

// Create-time string guard (host-level) — a cheap first line for rejecting an obviously
// unsafe URL before it is stored. safeFetch (DNS-resolve + pin) is the real defense at call
// time. Returns a short reason code, or null when the URL passes the string checks.
export function unsafeHttpsUrlReason(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return "invalid_url"; }
  if (u.protocol !== "https:") return "https_required";
  if (u.port && u.port !== "443") return "port_not_allowed";
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) return "internal_host";
  if (host.includes(":")) return "ipv6_literal";
  if (net.isIP(host) === 4 && isPrivateIp(host)) return "private_ip";
  return null;
}

// True when an error is safeFetch's own SSRF/DNS-pin rejection (protocol/port refused, DNS
// lookup failed, or a resolved address was private/reserved). Callers use this to tell "the
// URL was blocked before any request went out" apart from a genuine network failure/timeout —
// the two demand very different remediation.
export function isBlockedFetchError(e: unknown): boolean {
  return e instanceof Error && e.message === "blocked";
}

// A SANITIZED category for WHY safeFetch blocked — a fixed enum of reason CLASSES, never the
// destination host/IP/port. Safe to record in evidence/logs. Read via blockedFetchReason().
export type BlockedReason =
  | "unsupported_scheme"   // not https
  | "port_not_allowed"     // https but not :443
  | "unresolved_host"      // hostname did not resolve (NXDOMAIN / SERVFAIL / timeout / zero addresses)
  | "metadata_endpoint"    // a resolved address is the cloud metadata IP (169.254.169.254)
  | "private_address"      // a resolved address is private/reserved/loopback/link-local
  | "blocked";             // generic fallback
// Every safeFetch rejection carries `message === "blocked"` (unchanged — existing callers depend on it)
// PLUS a non-sensitive `reason` category on the error object. This reader returns it, or null if absent.
export function blockedFetchReason(e: unknown): BlockedReason | null {
  const r = (e as { reason?: unknown })?.reason;
  return typeof r === "string" ? (r as BlockedReason) : null;
}
// Build safeFetch's rejection: message stays exactly "blocked"; the sanitized reason class rides alongside.
function blockedError(reason: BlockedReason): Error & { reason: BlockedReason } {
  return Object.assign(new Error("blocked"), { reason });
}

// Resolve the hostname, reject if ANY resolved address is private/reserved, then pin the
// connection to the validated IP set (no re-resolution). Throws Error("blocked") on any
// unsafe destination. https + port 443 only. Returns the (undici) Response so callers can
// read status AND body.
export async function safeFetch(url: string, init: RequestInit): Promise<Response> {
  const u = new URL(url);
  if (u.protocol !== "https:") throw blockedError("unsupported_scheme");
  if (u.port && u.port !== "443") throw blockedError("port_not_allowed");
  let addrs: { address: string; family: number }[];
  // A lookup failure / zero addresses = the host simply doesn't resolve. This is NOT DNS rebinding — the
  // actual rebinding defense is the pinned connect.lookup below (undici can't re-resolve to a private IP
  // between validation and connect). Labeling it "unresolved_host" keeps evidence honest for operators.
  try { addrs = await dns.lookup(u.hostname, { all: true }); } catch { throw blockedError("unresolved_host"); }
  if (!addrs.length) throw blockedError("unresolved_host");
  // Classify the WORST resolved address so the reason is meaningful (metadata is the sharpest signal).
  const meta = addrs.some((a) => a.address === "169.254.169.254");
  if (meta) throw blockedError("metadata_endpoint");
  if (addrs.some((a) => isPrivateIp(a.address))) throw blockedError("private_address");
  // Pin undici to the validated address set so it can't re-resolve between validation and
  // connect. undici's connect.lookup expects the dns.lookup({all:true}) array form. Use
  // undici's own fetch so the Agent dispatcher is version-matched (global fetch rejects a
  // foreign Agent).
  const validated = addrs.map((a) => ({ address: a.address, family: a.family }));
  const agent = new Agent({ connect: { lookup: (_h: string, _o: unknown, cb: (e: Error | null, a: { address: string; family: number }[]) => void) => cb(null, validated) } as never });
  try {
    return (await undiciFetch(url, { ...init, dispatcher: agent } as never)) as unknown as Response;
  } finally {
    agent.close().catch(() => {});
  }
}
