// POST /api/v/org/requests — owner/admin approves or rejects a domain-access join request.
// action: approve | reject. Org resolved server-side from the caller; the request is org-scoped.
// Approval activates an org membership at the clamped safe role; rejection grants nothing.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { decideOrganizationJoinRequest } from "@/lib/v-organization";

export const runtime = "nodejs";

const status = (e: string) =>
  e === "forbidden" ? 403 : e === "no_organization" || e === "not_found" ? 404 : e === "not_pending" ? 409 : 500;

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const requestId = String(body?.requestId ?? "");
  if (body?.action !== "approve" && body?.action !== "reject") return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  const res = await decideOrganizationJoinRequest(email, requestId, body.action);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: status(res.error) });
  return NextResponse.json({ ok: true });
}
