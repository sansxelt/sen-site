// POST /api/v/checks/[id]/share — turn a completed check's public share link on/off.
// Session-authenticated and owner-scoped (setCheckShare only touches the caller's own
// row). Body: { enabled: boolean }. Returns { enabled, url } — url is the public
// /r/c/<token> link while enabled, and null once disabled.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { setCheckShare } from "@/lib/v-checks";

export const runtime = "nodejs";

// Canonical base, matching the hardcoded convention in lib/og-meta.ts + lib/email.ts.
function shareUrl(token: string): string {
  return `https://vraelis.com/r/c/${token}`;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const enabled = body?.enabled === true;

  const r = await setCheckShare(email, id, enabled);
  if (!r.ok) return NextResponse.json({ error: "share_failed" }, { status: 400 });
  return NextResponse.json({ enabled: r.enabled, url: r.enabled && r.token ? shareUrl(r.token) : null });
}
