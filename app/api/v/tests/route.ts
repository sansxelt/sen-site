// POST /api/v/tests — create a test and launch it (escrow credits). MVP combines
// create + launch in one call. Images arrive as resized data URLs (Storage later).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureProfile, createTest, setTestActive, getPlan, countActiveTestsThisMonth } from "@/lib/v-db";
import { ensureSignupGrant, hold } from "@/lib/v-credits";
import { entitlements, MIN_OPTIONS, MIN_VOTES } from "@/lib/v-entitlements";

export const runtime = "nodejs";
export const maxDuration = 30;

const CATS = new Set(["thumbnail", "ad", "logo", "game_icon", "app_icon", "ui", "product_image", "landing", "ai_image", "brand_name", "hook", "other"]);
const AUDS = new Set(["general", "gamers", "creators", "designers", "gen_z", "shoppers", "entrepreneurs"]);

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
  const votesTarget = Math.max(MIN_VOTES, Math.min(1000, parseInt(body?.votesTarget, 10) || 0));
  const rawOptions = Array.isArray(body?.options) ? body.options : [];

  const ent = entitlements(await getPlan(email));
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

  const used = await countActiveTestsThisMonth(email);
  if (used >= ent.activeTestsPerMonth) {
    return NextResponse.json({ error: "plan_limit", limit: ent.activeTestsPerMonth, plan: ent.plan }, { status: 403 });
  }

  const id = await createTest({ userId: email, title, context, category, audience, votesTarget, options: opts });
  if (!id) return NextResponse.json({ error: "create_failed" }, { status: 500 });

  const ok = await hold(email, id, votesTarget);
  if (!ok) return NextResponse.json({ error: "insufficient_credits", needed: votesTarget }, { status: 402 });

  await setTestActive(id, votesTarget);
  return NextResponse.json({ id, status: "active" });
}
