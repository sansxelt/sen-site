// POST /api/stealth/unlock  { seq: string }  ->  { ok: boolean }
//
// The server half of the stealth curtain. The client never knows the sequence; it sends what was typed and
// this route decides. That is the whole point: the secret stays out of the browser bundle, and because the
// check happens here it can be rate limited, which is what actually stops a brute force. A short sequence
// checked in the browser could be guessed offline in milliseconds.
//
// On success it sets an httpOnly, HMAC-signed cookie. httpOnly keeps page scripts from reading it; the
// signature keeps anyone from fabricating one in a cookie editor.
//
// Fails closed and says as little as possible: every rejection is the same shape, so nothing here reveals
// how close an attempt was, or how long the sequence is.
import { NextResponse } from "next/server";
import {
  stealthConfigured, sequenceMatches, signStealthCookie, STEALTH_COOKIE, STEALTH_COOKIE_MAX_AGE,
} from "@/lib/stealth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-instance attempt budget. Serverless spreads requests across instances so this is a speed bump rather
// than a wall, but combined with the fixed delay below it takes scripted guessing from thousands per second
// to a rate where a small key space still holds up.
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 12;
const attempts = new Map<string, { n: number; resetAt: number }>();

function tooMany(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || rec.resetAt <= now) {
    attempts.set(ip, { n: 1, resetAt: now + WINDOW_MS });
    if (attempts.size > 5000) attempts.clear(); // crude bound; this map must never grow without limit
    return false;
  }
  rec.n += 1;
  return rec.n > MAX_ATTEMPTS;
}

const deny = () => NextResponse.json({ ok: false }, { status: 200, headers: { "cache-control": "no-store" } });

export async function POST(req: Request) {
  // When stealth is off there is nothing to unlock. Answering identically avoids advertising the state.
  if (!stealthConfigured()) return deny();

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (tooMany(ip)) return deny();

  // A fixed delay on every attempt, right or wrong. Constant so it never signals correctness by timing.
  await new Promise((r) => setTimeout(r, 250));

  const body = (await req.json().catch(() => null)) as { seq?: unknown } | null;
  const seq = typeof body?.seq === "string" ? body.seq : "";
  if (!seq || seq.length > 64 || !sequenceMatches(seq)) return deny();

  const res = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  res.cookies.set(STEALTH_COOKIE, signStealthCookie(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STEALTH_COOKIE_MAX_AGE,
  });
  return res;
}
