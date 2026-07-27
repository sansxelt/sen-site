// Derive a guarantee's proof plan: reuse an existing valid plan if one is already prepared, otherwise
// synthesize its claim against the system's current deployment, run the deterministic coverage gate, and mint
// an immutable reviewed plan the human then approves. NO run, NO charge, session-gated.
//
// STABILITY (the fix for the derivation bug): a prepared plan is STICKY. By default this route REUSES the
// latest live (pending, unexpired) reviewed plan for this guarantee's claim + deployment instead of
// re-synthesizing, so a refresh or a repeated "Derive" returns the SAME plan rather than regenerating a new
// one. Only an explicit `{ force: true }` (Regenerate) bypasses reuse and synthesizes fresh.
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { auth } from "@/auth";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { applicationAccess } from "@/lib/preflight/team-access";
import { hasAtLeastRole } from "@/lib/v-workspace";
import { getApplication } from "@/lib/v-applications";
import { getGuarantee, setGuaranteePlanReview } from "@/lib/preflight/guarantees-db";
import { synthesizeClaim } from "@/lib/preflight/verification-lane";
import { resolveCoverage } from "@/lib/preflight/coverage-resolve";
import { repairPrompt } from "@/lib/preflight/coverage";
import { planHash } from "@/lib/preflight/reviewed-plan";
import { mintReviewedPlan, findLivePendingPlanForClaim, type PendingPlanView } from "@/lib/preflight/reviewed-plan-db";
import { listConnections } from "@/lib/preflight/connections-db";

export const runtime = "nodejs";
export const maxDuration = 300; // crawl + synthesis + bounded correction, inside the worker budget
const TTL_MS = 60 * 60 * 1000; // the reviewed plan stays approvable for 60 minutes

const forbidden = () => NextResponse.json({ error: "forbidden", message: "You have view-only access to this system." }, { status: 403 });

// The test-account roles configured on this system (labels only, never a credential), so coverage can judge a
// flow that signs in as one of them. Mirrors verification-lane.laneRoles, for an arbitrary system app.
async function systemRoles(owner: string, appId: string): Promise<string[]> {
  try {
    const conns = await listConnections(owner, appId);
    return Array.from(new Set(conns
      .filter((c) => c.provider === "test_account")
      .map((c) => String((c.meta as Record<string, unknown>).role || (c.meta as Record<string, unknown>).label || "").trim())
      .filter(Boolean)));
  } catch { return []; }
}

function planResponse(live: PendingPlanView, reused: boolean) {
  return NextResponse.json({
    ready: true,
    requirements: live.plan.requirements.map((r) => r.text),
    flows: live.plan.flows.map((f) => ({ name: f.name, goal: f.goal, steps: f.steps.length })),
    reviewed_plan_id: live.id,
    reviewed_plan_expires_at: live.expiresAt,
    reused,
  }, { status: 200 });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; gid: string }> }) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const callerEmail = (await auth())?.user?.email;
  if (!callerEmail) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { id, gid } = await params;
  const access = await applicationAccess(callerEmail, id);
  if (!access) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!hasAtLeastRole(access.role, "editor")) return forbidden();
  const owner = access.owner;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const force = body?.force === true; // explicit Regenerate; bypasses reuse

  const g = await getGuarantee(owner, gid);
  if (!g || g.application_id !== id) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const app = await getApplication(owner, id);
  if (!app?.app_url) return NextResponse.json({ error: "no_deployment", message: "This system has no deployment URL to check against. Add one in the system settings." }, { status: 400 });

  // REUSE-FIRST: a valid prepared plan already exists for this claim + deployment, so return it unchanged
  // instead of re-synthesizing. This is what makes the prepared plan stable across refresh and repeated clicks.
  if (!force) {
    const live = await findLivePendingPlanForClaim(owner, app.app_url, g.title, gid);
    if (live && planHash(live.plan) === live.planHash) return planResponse(live, true);
  }

  // Pass the SYSTEM, not just its URL. The crawl cannot sign in, so without the maker's product context the
  // planner only ever sees this deployment's logged-out pages and has to build signed-in flows out of them.
  const s = await synthesizeClaim(app.app_url, g.title, { owner, applicationId: id });
  if ("error" in s) return NextResponse.json({ error: s.error, message: s.message }, { status: s.status });

  const resolution = await resolveCoverage(app.app_url, g.title, s.synth, s.pages, { rolesAvailable: await systemRoles(owner, id) });

  // Not provable, even after the bounded correction loop: no plan to approve. Return what is missing and a
  // repair prompt so the author can sharpen the guarantee, exactly as /v1 does for a paid caller.
  if (!resolution.readyToLaunch) {
    return NextResponse.json({
      ready: false,
      requirements: resolution.plan.requirements.map((r) => r.text),
      blocked_reason: resolution.blockedReason,
      remaining_obligations: resolution.remainingObligations,
      repair_prompt: repairPrompt(g.title, { claim: resolution.claimAfter, execution: resolution.executionAfter, readyToLaunch: false }),
    }, { status: 200 });
  }

  // Provable: mint the immutable reviewed plan the human will approve. The approve route copies its content
  // onto the guarantee, so the durable approved plan is independent of this row's TTL.
  const discoveryHash = createHash("sha256").update(JSON.stringify(s.pages ?? [])).digest("hex").slice(0, 32);
  const reviewed = await mintReviewedPlan({
    // This plan DEFINES this guarantee. Recorded now, so nothing downstream has to infer it from the
    // claim text and the URL happening to match.
    guaranteeId: gid,
    owner, deploymentUrl: app.app_url, claim: g.title, plan: resolution.plan, discoveryHash,
    coverage: { claim_after: resolution.claimAfter, execution_after: resolution.executionAfter, ready: true },
    ttlMs: TTL_MS, nowMs: Date.now(),
  });
  if (!reviewed) return NextResponse.json({ error: "unavailable", message: "Could not prepare the reviewed plan." }, { status: 503 });

  // Regenerating an APPROVED guarantee is a truthful review event: the current approved plan is being replaced,
  // so hold the guarantee in review_required until the human approves the new plan (its approved content is
  // preserved until then). A draft/review_required guarantee is unaffected.
  if (force && g.plan_state === "ok") await setGuaranteePlanReview(owner, gid);

  return NextResponse.json({
    ready: true,
    requirements: resolution.plan.requirements.map((r) => r.text),
    flows: resolution.plan.flows.map((f) => ({ name: f.name, goal: f.goal, steps: f.steps.length })),
    reviewed_plan_id: reviewed.id,
    reviewed_plan_expires_at: reviewed.expiresAt,
    reused: false,
  }, { status: 200 });
}
