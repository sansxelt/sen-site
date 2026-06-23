// GET /api/v1/tests/[id] — evaluation status + results (once complete). Auth: API key.

import { apiAuth } from "../../_auth";
import { apiError } from "../../_lib";
import { getTestWithOptions, getReport } from "@/lib/v-db";
import { buildDecisionPackage } from "@/lib/v-decision-package";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiAuth(req, "tests:read");
  if (!a.ok) return a.response;
  const { id } = await params;
  const data = await getTestWithOptions(id);
  if (!data) return apiError("not_found", "No evaluation with that id.", 404);
  if (data.test.user_id !== a.userId) return apiError("forbidden", "This evaluation belongs to another account.", 403);

  const { test } = data;
  let results = null;
  if (test.status === "complete") {
    const rep = await getReport(id);
    results = rep?.results ?? null;
  }
  // Additive: the full Decision Package for the (owned) evaluation. Old clients
  // that read `results` are unaffected.
  const decision_package = await buildDecisionPackage(id, "scale");
  return Response.json({
    id: test.id, status: test.status,
    votes_valid: test.votes_valid, votes_target: test.votes_target,
    results,
    decision_package,
  });
}
