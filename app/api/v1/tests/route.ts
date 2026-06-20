// POST /api/v1/tests — create + launch a test via the public API.
// Auth: X-Api-Key (or Authorization: Bearer). Options are image URLs or text.

import { NextResponse } from "next/server";
import { apiAuth } from "../_auth";
import { createTest, setTestActive, getPlan, countActiveTestsThisMonth, deleteTest } from "@/lib/v-db";
import { hold } from "@/lib/v-credits";
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

  const used = await countActiveTestsThisMonth(userId);
  if (used >= ent.activeTestsPerMonth) {
    return NextResponse.json({ error: "plan_limit", limit: ent.activeTestsPerMonth, plan: ent.plan }, { status: 403 });
  }

  const id = await createTest({ userId, title, category, audience, votesTarget: votes, options: opts });
  if (!id) return NextResponse.json({ error: "create_failed" }, { status: 500 });

  const ok = await hold(userId, id, votes);
  if (!ok) {
    await deleteTest(id);
    return NextResponse.json({ error: "insufficient_credits", needed: votes }, { status: 402 });
  }

  await setTestActive(id, votes);
  return NextResponse.json({ id, status: "active", votes, credits_charged: votes });
}
