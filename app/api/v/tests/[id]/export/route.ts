// GET /api/v/tests/[id]/export?format=json|csv — owner (session) export of a
// completed test's preference data. exportResponse enforces ownership + safe fields.

import { auth } from "@/auth";
import { exportResponse } from "@/lib/v-export";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return Response.json({ error: "signin_required" }, { status: 401 });
  const { id } = await params;
  const sp = new URL(req.url).searchParams;
  const fmt = sp.get("format") ?? "json";
  const tier = (sp.get("tier") ?? "standard") as "summary" | "standard" | "scale";
  return exportResponse(id, email, fmt, "owner", tier);
}
