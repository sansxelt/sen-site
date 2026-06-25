// POST /api/v/org/create — create the caller's organization (account layer). The caller
// becomes the org owner. Workspace-only users are never forced into an org.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createOrganization } from "@/lib/v-organization";

export const runtime = "nodejs";

const status = (e: string) => (e === "already_exists" ? 409 : e === "name_required" ? 400 : e === "unavailable" ? 503 : 500);

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const res = await createOrganization(email, typeof body?.name === "string" ? body.name : "");
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: status(res.error) });
  return NextResponse.json({ ok: true, id: res.organization.id });
}
