// POST — cheap, safe, READ-ONLY health check for one connection.
//
// What it may do, and nothing else:
//   - URL-bearing metadata (supabase project_url, sentry DSN host, webhook url, vercel deployment_url):
//     one HEAD (GET fallback on 405/501) with a 5-second timeout — and ONLY after unsafeHttpsUrlReason
//     clears the stored URL (private/loopback/metadata hosts are never fetched), through safeFetch
//     (DNS-resolved, pinned, https-only). 2xx/3xx/401/403 = reachable; anything else is honest failure.
//   - github repo metadata: one unauthenticated GET to api.github.com (public repos verify; a 404 is
//     reported as "private or not found", never an alarm).
//   - test_account / custom_auth / custom_deploy / stripe_test / openapi: NO remote call; the check
//     marks the row checked with a "metadata only" note. No decryption happens anywhere on this route.
//
// Safety rails: owner-gated (session -> getApplication -> connection filtered by user_id +
// application_id + id), rate-limited per user, URLs only ever come from the connection's own stored
// sanitized metadata (nothing from the request), notes are FIXED strings + at most an HTTP status
// number (never raw provider errors), and a failed check updates only status + note — previously
// valid metadata is never destroyed. Audit event carries application_id + provider only.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { getApplication } from "@/lib/v-applications";
import { getConnection, recordConnectionCheck } from "@/lib/preflight/connections-db";
import { planHealthCheck, healthStatusFromHttp, CHECK_NOTES, CHECK_TIMEOUT_MS } from "@/lib/preflight/connection-health";
import { unsafeHttpsUrlReason, safeFetch, isBlockedFetchError } from "@/lib/safe-fetch";
import { checkRateLimit } from "@/lib/rate-limit";
import { logEvent } from "@/lib/v-events";

export const runtime = "nodejs";
export const maxDuration = 30;

type Params = Promise<{ id: string; connId: string }>;
type CheckResult = { status: "connected" | "error"; note: string };

// One reachability probe: the SSRF string guard runs FIRST (an unsafe URL is never fetched at all),
// then HEAD (cheapest; GET fallback when the host rejects HEAD) through DNS-pinned safeFetch. Read-only
// by construction; redirects are never followed (a 3xx already proves reachability).
async function probeUrl(url: string, rootProbe: boolean): Promise<CheckResult> {
  const reason = unsafeHttpsUrlReason(url);
  if (reason) return { status: "error", note: CHECK_NOTES.unsafeUrl(reason) };
  const init = { method: "HEAD", redirect: "manual" as const, signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) };
  try {
    let res = await safeFetch(url, init);
    if (res.status === 405 || res.status === 501) {
      res = await safeFetch(url, { ...init, method: "GET", signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) });
    }
    const status = healthStatusFromHttp(res.status, rootProbe ? "root" : "endpoint");
    return {
      status,
      note: status !== "connected" ? CHECK_NOTES.badStatus(res.status)
        : rootProbe ? CHECK_NOTES.reachableRoot(res.status) : CHECK_NOTES.reachable(res.status),
    };
  } catch (e) {
    // safeFetch's SSRF/DNS-pin rejection is NOT a network problem: the URL was refused before any
    // request went out. Report it as the unsafe-URL note so the owner is never sent debugging a
    // fake uptime issue.
    if (isBlockedFetchError(e)) return { status: "error", note: CHECK_NOTES.unsafeUrl("blocked") };
    return { status: "error", note: CHECK_NOTES.network };
  }
}

async function probeGithubRepo(repo: string): Promise<CheckResult> {
  const url = `https://api.github.com/repos/${repo}`;
  const reason = unsafeHttpsUrlReason(url);
  if (reason) return { status: "error", note: CHECK_NOTES.unsafeUrl(reason) };
  try {
    const res = await safeFetch(url, {
      method: "GET", redirect: "manual",
      headers: { accept: "application/vnd.github+json", "user-agent": "vraelis-preflight-health-check" },
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    if (res.status >= 200 && res.status < 300) return { status: "connected", note: CHECK_NOTES.githubPublic };
    if (res.status === 404) return { status: "connected", note: CHECK_NOTES.githubNotFound };
    if (res.status === 403 || res.status === 429) return { status: "connected", note: CHECK_NOTES.githubRateLimited };
    return { status: "error", note: CHECK_NOTES.githubBadStatus(res.status) };
  } catch {
    return { status: "error", note: CHECK_NOTES.githubNetwork };
  }
}

export async function POST(req: Request, ctx: { params: Params }) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  if (!(await preflightDbReady())) return NextResponse.json({ error: "setup_required" }, { status: 503 });
  const owner = email.toLowerCase();
  const { id, connId } = await ctx.params;
  const app = await getApplication(owner, id);
  if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!checkRateLimit(`connverify:${owner}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "rate_limited", message: "Too many health checks. Try again in a few minutes." }, { status: 429 });
  }

  // A removed/revoked connection cannot verify: the row is gone, so this is an honest 404.
  const conn = await getConnection(owner, id, connId);
  if (!conn) return NextResponse.json({ error: "not_found", message: "No such connection on this application." }, { status: 404 });

  // The plan only ever derives from the connection's OWN stored metadata; the request body is ignored.
  const plan = planHealthCheck(conn.provider, conn.meta);
  let result: CheckResult;
  if (plan.kind === "metadata_only") {
    result = { status: "connected", note: CHECK_NOTES.metadataOnly };
  } else if (plan.kind === "github") {
    result = await probeGithubRepo(plan.repo);
  } else {
    // probeUrl runs the SSRF string guard before touching the network; safeFetch then DNS-pins the
    // connect so the host cannot re-resolve to a private address.
    result = await probeUrl(plan.url, plan.rootProbe);
  }

  const recorded = await recordConnectionCheck(owner, id, connId, result.status, result.note);
  if (!recorded) return NextResponse.json({ error: "not_found", message: "The connection disappeared before the check could be recorded." }, { status: 404 });
  await logEvent({ userId: owner, eventType: "connection_verified", actorType: "owner", source: "preflight", route: "/api/preflight/apps/[id]/connections/[connId]/verify", metadata: { application_id: id, provider: conn.provider } });
  return NextResponse.json({ ok: true, status: result.status, note: result.note, last_verified_at: new Date().toISOString() });
}
