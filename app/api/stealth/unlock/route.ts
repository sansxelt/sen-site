// POST /api/stealth/unlock
//   { step: "begin" }                  -> { ok: true, token }   starts the three-second wait
//   { step: "complete", token }        -> { ok: true }          sets the unlock cookie, if the wait elapsed
//
// The server half of the stealth curtain. The gesture itself lives in the browser and cannot be secret, so
// this route makes the WAIT real instead: the second call is refused unless at least three seconds have
// passed since the first, proven by a signed timestamp the client cannot forge. Skipping the gesture and
// replaying the calls therefore costs exactly as much time as performing it, and the attempt limiter caps
// how many of those anyone gets.
//
// Fails closed and says as little as possible: every rejection is the same shape, so nothing reveals which
// step failed or how close an attempt was.
import { NextResponse } from "next/server";
import {
  stealthConfigured, signHandshake, handshakeSatisfied,
  signStealthCookie, stealthCookieOptions, STEALTH_COOKIE,
} from "@/lib/stealth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-instance attempt budget. Serverless spreads requests across instances so this is a speed bump rather
// than a wall; combined with the enforced three-second wait it makes scripted guessing pointless.
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 20; // two calls per real unlock, so this is ~10 genuine attempts a minute
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

  const body = (await req.json().catch(() => null)) as { step?: unknown; token?: unknown } | null;
  const step = typeof body?.step === "string" ? body.step : "";

  if (step === "begin") {
    return NextResponse.json({ ok: true, token: signHandshake() }, { headers: { "cache-control": "no-store" } });
  }

  if (step !== "complete") return deny();

  const token = typeof body?.token === "string" ? body.token : "";
  if (!token || token.length > 128 || !handshakeSatisfied(token)) return deny();

  const res = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  // Scoped to .vraelis.com: the gesture must unlock both hosts, not just the one it was performed on.
  res.cookies.set(STEALTH_COOKIE, signStealthCookie(), stealthCookieOptions(req.headers.get("x-forwarded-host") || req.headers.get("host")));
  return res;
}
