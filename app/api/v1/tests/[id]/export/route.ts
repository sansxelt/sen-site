// GET /api/v1/tests/[id]/export?format=json|csv — API-key export of a completed
// test owned by the key's account. Same safe-field builder as the session route.

import { apiAuth } from "../../../_auth";
import { exportResponse } from "@/lib/v-export";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiAuth(req);
  if (!a) return Response.json({ error: "invalid_api_key" }, { status: 401 });
  const { id } = await params;
  const sp = new URL(req.url).searchParams;
  const fmt = sp.get("format") ?? "json";
  const tier = (sp.get("tier") ?? "standard") as "summary" | "standard" | "scale";
  return exportResponse(id, a.userId, fmt, "api", tier);
}
