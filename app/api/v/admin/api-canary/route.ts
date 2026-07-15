// Founder-gated live API canary runner — the ONLY surface through which API-runtime functionality is
// reachable until the live canary passes (controlled-integration Phase 3 constraint).
//
// Auth (fails closed, mirrors the sibling admin routes + the cron pattern):
//   * a signed-in founder session passing isAdmin (VRAELIS_ADMIN allowlist), OR
//   * Authorization: Bearer <CRON_SECRET> (the established operator-secret gate) for the driver script.
// Additionally the whole surface 503s unless VRAELIS_CANARY_PASSWORD is configured (same env that arms the
// fixture), so an unconfigured deployment has NO live canary capability at all.
//
// Execution chain per phase: safeFetch (SSRF-pinned, https-only) -> pure api-adapter state machine ->
// decideRuntime -> real migration-12 rows (target/build/run/decision/issues/ledger). The canary secret is
// read from env HERE, at execution time, and handed only to the adapter's secret map — it never persists.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/v-entitlements";
import { safeFetch, isBlockedFetchError, blockedFetchReason } from "@/lib/safe-fetch";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { recordProviderCost } from "@/lib/preflight/cost-governor";
import {
  runCanaryPhase, makeSupabaseCanaryStore, CANARY_PHASES, type CanaryPhase,
} from "@/lib/preflight/runtime/canary";
import type { ApiFetch } from "@/lib/preflight/runtime/api-adapter";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function firstAdminEmail(): string | null {
  const first = (process.env.VRAELIS_ADMIN || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)[0];
  return first ?? null;
}

// Constant-time bearer check (matches the timingSafeEqual discipline used by the fixture + token validation),
// so a guessed operator token can't be recovered byte-by-byte via response timing.
function bearerMatches(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  // ── gate: founder session OR operator bearer; both fail closed ──
  const cronSecret = process.env.CRON_SECRET;
  const viaBearer = bearerMatches(req.headers.get("authorization"), cronSecret);
  let owner: string | null = null;
  if (viaBearer) {
    owner = firstAdminEmail();
  } else {
    const email = (await auth())?.user?.email ?? null;
    if (!email || !isAdmin(email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    owner = email.toLowerCase();
  }
  if (!owner) return NextResponse.json({ error: "canary_not_configured", detail: "VRAELIS_ADMIN is empty" }, { status: 503 });

  const password = process.env.VRAELIS_CANARY_PASSWORD;
  if (!password) return NextResponse.json({ error: "canary_not_configured", detail: "VRAELIS_CANARY_PASSWORD is not set" }, { status: 503 });

  let phase: CanaryPhase;
  try {
    const body = (await req.json()) as { phase?: string };
    if (!body.phase || !CANARY_PHASES.includes(body.phase as CanaryPhase)) {
      return NextResponse.json({ error: "bad_phase", allowed: CANARY_PHASES }, { status: 400 });
    }
    phase = body.phase as CanaryPhase;
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  // ── live deps: SSRF-safe fetcher + service-role store + this deployment's own fixture ──
  const fetcher: ApiFetch = async (url, init) => {
    try {
      const res = await safeFetch(url, { method: init.method, headers: init.headers, body: init.body, redirect: "manual" });
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => { headers[k] = v; });
      return { status: res.status, headers, text: await res.text() };
    } catch (e) {
      // Tag WHY the fetch failed so the canary classifies it correctly: a safe-fetch SSRF rejection
      // (non-https / private / metadata host) is a PRODUCT/security signal — the app under test is
      // misconfigured — NOT free infrastructure. A DNS/connect failure is a genuine transport (infra) event.
      const blocked = isBlockedFetchError(e);
      const tagged = e as { transportKind?: string; transportReason?: string | null };
      tagged.transportKind = blocked ? "blocked" : "unreachable";
      // Carry the SANITIZED block-reason CLASS (never the destination) so evidence records why the SSRF guard
      // fired — private_address / metadata_endpoint / unresolved_host / unsupported_scheme / port_not_allowed.
      tagged.transportReason = blocked ? blockedFetchReason(e) : null;
      throw e;
    }
  };
  const origin = process.env.VRAELIS_CANARY_BASE || req.nextUrl.origin;

  try {
    const result = await runCanaryPhase(
      {
        owner,
        fetcher,
        store: makeSupabaseCanaryStore(getSupabaseAdminClient(), recordProviderCost),
        clock: () => Date.now(),
        fixtureBase: (mode) => `${origin}/api/canary-fixture/${mode}`,
        secrets: { CANARY_PASSWORD: password },
      },
      phase,
    );
    return NextResponse.json(result);
  } catch (e) {
    // Fail loud but sanitized: no stack, no secret, no raw provider error beyond a short reason.
    return NextResponse.json({ error: "canary_failed", detail: (e as Error).message.slice(0, 160) }, { status: 500 });
  }
}
