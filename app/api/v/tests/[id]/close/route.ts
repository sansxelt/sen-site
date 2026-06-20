// POST /api/v/tests/[id]/close — buyer closes a test early; reports current
// results and refunds the unfilled credits. Lets the loop finish with few voters.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTestWithOptions, completeTest } from "@/lib/v-db";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { id } = await params;
  const data = await getTestWithOptions(id);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (data.test.user_id !== email.trim().toLowerCase()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (data.test.status !== "active") return NextResponse.json({ error: "not_active" }, { status: 400 });
  await completeTest(id);
  return NextResponse.json({ ok: true });
}
