// Update / disable a collection link (owner only — enforced in the lib by user_id).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateCollectionLink } from "@/lib/v-collection-links";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const r = await updateCollectionLink(email, id, { label: typeof body?.label === "string" ? body.label : undefined, isActive: typeof body?.isActive === "boolean" ? body.isActive : undefined });
  return NextResponse.json({ ok: r.ok });
}
