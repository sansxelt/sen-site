// POST /api/v1/tests — create + launch a test via the public API.
// Auth: X-Api-Key (or Authorization: Bearer). Options are image URLs or text.

import { apiAuth } from "../_auth";
import { apiError } from "../_lib";
import { getPlan, launchTest } from "@/lib/v-db";
import { entitlements, MIN_OPTIONS, MIN_VOTES } from "@/lib/v-entitlements";
import { assignTestToProject } from "@/lib/v-projects";
import { createSandboxEvaluation } from "@/lib/v-sandbox";

export const runtime = "nodejs";
export const maxDuration = 30;

const CATS = new Set(["thumbnail", "ad", "logo", "game_icon", "app_icon", "ui", "product_image", "landing", "ai_image", "brand_name", "hook", "other"]);
const AUDS = new Set(["general", "gamers", "creators", "designers", "gen_z", "shoppers", "entrepreneurs"]);
const MAX_ASSET_CHARS = 600_000;

// Create an evaluation run. Auth: API key with the tests:write scope.
export async function POST(req: Request) {
  const a = await apiAuth(req, "tests:write");
  if (!a.ok) return a.response;
  const userId = a.userId;

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title || "").trim().slice(0, 140);
  const category = CATS.has(body?.category) ? body.category : "other";
  const audience = AUDS.has(body?.audience) ? body.audience : "general";
  const rawOptions = Array.isArray(body?.options) ? body.options : [];

  const ent = entitlements(await getPlan(userId));
  const votes = Math.max(MIN_VOTES, Math.min(ent.maxVotes, parseInt(body?.votes, 10) || 0));
  const sandbox = body?.sandbox === true || body?.sandbox === "true";
  if (!title && !sandbox) return apiError("validation_error", "A title is required.", 400);

  const opts = rawOptions
    .slice(0, ent.maxOptions)
    .map((o: { image_url?: string; text?: string }) => ({
      asset: typeof o?.image_url === "string" ? o.image_url : undefined,
      label: typeof o?.text === "string" ? o.text.slice(0, 120) : undefined,
    }))
    .filter((o: { asset?: string; label?: string }) => o.asset || o.label);

  // ── Sandbox: test the integration WITHOUT credits, quota, or real judgments.
  // Created directly with a sample decision package; clearly labeled sandbox.
  if (sandbox) {
    const projectId = typeof body?.project_id === "string" && body.project_id ? body.project_id : null;
    const created = await createSandboxEvaluation(userId, { title, category, audience, options: opts });
    if (!created) return apiError("internal_error", "Could not create the sandbox evaluation. Try again.", 500);
    if (projectId) await assignTestToProject(userId, created.id, projectId);
    return Response.json({ id: created.id, status: "complete", sandbox: true, mode: "sandbox", credits_charged: 0, note: "Sandbox evaluation — sample decision package, no credits used. Fetch it with GET /api/v1/tests/" + created.id + " or its export." });
  }

  if (opts.length < MIN_OPTIONS) return apiError("validation_error", `At least ${MIN_OPTIONS} candidate options are required.`, 400);
  if (opts.some((o: { asset?: string }) => o.asset && o.asset.length > MAX_ASSET_CHARS)) {
    return apiError("validation_error", "An image option exceeds the size limit. Use a public image URL.", 413);
  }

  // Atomic: quota + balance + create + hold + activate in one transaction.
  const r = await launchTest({ userId, title, category, audience, votesTarget: votes, options: opts, activeLimit: ent.activeTestsPerMonth, maxOptions: ent.maxOptions });
  if (r.status === "plan_limit") return apiError("forbidden", `Monthly active-evaluation limit (${r.limit}) reached on the ${ent.plan} plan.`, 403);
  if (r.status === "insufficient_credits") return apiError("insufficient_credits", `Not enough credits. This evaluation needs ${r.needed}.`, 402);
  if (r.status !== "ok") return apiError("internal_error", "Could not create the evaluation. Try again.", 500);
  // Optional: API clients may pass project_id to file the run under one of THEIR
  // projects. Old clients omit it (stays unfiled); a foreign id is ignored.
  const projectId = typeof body?.project_id === "string" && body.project_id ? body.project_id : null;
  if (projectId && r.id) await assignTestToProject(userId, r.id, projectId);
  return Response.json({ id: r.id, status: "active", votes, credits_charged: votes });
}
