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

  const g = await createGuarantee(access.owner, { applicationId: id, title, scope: scope || null });
  if (!g) return NextResponse.json({ error: "create_failed", message: "Could not define the guarantee. Confirm the system exists and migration 19 is applied." }, { status: 400 });
  return NextResponse.json({ guarantee: { id: g.id, title: g.title, scope: g.scope, plan_state: g.plan_state } }, { status: 201 });
}
