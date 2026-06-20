// POST /api/v1/tests — create + launch a test via the public API.
// Auth: X-Api-Key (or Authorization: Bearer). Options are image URLs or text.

import { NextResponse } from "next/server";
import { apiAuth } from "../_auth";
import { getPlan, launchTest } from "@/lib/v-db";
import { entitlements, MIN_OPTIONS, MIN_VOTES } from "@/lib/v-entitlements";

export const runtime = "nodejs";
export const maxDuration = 30;

const CATS = new Set(["thumbnail", "ad", "logo", "game_icon", "app_icon", "ui", "product_image", "landing", "ai_image", "brand_name", "hook", "other"]);
const AUDS = new Set(["general", "gamers", "creators", "designers", "gen_z", "shoppers", "entrepreneurs"]);
const MAX_ASSET_CHARS = 600_000;

export async function POST(req: Request) {
  const auth = await apiAuth(req);
  if (!auth) return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });
  const userId = auth.userId;

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title || "").trim().slice(0, 140);
  const category = CATS.has(body?.category) ? body.category : "other";
  const audience = AUDS.has(body?.audience) ? body.audience : "general";
  const rawOptions = Array.isArray(body?.options) ? body.options : [];

  const ent = entitlements(await getPlan(userId));
  const votes = Math.max(MIN_VOTES, Math.min(ent.maxVotes, parseInt(body?.votes, 10) || 0));
  if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });

  const opts = rawOptions
    .slice(0, ent.maxOptions)
    .map((o: { image_url?: string; text?: string }) => ({
      asset: typeof o?.image_url === "string" ? o.image_url : undefined,
      label: typeof o?.text === "string" ? o.text.slice(0, 120) : undefined,
    }))
    .filter((o: { asset?: string; label?: string }) => o.asset || o.label);

  if (opts.length < MIN_OPTIONS) return NextResponse.json({ error: "need_2_options" }, { status: 400 });
  if (opts.some((o: { asset?: string }) => o.asset && o.asset.length > MAX_ASSET_CHARS)) {
    return NextResponse.json({ error: "image_too_large" }, { status: 413 });
  }

  // Atomic: quota + balance + create + hold + activate in one transaction.
  const r = await launchTest({ userId, title, category, audience, votesTarget: votes, options: opts, activeLimit: ent.activeTestsPerMonth, maxOptions: ent.maxOptions });
  if (r.status === "plan_limit") return NextResponse.json({ error: "plan_limit", limit: r.limit, plan: ent.plan }, { status: 403 });
  if (r.status === "insufficient_credits") return NextResponse.json({ error: "insufficient_credits", needed: r.needed }, { status: 402 });
  if (r.status !== "ok") return NextResponse.json({ error: "create_failed" }, { status: 500 });
  return NextResponse.json({ id: r.id, status: "active", votes, credits_charged: votes });
}
