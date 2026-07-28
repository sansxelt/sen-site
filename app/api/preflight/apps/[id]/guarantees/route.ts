// Guarantee authoring for a connected system. SESSION-AUTHENTICATED app routes (never the /v1 key surface),
// so an agent key cannot define or approve a guarantee. That is the separation of duties milestone 1 requires,
// made structural: these routes are unreachable without a signed-in session.
//
//   POST /api/preflight/apps/[id]/guarantees   { title, scope? }   -> define a guarantee (plan_state 'draft')
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { applicationAccess } from "@/lib/preflight/team-access";
import { hasAtLeastRole } from "@/lib/v-workspace";
import { createGuarantee } from "@/lib/preflight/guarantees-db";

export const runtime = "nodejs";

const forbidden = () => NextResponse.json({ error: "forbidden", message: "You have view-only access to this system." }, { status: 403 });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const callerEmail = (await auth())?.user?.email;
  if (!callerEmail) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { id } = await params;
  const access = await applicationAccess(callerEmail, id);
  if (!access) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!hasAtLeastRole(access.role, "editor")) return forbidden();

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const scope = typeof body?.scope === "string" ? body.scope.trim() : "";
  // A guarantee is a one-sentence business requirement; too short and it cannot describe an outcome.
  if (title.length < 12) {
    return NextResponse.json({ error: "validation_error", message: "A guarantee needs a one-sentence business requirement: what must always be true." }, { status: 400 });
  }

  // THE NUMBER ON THE PRICING CARD, ENFORCED. Plans lead with how many active guarantees they protect,
  // so that figure has to be real: a cap printed and enforced nowhere is exactly the claim this product
  // exists to catch, and the person who would catch it is the customer who bought the tier for it.
  //
  // The message names the current plan and the cap rather than saying "upgrade", because someone who has
  // hit a limit is entitled to know which limit and what it is before deciding what to do about it.
  {
    const { guaranteeCapReached } = await import("@/lib/preflight/entitlements-v1");
    const { getPlanV1State } = await import("@/lib/preflight/entitlements-v1");
    const state = await getPlanV1State(access.owner).catch(() => null);
    const planKey = state?.plan ?? null;
    if (await guaranteeCapReached(access.owner, planKey)) {
      const { planV1, FREE_TIER } = await import("@/lib/preflight/pass-pricing");
      const plan = planKey ? planV1(planKey) : null;
      const cap = plan ? plan.maxGuarantees : FREE_TIER.maxGuarantees;
      return NextResponse.json({
        error: "guarantee_cap_reached",
        message: `Your ${plan ? plan.name : "Free"} plan protects up to ${cap} active guarantee${cap === 1 ? "" : "s"}. Archive one you no longer need, or move to a plan that protects more.`,
        cap, plan: plan ? plan.key : null,
      }, { status: 402 });
    }
  }

  const g = await createGuarantee(access.owner, { applicationId: id, title, scope: scope || null });
  if (!g) return NextResponse.json({ error: "create_failed", message: "Could not define the guarantee. Confirm the system exists and migration 19 is applied." }, { status: 400 });
  return NextResponse.json({ guarantee: { id: g.id, title: g.title, scope: g.scope, plan_state: g.plan_state } }, { status: 201 });
}
