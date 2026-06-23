// Delete a screening question (owner only — enforced in the lib by user_id).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteScreeningQuestion } from "@/lib/v-screening";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const r = await deleteScreeningQuestion(email, id);
  return NextResponse.json({ ok: r.ok });
}
