// POST /api/v/funnel — the anonymous top of the funnel.
//
// Every other stage is recorded server-side at the moment it happens, because every other stage is
// something an account did. A visit is not: nobody is signed in and there is no request to hang it off, so
// this is the one beacon.
//
// WHAT IT ACCEPTS, AND WHY THAT IS ALL. A path. Not a referrer, not a user agent, not a query string, not a
// screen size. logEvent already strips keys that look like an IP or an address (lib/v-events.ts), and this
// route never offers it any. The question being answered is "how many people reached the site and where did
// they land", which a path answers, and "who is this person", which it deliberately cannot.
//
// The path is matched against a fixed list rather than trusted. An unauthenticated endpoint that writes a
// caller-supplied string into an analytics table is a log-injection surface and a way to fill the table with
// junk; an allowlist means the worst a caller can do is claim a visit to a page that exists.
//
// NOTE ON STEALTH, AND IT DECIDES WHAT THE NUMBER MEANS. While the curtain is down the root layout returns
// before the site shell renders, so somebody arriving cold never reaches this. Somebody holding the
// reviewer bypass DOES: the cookie lifts the curtain for that browser, the shell mounts, and the beacon
// fires. Those are not visitors in the sense this metric is for.
//
// Rather than drop them (which would leave the whole pipeline unverifiable until launch day, exactly when
// nobody wants to discover it never worked), each visit records whether the curtain was up when it
// happened. Pre-launch traffic stays countable, separable, and obviously small.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { logEvent } from "@/lib/v-events";
import { EV_VISIT } from "@/lib/funnel";
import { allow, clientIp } from "@/lib/vraelis-ratelimit";
import { stealthConfigured } from "@/lib/stealth";

export const runtime = "nodejs";

// The public marketing surfaces. A path outside this list is recorded as "other" rather than rejected, so
// a page added later still counts as a visit while never writing an unvetted string.
const KNOWN = new Set([
  "/", "/platform", "/method", "/agents", "/pricing", "/developers", "/docs", "/research",
  "/changelog", "/company", "/security", "/enterprise", "/limitations", "/integrations",
  "/contact", "/readme", "/privacy", "/terms", "/refunds", "/subprocessors", "/data-rights", "/trademark",
]);

// Obvious automated traffic. Not a security control and not treated as one: it keeps the count roughly
// honest without pretending a user agent is trustworthy.
const BOT = /bot|crawl|spider|slurp|bingpreview|headlesschrome|lighthouse|monitoring|uptime|curl|wget|python-requests/i;

// Article URLs are real landing pages and there are too many to allowlist by name. They collapse to a
// CONSTANT section label rather than being recorded as sent, so the "never write a caller string" rule
// still holds and the traffic stops disappearing into "other". Measured before this: 34 of 200 landings,
// 17 per cent, were unattributed, on the one instrument that exists to say where people arrive.
const SECTIONS: [string, string][] = [
  ["/docs/", "/docs/:slug"],
  ["/research/", "/research/:slug"],
];

function label(raw: string): string {
  if (KNOWN.has(raw)) return raw;
  for (const [prefix, name] of SECTIONS) if (raw.startsWith(prefix) && raw.length > prefix.length) return name;
  return "other";
}

export async function POST(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";
  if (BOT.test(ua)) return NextResponse.json({ ok: true, skipped: "bot" });

  // Per-IP ceiling. The beacon fires once per browser tab session, so a real person is nowhere near this;
  // it is here so the endpoint cannot be used to write rows in a loop. The IP is used for the limiter key
  // only and is never written to the event.
  if (!(await allow(`funnel:${clientIp(req)}`, 60, 3600))) {
    return NextResponse.json({ ok: true, skipped: "rate_limited" });
  }

  let body: { path?: unknown } = {};
  try { body = await req.json(); } catch { /* an empty beacon still counts as a visit to "other" */ }

  const raw = typeof body.path === "string" ? body.path.split("?")[0].split("#")[0] : "";
  const path = label(raw);

  await logEvent({
    eventType: EV_VISIT, actorType: "system", source: "web", route: path,
    metadata: { curtained: stealthConfigured() },
  });
  return NextResponse.json({ ok: true });
}
