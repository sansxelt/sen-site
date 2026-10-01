// Two-step verification: the pure half. Every function here is deterministic given its inputs (or draws only
// from crypto.randomBytes / randomInt), touches no database and reads no environment, so the whole of it is
// exercised offline by scripts/two-step-verify.ts. The stateful half (storage, rate limits, email) lives in
// lib/two-step-db.ts and the sign-in gate that uses both lives in lib/two-step-session.ts.
//
// THE THREE METHODS
//   - Authenticator app: TOTP per RFC 6238 with the parameters every authenticator app defaults to (HMAC-SHA1,
//     6 digits, 30 second step). One step either side is accepted to absorb clock drift between the phone and
//     the server; a matched step is then consumed so the same code cannot be replayed (see two-step-db.ts).
//   - Email codes: nothing is stored. The code is an HMAC over (server key, purpose, email, issued-at second),
//     so the server can recompute it on submission. It is valid for EMAIL_CODE_TTL_S after the second it was
//     issued, and single use is enforced by consuming a key in the Postgres rate limiter.
//   - Recovery codes: ten random codes shown once. Only a keyed hash of each is kept (sealed in the vault with
//     the rest of the row), and a used code is removed from the list.
//
// Server-only: node:crypto. Never import this from a client component.
import crypto from "node:crypto";

// The provider value of the ONE v_account_connections row that holds a user's two-step settings. That table is
// otherwise the account's OAuth integrations, so every surface that lists or opens integrations excludes this
// value (lib/preflight/account-connections-db.ts).
export const TWO_STEP_PROVIDER = "two_step";

export type TwoStepMethod = "totp" | "email";
export type ProofMethod = TwoStepMethod | "recovery";
// What an emailed code is FOR. It is part of the HMAC input, so a code mailed to finish signing in cannot be
// replayed to turn two-step verification off from the console, and the reverse.
export type EmailPurpose = "sign_in" | "enable_email" | "confirm";

export const TOTP_STEP_S = 30;
export const TOTP_DIGITS = 6;
export const TOTP_WINDOW = 1; // steps accepted either side of now
export const EMAIL_CODE_TTL_S = 10 * 60;
export const RECOVERY_CODE_COUNT = 10;
export const ISSUER = "Vraelis";

// ── Base32 (RFC 4648, upper case, no padding): the encoding authenticator apps expect for the secret ────────
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

