// POST /api/v/tests — create a test and launch it (escrow credits). MVP combines
// create + launch in one call. Images arrive as resized data URLs (Storage later).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureProfile, getPlan, launchTest } from "@/lib/v-db";
import { ensureSignupGrant } from "@/lib/v-credits";
import { entitlements, MIN_OPTIONS, MIN_VOTES } from "@/lib/v-entitlements";

export const runtime = "nodejs";
export const maxDuration = 30;

const CATS = new Set(["thumbnail", "ad", "logo", "game_icon", "app_icon", "ui", "product_image", "landing", "ai_image", "brand_name", "hook", "other"]);
const AUDS = new Set(["general", "gamers", "creators", "designers", "gen_z", "shoppers", "entrepreneurs"]);
const MAX_ASSET_CHARS = 600_000; // ~450KB encoded — bounds base64 data-URL bloat

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  await ensureProfile(email, session.user?.name ?? undefined);
  await ensureSignupGrant(email);

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title || "").trim().slice(0, 140);
  const context = String(body?.context || "").trim().slice(0, 1000) || undefined;
  const category = CATS.has(body?.category) ? body.category : "other";
  const audience = AUDS.has(body?.audience) ? body.audience : "general";
  const rawOptions = Array.isArray(body?.options) ? body.options : [];

  const ent = entitlements(await getPlan(email));
  const votesTarget = Math.max(MIN_VOTES, Math.min(ent.maxVotes, parseInt(body?.votesTarget, 10) || 0));
  if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });

  const opts = rawOptions
    .slice(0, ent.maxOptions)
    .map((o: { asset?: string; label?: string }) => ({
      asset: typeof o?.asset === "string" ? o.asset : undefined,
      label: typeof o?.label === "string" ? o.label.slice(0, 120) : undefined,
    }))
    .filter((o: { asset?: string; label?: string }) => o.asset || o.label);

  if (opts.length < MIN_OPTIONS) return NextResponse.json({ error: "need_2_options" }, { status: 400 });
  if (opts.length > ent.maxOptions) return NextResponse.json({ error: "too_many_options", max: ent.maxOptions }, { status: 400 });
  if (opts.some((o: { asset?: string }) => o.asset && o.asset.length > MAX_ASSET_CHARS)) {
    return NextResponse.json({ error: "image_too_large" }, { status: 413 });
  }

  // Atomic: quota + balance + create + hold + activate in one transaction.
  const r = await launchTest({ userId: email, title, context, category, audience, votesTarget, options: opts, activeLimit: ent.activeTestsPerMonth, maxOptions: ent.maxOptions });
  if (r.status === "plan_limit") return NextResponse.json({ error: "plan_limit", limit: r.limit, plan: ent.plan }, { status: 403 });
  if (r.status === "insufficient_credits") return NextResponse.json({ error: "insufficient_credits", needed: r.needed }, { status: 402 });
  if (r.status !== "ok") return NextResponse.json({ error: "create_failed" }, { status: 500 });
  return NextResponse.json({ id: r.id, status: "active" });
}
