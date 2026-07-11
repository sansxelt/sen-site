// GET /api/preflight/apps/[id]/discovery — latest discovery status for a connected app.
// Flag-gated + session-authenticated; ownership enforced in the data layer. Returns only safe fields
// (no raw HTML / no page bodies) so the client can poll progress. { state: "none" } when never run.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { getApplication } from "@/lib/v-applications";
import { getLatestDiscovery } from "@/lib/preflight/discovery-db";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const owner = email.toLowerCase();
  const { id } = await params;

  const app = await getApplication(owner, id);
  if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const latest = await getLatestDiscovery(owner, id);
  if (!latest) return NextResponse.json({ state: "none" });

  const failures = Array.isArray(latest.failures) ? latest.failures : [];
  return NextResponse.json({
    state: latest.state, version: latest.version, pages_count: latest.pages_count,
    failures, started_at: latest.started_at, completed_at: latest.completed_at,
  });
}
