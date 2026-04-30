// POST /api/metrics — client-side event sink.
//
// Dispatched from web-chat.tsx and other surfaces via fetch (or
// navigator.sendBeacon, which routes here too). Body: { kind, props? }.
// We auth via the standard cookie/desktop bearer to associate events
// with the user, but we DON'T fail closed if auth is missing — anon
// events still log so we can see funnel pressure on logged-out
// surfaces. The handler is intentionally minimal: parse, sanitize,
// record, return ok.

import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../lib/desktop-auth";
import { recordMetric, type MetricKind, type MetricProps } from "../../../lib/metrics";

export const runtime = "nodejs";

const ALLOWED_KINDS: ReadonlySet<MetricKind> = new Set([
  "duel_started",
  "duel_completed",
  "duel_winner_picked",
  "duel_pinned_prompt_fired",
  "duel_retry_both",
  "duel_upsell_shown",
  "duel_upsell_dismissed",
  "upgrade_clicked",
  "limit_hit",
  "credits_used",
  "boost_consumed",
  "client_event",
]);

export async function POST(request: Request) {
  let body: { kind?: unknown; props?: unknown; surface?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: true }); // ignore malformed
  }
  const kind =
    typeof body.kind === "string" && ALLOWED_KINDS.has(body.kind as MetricKind)
      ? (body.kind as MetricKind)
      : null;
  if (!kind) return NextResponse.json({ ok: true });

  let email: string | null = null;
  try {
    email = await getDesktopUserEmailFromRequest(request);
    if (!email) {
      const session = await auth();
      email = session?.user?.email ?? null;
    }
  } catch {
    // anon
  }

  // Sanitize props to primitives only.
  let props: MetricProps | undefined;
  if (body.props && typeof body.props === "object") {
    const out: MetricProps = {};
    for (const [k, v] of Object.entries(body.props as Record<string, unknown>)) {
      if (
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean" ||
        v === null
      ) {
        out[k] = v;
      }
    }
    props = out;
  }
  const surface =
    body.surface === "desktop" ? "desktop" : ("web" as const);
  recordMetric({ kind, email, surface, props });
  return NextResponse.json({ ok: true });
}
