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
    // Normalise to full hextets so prefix tests are exact rather than string-prefix guesses. "fe8" as a
    // string prefix, for example, also matches "fe80::" correctly but would miss "fe80:0:..." written
    // long-hand in some encodings, and would wrongly match a global address starting "fe8" that is not
    // link-local. Working from the first hextet's numeric value removes both problems.
    const first = firstHextet(addr);

    // ::1 loopback, :: unspecified.
    if (addr === "::1" || addr === "::") return true;

    // IPv4-MAPPED AND IPv4-COMPATIBLE, in every notation. The ::ffff:1.2.3.4 dotted form is unwrapped at
    // the top of this function, but the HEX form ::ffff:7f00:1 is the same address written differently and
    // was reaching this branch unchecked — 127.0.0.1 spelled in hex. Unwrap it and re-test as IPv4.
    const mapped = ipv4FromMappedHex(addr);
    if (mapped) return isPrivateIp(mapped);

    // NAT64 well-known prefix 64:ff9b::/96 and the local variant 64:ff9b:1::/48 carry an embedded IPv4
    // address, so a private v4 target can be reached through a v6 literal. Test the embedded address.
    if (addr.startsWith("64:ff9b:")) {
      const embedded = ipv4FromNat64(addr);
      return embedded ? isPrivateIp(embedded) : true;
    }

    if (first === null) return true;                    // unparseable → unsafe
    if (first === 0) return true;                        // ::/8 including ::/128 and deprecated compat
    if ((first & 0xfe00) === 0xfc00) return true;         // fc00::/7 unique local (fc/fd)
    if ((first & 0xffc0) === 0xfe80) return true;         // fe80::/10 link-local
    if ((first & 0xffc0) === 0xfec0) return true;         // fec0::/10 site-local (deprecated, still routed)
    if ((first & 0xff00) === 0xff00) return true;         // ff00::/8 multicast
    if (first === 0x0100) return true;                    // 100::/64 discard-only
    if (first === 0x2001) {
      // 2001:db8::/32 documentation, 2001:2::/48 benchmarking, 2001::/32 Teredo (tunnels to v4).
      const second = hextetAt(addr, 1);
      if (second === 0x0db8 || second === 0x0002 || second === 0x0000) return true;
    }
    return false;
  }
  return true;
}

// The numeric value of the Nth hextet of a (possibly compressed) IPv6 address, or null.
function hextetAt(addr: string, index: number): number | null {
  const parts = expandIpv6(addr);
  if (!parts || index >= parts.length) return null;
  return parts[index];
}
function firstHextet(addr: string): number | null {
  return hextetAt(addr, 0);
}

// Expand "::" and return eight numeric hextets, or null if the address is not well formed.
function expandIpv6(addr: string): number[] | null {
  const a = addr.split("%")[0]; // drop any zone id
  if (net.isIP(a) !== 6) return null;
  const halves = a.split("::");
  if (halves.length > 2) return null;
  const parse = (s: string) => (s ? s.split(":").filter(Boolean).map((h) => parseInt(h, 16)) : []);
  let head = parse(halves[0] ?? "");
  const tail = halves.length === 2 ? parse(halves[1]) : [];
  // A trailing dotted-quad ("::ffff:1.2.3.4") is handled by the caller; ignore malformed ones here.
  if (head.some(Number.isNaN) || tail.some(Number.isNaN)) return null;
  if (halves.length === 2) head = [...head, ...Array(8 - head.length - tail.length).fill(0), ...tail];
  return head.length === 8 ? head : null;
}

// ::ffff:7f00:1 and ::7f00:1 are 127.0.0.1 written in hex. Return the dotted form, or null.
function ipv4FromMappedHex(addr: string): string | null {
  const p = expandIpv6(addr);
  if (!p) return null;
  const isMapped = p[0] === 0 && p[1] === 0 && p[2] === 0 && p[3] === 0 && p[4] === 0 && p[5] === 0xffff;
  const isCompat = p.slice(0, 6).every((h) => h === 0) && (p[6] !== 0 || p[7] !== 0);
  if (!isMapped && !isCompat) return null;
  const hi = p[6], lo = p[7];
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

// 64:ff9b::/96 embeds the IPv4 address in the last two hextets.
function ipv4FromNat64(addr: string): string | null {
  const p = expandIpv6(addr);
  if (!p) return null;
  const hi = p[6], lo = p[7];
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
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