// Tolerant of the forms a person pastes: lower case, spaces, dashes and trailing "=" padding. Returns null for
// anything else rather than decoding garbage into a secret nobody can match.
export function base32Decode(input: string): Buffer | null {
  const clean = input.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");
  if (!clean || /[^A-Z2-7]/.test(clean)) return null;
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

// 160 bits, the length RFC 4226 recommends for HMAC-SHA1. 32 base32 characters.
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

// "ABCD EFGH ..." for typing into an app by hand. Apps ignore the spaces.
export function formatSecretForDisplay(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

// ── HOTP / TOTP ─────────────────────────────────────────────────────────────────────────────────────────
// RFC 4226 section 5.3: HMAC over the 8-byte big-endian counter, dynamic truncation, modulo 10^digits.
// The counter is split into two 32-bit halves because JavaScript bitwise operators are 32-bit.
export function hotp(key: Buffer, counter: number, digits = TOTP_DIGITS, algorithm: "sha1" | "sha256" | "sha512" = "sha1"): string {
  const msg = Buffer.alloc(8);
  msg.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  msg.writeUInt32BE(counter >>> 0, 4);
  const h = crypto.createHmac(algorithm, key).update(msg).digest();
  const offset = h[h.length - 1] & 0x0f;
  const bin = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export function totpCounter(unixSeconds: number, step = TOTP_STEP_S): number {
  return Math.floor(unixSeconds / step);
}

export function totpAt(key: Buffer, unixSeconds: number, digits = TOTP_DIGITS): string {
  return hotp(key, totpCounter(unixSeconds), digits);
}

// Digits only, so "123 456" and "123-456" typed or pasted from an app both work.
export function normalizeNumericCode(input: string): string {
  return String(input ?? "").replace(/[\s-]/g, "");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Returns the matched COUNTER (so the caller can consume it against replay), or null. Every step in the window
// is compared, match or not, so the time taken does not reveal which step matched.
export function verifyTotp(secret: string, code: string, unixSeconds: number, window = TOTP_WINDOW): number | null {
  const key = base32Decode(secret);
  const c = normalizeNumericCode(code);
  if (!key || !/^\d{6}$/.test(c)) return null;
  const now = totpCounter(unixSeconds);
  let matched: number | null = null;
  for (let d = -window; d <= window; d++) {
    if (safeEqual(hotp(key, now + d), c) && matched === null) matched = now + d;
  }
  return matched;
}

// The Key URI format authenticator apps scan (github.com/google/google-authenticator/wiki/Key-Uri-Format).
// The label is "Issuer:account" so the entry reads "Vraelis (you@example.com)" in the app, and issuer is
// repeated as a parameter because newer apps prefer it over the label prefix.
export function otpauthUri(secret: string, account: string, issuer = ISSUER): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const q = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(TOTP_DIGITS), period: String(TOTP_STEP_S) });
  return `otpauth://totp/${label}?${q.toString()}`;
}

// ── Email codes ─────────────────────────────────────────────────────────────────────────────────────────
// The code is bound to the second it was issued. Carrying that second (in the sign-in token, or back from the
// console) is what makes "valid for 10 minutes" exact without storing anything: a clock-aligned 10 minute
// window would give a code sent at 9:59 into the window one second of life, or, if the previous window were
// also accepted, up to twenty minutes. A client that lies about the second gains nothing: the code for any
// second it did not receive by email is as unknown as any other six digits, and attempts are rate limited.
export function emailCode(key: Buffer, email: string, purpose: EmailPurpose, issuedAt: number): string {
  const h = crypto.createHmac("sha256", key)
    .update(`vraelis-email-code|v1|${purpose}|${email.trim().toLowerCase()}|${Math.floor(issuedAt)}`)
    .digest();
  const offset = h[h.length - 1] & 0x0f;
  const bin = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

export type EmailCodeCheck = "ok" | "expired" | "invalid";

export function checkEmailCode(
  key: Buffer, email: string, purpose: EmailPurpose, issuedAt: number, code: string, nowSeconds: number,
): EmailCodeCheck {
  const c = normalizeNumericCode(code);
  if (!Number.isFinite(issuedAt) || !/^\d{6}$/.test(c)) return "invalid";
  const age = nowSeconds - Math.floor(issuedAt);
  // A code "issued" in the future is not a clock skew we produce: both seconds come from this server.
  if (age < 0) return "invalid";
  if (age > EMAIL_CODE_TTL_S) return "expired";
  return safeEqual(emailCode(key, email, purpose, issuedAt), c) ? "ok" : "invalid";
}

// ── Recovery codes ──────────────────────────────────────────────────────────────────────────────────────
// Ten characters from 31 symbols with the look-alikes removed (no i, l, o, 0, 1), about 49 bits each, shown
// as "abcde-fghjk". randomInt draws without modulo bias.
const RECOVERY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    let s = "";
    for (let i = 0; i < 10; i++) s += RECOVERY_ALPHABET[crypto.randomInt(RECOVERY_ALPHABET.length)];
    codes.add(`${s.slice(0, 5)}-${s.slice(5)}`);
  }
  return [...codes];
}

// Case, spaces and the dash are presentation only.
export function normalizeRecoveryCode(input: string): string {
  return String(input ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Keyed (HMAC) rather than a bare hash, and bound to the account: a leaked row alone does not let anyone test
// guesses offline without the server key, and the same code on two accounts hashes differently.
export function hashRecoveryCode(key: Buffer, email: string, code: string): string {
  return crypto.createHmac("sha256", key)
    .update(`vraelis-recovery|v1|${email.trim().toLowerCase()}|${normalizeRecoveryCode(code)}`)
    .digest("hex");
}

// Index of the matching stored hash, or -1. Compared in constant time against every entry.
export function findRecoveryCode(key: Buffer, email: string, code: string, hashes: string[]): number {
  const norm = normalizeRecoveryCode(code);
  if (norm.length !== 10) return -1;
  const h = hashRecoveryCode(key, email, norm);
  let found = -1;
  hashes.forEach((stored, i) => { if (safeEqual(stored, h) && found === -1) found = i; });
  return found;
}

// ── Presentation ────────────────────────────────────────────────────────────────────────────────────────
// Shown on the challenge so a person can tell which inbox to open without the page printing the full address
// to anyone looking at a half-signed-in screen: "nishanth@gmail.com" -> "n••••h@gmail.com".
export function maskEmail(email: string): string {
  const e = String(email ?? "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return "your email";
  const local = e.slice(0, at), domain = e.slice(at + 1);
  const shown = local.length <= 2 ? `${local[0]}•` : `${local[0]}••••${local[local.length - 1]}`;
  return `${shown}@${domain}`;
}
