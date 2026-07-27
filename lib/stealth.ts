// Stealth mode: a curtain over the public site and app while Vraelis is not being shown yet.
//
// WHAT THIS IS: when on, the server renders ONLY the stealth screen. The real layout, the real pages and
// the RSC payload are never generated, so there is nothing to read in the page source and nothing to
// un-hide with CSS. A deliberate gesture unlocks it for this browser.
//
// THE GESTURE: hold Control, then Shift, then Alt, in that order. While holding all three, press Enter
// three times. Then wait three seconds (letting go is fine).
//
// WHY THE WAIT IS ENFORCED HERE AND NOT IN THE BROWSER. A gesture has to be interpreted by client code, so
// unlike a typed passphrase it cannot be kept secret: anyone reading the bundle sees the shape of it, and
// could skip the gesture entirely and replay the request. So the delay is made real on the server instead.
// Unlocking takes two calls, and the second is rejected unless at least three seconds have passed since the
// first, proven by a signed timestamp the client cannot forge. Replaying costs the same three seconds as
// performing it, and the attempt limiter caps how many of those anyone gets.
//
// The unlock cookie is HMAC-signed and carries its own expiry, so it cannot be fabricated in a cookie
// editor, and editing the expiry forward invalidates it rather than extending it.
//
// WHAT THIS STILL IS NOT: access control. Anyone who can read your deployment's environment has everything.
// It also does not gate /api, which is deliberate: OAuth callbacks, webhooks and the worker must keep
// working while the front door is closed. Session and tenancy checks remain the only real authorization.
// Never put something behind stealth that would be harmful to reveal.
//
// Turned on by STEALTH_MODE=1. Absent or any other value means off, so a mistyped variable fails to a
// VISIBLE site rather than an invisible one.
import { createHmac, timingSafeEqual } from "crypto";

export const STEALTH_COOKIE = "vr_stealth";

const TTL_MS = 24 * 60 * 60 * 1000; // a browser open tomorrow is still unlocked; a shared machine re-arms

// The wait between starting the gesture and completing it. MIN is the three seconds; MAX stops a handshake
// being banked and cashed in much later.
export const HOLD_MIN_MS = 3000;
export const HOLD_MAX_MS = 120_000;

export function stealthConfigured(): boolean {
  return (process.env.STEALTH_MODE ?? "").trim() === "1";
}

/** THE ONE PLACE THAT DECIDES WHETHER A PAGE MAY BE INDEXED.
 *
 *  `wanted` is the page's own preference. Stealth vetoes it, and only ever in the noindex direction, so a
 *  page that wants to be hidden stays hidden whether or not the curtain is down.
 *
 *  This exists because the decision was made independently in three places: the root layout, the v6 layout,
 *  and the two per-page metadata helpers. Metadata in Next merges by depth and the DEEPEST wins, so the
 *  per-page helpers silently overrode both layouts. Every page therefore served a real title, a real
 *  description and index,follow over a body that read "Not open yet." Fixing the layout alone looked correct
 *  in the diff and changed nothing on the site, which is exactly what a duplicated decision buys you.
 *
 *  proxy.ts sets X-Robots-Tag as the catch-all, because a response header cannot be overridden by document
 *  metadata at any depth. This function stops the tag from disagreeing with it. */
export function robotsMeta(wanted: boolean): { index: boolean; follow: boolean } {
  const allowed = wanted && !stealthConfigured();
  return { index: allowed, follow: allowed };
}

function signingKey(): string {
  return process.env.VRAELIS_SECRET_KEY || process.env.AUTH_SECRET || "stealth-fallback-key";
}

function hmac(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("hex");
}

// Constant-time compare of two hex digests.
function sameDigest(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

// ── handshake: proves the three seconds actually elapsed ──
// "<issuedAt>.<hmac>". The client holds it between the two calls and cannot move the clock inside it.
export function signHandshake(now = Date.now()): string {
  return `${now}.${hmac(`begin:${now}`)}`;
}

export function handshakeAgeMs(token: string | undefined, now = Date.now()): number | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const issued = token.slice(0, dot);
  const issuedAt = Number(issued);
  if (!Number.isFinite(issuedAt)) return null;
  if (!sameDigest(token.slice(dot + 1), hmac(`begin:${issued}`))) return null;
  return now - issuedAt;
}

export function handshakeSatisfied(token: string | undefined, now = Date.now()): boolean {
  const age = handshakeAgeMs(token, now);
  return age !== null && age >= HOLD_MIN_MS && age <= HOLD_MAX_MS;
}

// ── unlock cookie ──
export function signStealthCookie(now = Date.now()): string {
  const expires = now + TTL_MS;
  return `${expires}.${hmac(`unlock:${expires}`)}`;
}

export function verifyStealthCookie(raw: string | undefined, now = Date.now()): boolean {
  if (!raw) return false;
  const dot = raw.indexOf(".");
  if (dot <= 0) return false;
  const expires = raw.slice(0, dot);
  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return false;
  return sameDigest(raw.slice(dot + 1), hmac(`unlock:${expires}`));
}

export const STEALTH_COOKIE_MAX_AGE = Math.floor(TTL_MS / 1000);

// Cookie options for the unlock, shared by the gesture and the reviewer entrance.
//
// The domain matters: the site is two hosts (vraelis.com and app.vraelis.com) and BOTH render through the
// root layout, so both are curtained. A host-only cookie would unlock the marketing site and leave the
// product still behind the curtain, which is the half that anyone actually wants to see. Scoping to
// ".vraelis.com" covers both in one grant.
//
// Only in production: on localhost there is no such domain, and setting one there makes the browser drop
// the cookie silently, which looks exactly like the unlock not working.
export function stealthCookieOptions(host: string | null | undefined) {
  const h = (host ?? "").toLowerCase().split(":")[0];
  const shared = h === "vraelis.com" || h.endsWith(".vraelis.com");
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: STEALTH_COOKIE_MAX_AGE,
    ...(shared ? { domain: ".vraelis.com" } : {}),
  };
}
