import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { revokeApiKey } from "@/lib/v-api-keys";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { id } = await params;
  await revokeApiKey(email, id);
  return NextResponse.json({ ok: true });
}
