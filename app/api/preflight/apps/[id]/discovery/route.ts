// GET /api/preflight/apps/[id]/discovery — latest discovery status for a connected app.
// Flag-gated + session-authenticated; ownership enforced in the data layer. Returns only safe fields
// (no raw HTML / no page bodies) so the client can poll progress. { state: "none" } when never run.

import { NextResponse } from "next/server";
import { getLatestDiscovery } from "@/lib/preflight/discovery-db";
import { gatePreflightApp, gateReasonResponse } from "@/lib/preflight/team-access";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Polling discovery status is a READ (viewer+). owner = app owner (data-plane key).
  const g = await gatePreflightApp(id, "viewer");
  if (!g.ok) return gateReasonResponse(g.reason);
  const owner = g.owner;

  const latest = await getLatestDiscovery(owner, id);
  if (!latest) return NextResponse.json({ state: "none" });

  const failures = Array.isArray(latest.failures) ? latest.failures : [];
  return NextResponse.json({
    state: latest.state, version: latest.version, pages_count: latest.pages_count,
    failures, started_at: latest.started_at, completed_at: latest.completed_at,
  });
}
