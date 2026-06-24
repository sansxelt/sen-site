// POST /api/v/workspace/members/[id]/resend — re-send a PENDING workspace invite
// email (owner/admin only). Returns the delivery status.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resendWorkspaceInvite } from "@/lib/v-workspace";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { id } = await params;
  const res = await resendWorkspaceInvite(email, id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.error === "forbidden" ? 403 : 400 });
  return NextResponse.json({ ok: true, email: res.email ?? "not_configured" });
}
