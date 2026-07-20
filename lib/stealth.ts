// Stealth mode: a curtain over the public site and app while Vraelis is not being shown yet.
//
// WHAT THIS IS: when on, the server renders ONLY the stealth screen. The real layout, the real pages and
// the RSC payload are never generated, so there is nothing to read in the page source and nothing to
// un-hide with CSS. A key sequence unlocks it for this browser.
//
// HOW THE SECRET IS KEPT. The unlock sequence is NEVER shipped to the browser. The client is deliberately
// dumb: it buffers keystrokes typed while the modifiers are held and asks the server whether the buffer is
// right. Only the server knows, from STEALTH_UNLOCK in the environment. So opening DevTools and reading the
// bundle reveals the shape of the mechanism and none of the answer. Hashing the sequence into the bundle
// would NOT have worked: a short key sequence has a tiny search space and an offline brute force against a
// shipped hash finishes instantly. Keeping it server-side is what makes rate limiting possible, and rate
// limiting is the actual defence.
//
// The unlock cookie is HMAC-signed with a server secret and carries its own expiry, so it cannot be
// fabricated from DevTools. Setting vr_stealth by hand now produces an invalid signature and stays locked.
//
// WHAT THIS STILL IS NOT: access control. An attacker who reads your deployment's environment has
// everything. It also does not gate /api, which is deliberate: OAuth callbacks, webhooks and the worker
// must keep working while the front door is closed. Session and tenancy checks remain the only real
// authorization. Never put something behind stealth that would be harmful to reveal.
//
// Turned on by STEALTH_MODE=1. Absent or any other value means off, so a mistyped variable fails to a
// VISIBLE site rather than an invisible one.
import { createHmac, timingSafeEqual } from "crypto";

export const STEALTH_COOKIE = "vr_stealth";

const TTL_MS = 24 * 60 * 60 * 1000; // a browser open tomorrow is still unlocked; a shared machine re-arms
const DEFAULT_SEQUENCE = "io";      // matches the founder's Ctrl+Shift+Alt then I then O when unset

export function stealthConfigured(): boolean {
  return (process.env.STEALTH_MODE ?? "").trim() === "1";
}

// The expected sequence, lowercased. Kept in the environment so it is not in the repo either.
export function stealthSequence(): string {
  return ((process.env.STEALTH_UNLOCK ?? DEFAULT_SEQUENCE).trim() || DEFAULT_SEQUENCE).toLowerCase();
}

// Signing key for the unlock cookie. Reuses an existing server secret; falls back to the sequence itself so
// a deployment that sets neither still gets a signature an outsider cannot guess.
function signingKey(): string {
  return process.env.VRAELIS_SECRET_KEY || process.env.AUTH_SECRET || `stealth:${stealthSequence()}`;
}

// Constant-time compare that does not leak length through early return.
export function sequenceMatches(attempt: string): boolean {
  const expected = stealthSequence();
  const a = Buffer.from((attempt || "").toLowerCase().slice(0, 64));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Cookie value: "<expiresAt>.<hmac>". The expiry is inside the signed payload, so moving the clock forward
// in a cookie editor invalidates it rather than extending it.
export function signStealthCookie(now = Date.now()): string {
  const expires = now + TTL_MS;
  return `${expires}.${createHmac("sha256", signingKey()).update(String(expires)).digest("hex")}`;
}

export function verifyStealthCookie(raw: string | undefined, now = Date.now()): boolean {
  if (!raw) return false;
  const dot = raw.indexOf(".");
  if (dot <= 0) return false;
  const expires = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return false;
  const want = createHmac("sha256", signingKey()).update(expires).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const STEALTH_COOKIE_MAX_AGE = Math.floor(TTL_MS / 1000);
