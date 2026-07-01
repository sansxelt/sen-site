// GET /api/v1/keys/[prefix]/usage — usage for ONE of the caller's own API keys,
// over a recent window (default 30d, ?days= 1..90). Auth: API key. Thin wrapper:
// every read is owner-scoped and no money/anti-abuse logic lives here.

import { apiAuth } from "../../../_auth";
import { apiError } from "../../../_lib";
import { apiKeyUsage } from "@/lib/v-api-usage";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ prefix: string }> }) {
  const a = await apiAuth(req, "credits:read");
  if (!a.ok) return a.response;

  const { prefix } = await params;
  const wanted = (prefix || "").trim();
  if (!/^vr_live_[a-f0-9]{1,64}$/.test(wanted)) return apiError("validation_error", "Invalid key prefix.", 400);

  // Window: default 30d, clamp 1..90 (bounds the scan; matches other v1 reads).
  // Note: an absent/blank/invalid param must default to 30 — Number(null)/Number("")
  // are 0 (finite), so key off the raw string being present + numeric, not isFinite.
  const url = new URL(req.url);
  const rawDays = url.searchParams.get("days");
  const parsedDays = rawDays !== null && rawDays.trim() !== "" ? Number(rawDays) : NaN;
  const days = Number.isFinite(parsedDays) ? Math.min(90, Math.max(1, Math.floor(parsedDays))) : 30;

  // Ownership + key-scoping happen INSIDE apiKeyUsage: it resolves the prefix
  // against THIS owner's keys only. A prefix that isn't the caller's own key
  // (another owner's, or nonexistent) returns not_found — we never read another
  // owner's rows and never confirm a foreign prefix exists.
  const usage = await apiKeyUsage(a.userId, wanted, days);
  if (!usage) return apiError("not_found", "No API key with that prefix on this account.", 404);

  return Response.json(usage);
}
