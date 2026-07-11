// POST /api/preflight/apps/[id]/discover — kick off a discovery run for a connected app.
// Flag-gated + session-authenticated; ownership enforced in the data layer. The crawl itself runs AFTER
// the response via next/server after() so the request never blocks on the network. Guards, in order:
// flag -> auth -> ownership -> ownership attestation -> FAIL-CLOSED rate limit -> idempotency key ->
// one-active-per-app. one-active is enforced BOTH by the getActiveDiscovery check AND a partial-unique
// index on active-state rows (the DB backstop for a concurrent double-submit race). The idempotency key is
// persisted so a same-key replay of an in-flight run resolves to it.

import { NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { getApplication } from "@/lib/v-applications";
import { allowStrict } from "@/lib/vraelis-ratelimit";
import { getActiveDiscovery, createDiscovery } from "@/lib/preflight/discovery-db";
import { runDiscovery } from "@/lib/preflight/discover-run";

export const runtime = "nodejs";
// A discovery does a bounded crawl (~20s) + a synthesis LLM call (~50s) in after(); keep the budget above
// their worst-case sum. getActiveDiscovery is also age-bounded, so an interrupted run auto-clears.
export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const owner = email.toLowerCase();
  const { id } = await params;

  const app = await getApplication(owner, id);
  if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!app.ownership_confirmed) {
    return NextResponse.json({ error: "attestation_required", message: "Confirm you own or are authorized to test this app before discovery." }, { status: 400 });
  }

  // FAIL CLOSED: allowStrict denies on any limiter unavailability, so a limiter outage cannot unlock
  // unbounded crawl+LLM work.
  if (!(await allowStrict(`discover:${owner}`, 5, 3600))) {
    return NextResponse.json({ error: "rate_limited", message: "Too many discovery runs. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const idempotencyKey = req.headers.get("idempotency-key") || (typeof body?.submission_id === "string" ? body.submission_id : "");
  if (!idempotencyKey) {
    return NextResponse.json({ error: "idempotency_key_required", message: "Send an Idempotency-Key header or a submission_id." }, { status: 400 });
  }

  const active = await getActiveDiscovery(owner, id);
  if (active) return NextResponse.json({ error: "discovery_in_progress", discoveryId: active.id }, { status: 409 });

  const created = await createDiscovery(owner, id, idempotencyKey);
  if (!created) {
    // Insert failed. If a concurrent request won the race (partial-unique active index), report it as
    // in-progress instead of a generic error.
    const now = await getActiveDiscovery(owner, id);
    if (now) return NextResponse.json({ error: "discovery_in_progress", discoveryId: now.id }, { status: 409 });
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  after(() => runDiscovery(owner, id, created));
  return NextResponse.json({ status: "started", discoveryId: created.id }, { status: 202 });
}
