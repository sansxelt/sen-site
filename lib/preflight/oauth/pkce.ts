// PKCE (RFC 7636) for the OAuth flows that require it — Supabase mandates it.
//
// The point of PKCE: the authorization code that comes back on the redirect is worthless without the
// verifier, so an attacker who intercepts the code (a leaked Referer, a hostile app registered on the same
// custom scheme, a shared browser log) still cannot exchange it. We generate a high-entropy verifier, send
// only its SHA-256 hash to the provider at authorize time, and prove possession of the original at exchange.
//
// The verifier therefore must survive the round trip WITHOUT ever leaving our origin: it lives in a
// short-lived httpOnly cookie, never in the state, never in a query param, never in localStorage.
import { createHash, randomBytes } from "crypto";

// Long enough to be unguessable, inside the RFC's 43-128 character range (32 bytes -> 43 base64url chars).
export function createCodeVerifier(): string {
  return base64url(randomBytes(32));
}

// S256 challenge. We never send "plain" — a plain challenge is the verifier itself, which defeats the point.
export function codeChallengeS256(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

export const PKCE_METHOD = "S256";

// The httpOnly cookie that carries the verifier across the redirect. Per-provider so two flows started in
// two tabs cannot clobber each other's verifier.
export function pkceCookieName(provider: string): string {
  return `vr_pkce_${provider}`;
}

function base64url(b: Buffer): string {
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
