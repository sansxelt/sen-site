// CSP violation sink. next.config.ts ships Content-Security-Policy-Report-Only with `report-uri` pointing
// here, so the policy can be observed against real traffic before it is promoted to enforcing.
//
// Without a sink, "Report-Only" collects nothing and the documented plan — watch reports, then promote —
// could never happen. Browsers POST here with content-type application/csp-report (legacy) or
// application/reports+json (Reporting API); both are accepted.
//
// This endpoint is UNAUTHENTICATED by necessity: the browser posts it, not the app. It is therefore
// treated as hostile input — rate limited, size capped, and only a fixed set of fields is ever logged.
// Nothing is written to the database, so it cannot be used as a storage sink.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { limitOr429 } from "@/lib/vraelis-ratelimit";

export const runtime = "nodejs";

const MAX_BYTES = 16 * 1024;
const clip = (v: unknown, n = 300) => (typeof v === "string" ? v.slice(0, n) : undefined);

export async function POST(req: NextRequest) {
  // Generous, because a single page load can legitimately emit several violations, but bounded: this is a
  // public endpoint and a browser is not the only thing that can post to it.
  const limited = await limitOr429(req, "csp-report", 60, 600);
  if (limited) return limited;

  const raw = await req.text().catch(() => "");
  if (!raw || raw.length > MAX_BYTES) return new NextResponse(null, { status: 204 });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  // Legacy shape: { "csp-report": {...} }. Reporting API shape: [ { type, body: {...} }, ... ].
  const reports: Record<string, unknown>[] = Array.isArray(parsed)
    ? parsed.map((r) => (r as { body?: Record<string, unknown> })?.body ?? {})
    : [((parsed as { "csp-report"?: Record<string, unknown> })?.["csp-report"] ?? parsed) as Record<string, unknown>];

  for (const r of reports.slice(0, 10)) {
    // Only these fields, clipped. The full report can carry page URLs with query strings — which on this
    // app can include reset tokens and OAuth codes — so it is never logged wholesale.
    console.warn("[csp-report]", {
      directive: clip(r["effective-directive"] ?? r["effectiveDirective"] ?? r["violated-directive"], 60),
      blocked: clip(r["blocked-uri"] ?? r["blockedURL"], 200),
      documentPath: (() => {
        const d = clip(r["document-uri"] ?? r["documentURL"], 500);
        if (!d) return undefined;
        try { return new URL(d).pathname; } catch { return undefined; } // path only — never the query
      })(),
      disposition: clip(r["disposition"], 20),
    });
  }

  // 204 always: a violation report is telemetry, and the browser has nothing useful to do with an error.
  return new NextResponse(null, { status: 204 });
}
