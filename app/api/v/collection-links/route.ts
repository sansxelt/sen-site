// Collection links for one of the owner's evaluations. GET ?testId lists them
// (with per-link stats); POST creates one. Ownership enforced in the lib.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createCollectionLink, listCollectionLinks } from "@/lib/v-collection-links";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ links: [] });
  const testId = new URL(req.url).searchParams.get("testId") || "";
  if (!testId) return NextResponse.json({ links: [] });
  return NextResponse.json({ links: await listCollectionLinks(email, testId) });
}

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const testId = String(body?.testId || "");
  const label = String(body?.label || "");
  const source = String(body?.source || "other");
  if (!testId || !label.trim()) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const r = await createCollectionLink(email, testId, label, source);
  if (!r.ok) return NextResponse.json({ error: "create_failed" }, { status: 400 });
  return NextResponse.json({ ok: true, id: r.id });
}
