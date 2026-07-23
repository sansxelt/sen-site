// Approve a guarantee's derived proof plan ONCE. SESSION-ONLY (an app route; an agent key can never reach it),
// which is the separation of duties milestone 1 requires: a human approves the definition, an agent never can.
//
// Server-authoritative: the route approves the guarantee's CURRENT live prepared plan (looked up by claim +
// deployment), not a plan id the client asserts. The client passes the id it reviewed so the route can refuse
// (409) if a newer plan was prepared since, so a human always approves exactly the plan they saw. On success it
// copies the plan content onto the guarantee (durable, deployment independent) and flips plan_state to 'ok'.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { applicationAccess } from "@/lib/preflight/team-access";
import { hasAtLeastRole } from "@/lib/v-workspace";
import { getApplication } from "@/lib/v-applications";
import { getGuarantee, approveGuaranteePlan } from "@/lib/preflight/guarantees-db";
import { findLivePendingPlanForClaim } from "@/lib/preflight/reviewed-plan-db";
import { planHash, planRoleRefs } from "@/lib/preflight/reviewed-plan";

export const runtime = "nodejs";

const forbidden = () => NextResponse.json({ error: "forbidden", message: "You have view-only access to this system." }, { status: 403 });

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
  const reviewedPlanId = typeof body?.reviewed_plan_id === "string" ? body.reviewed_plan_id.trim() : "";

  const g = await getGuarantee(owner, gid);
  if (!g || g.application_id !== id) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const app = await getApplication(owner, id);
  if (!app?.app_url) return NextResponse.json({ error: "no_deployment", message: "This system has no deployment URL." }, { status: 400 });

  // The guarantee's CURRENT prepared plan (server-authoritative), keyed by its claim + deployment.
  const live = await findLivePendingPlanForClaim(owner, app.app_url, g.title);
  if (!live) return NextResponse.json({ error: "no_prepared_plan", message: "No prepared plan to approve. Derive the proof plan first." }, { status: 409 });
  // Integrity: the stored plan must still hash to its stored hash, or nothing about it can be trusted.
  if (planHash(live.plan) !== live.planHash) {
    return NextResponse.json({ error: "reviewed_plan_integrity_error", message: "This prepared plan failed its integrity check. Derive the plan again." }, { status: 409 });
  }
  // Approve exactly the plan the human reviewed: a newer plan prepared since (a concurrent Regenerate) must be
  // reviewed before it can be approved.
  if (reviewedPlanId && reviewedPlanId !== live.id) {
    return NextResponse.json({ error: "reviewed_plan_superseded", message: "A newer plan was prepared for this guarantee. Review it, then approve." }, { status: 409 });
  }

  const updated = await approveGuaranteePlan(owner, gid, {
    claim: live.claim,
    plan: live.plan,
    planHash: live.planHash,
    roleRefs: planRoleRefs(live.plan),
    approver: callerEmail.toLowerCase(),
  });
  if (!updated) return NextResponse.json({ error: "approve_failed", message: "Could not record the approval." }, { status: 400 });

  return NextResponse.json({
    guarantee: { id: updated.id, plan_state: updated.plan_state, plan_version: updated.plan_version, plan_approved_at: updated.plan_approved_at, plan_approved_by: updated.plan_approved_by },
  }, { status: 200 });
}
