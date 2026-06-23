// POST /api/v/sandbox — create a sandbox evaluation for the SIGNED-IN owner (the
// in-app sandbox console). Same behavior as the API-key sandbox path: created
// directly, 0 credits, 0 quota, is_sandbox=true, excluded from analytics. Gated by
// the same API access (Scale) as the public API so production rules are unchanged.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPlan } from "@/lib/v-db";
import { apiAccessAllowed } from "@/lib/v-entitlements";
import { createSandboxEvaluation } from "@/lib/v-sandbox";
import { buildDecisionPackage } from "@/lib/v-decision-package";

export const runtime = "nodejs";

const CATS = new Set(["thumbnail", "ad", "logo", "game_icon", "app_icon", "ui", "product_image", "landing", "ai_image", "brand_name", "hook", "other"]);

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  if (!apiAccessAllowed(await getPlan(email), email)) return NextResponse.json({ error: "plan_required" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const title = typeof body?.title === "string" ? body.title.slice(0, 140) : "";
  const category = CATS.has(body?.category) ? body.category : "landing";
  const options = (Array.isArray(body?.options) ? body.options : [])
    .slice(0, 6)
    .map((o: { text?: string; label?: string; image_url?: string }) => ({
      text: typeof o?.text === "string" ? o.text.slice(0, 120) : typeof o?.label === "string" ? o.label.slice(0, 120) : undefined,
      asset: typeof o?.image_url === "string" ? o.image_url : undefined,
    }))
    .filter((o: { text?: string; asset?: string }) => o.text || o.asset);

  const created = await createSandboxEvaluation(email, { title, category, audience: "general", options });
  if (!created) return NextResponse.json({ error: "create_failed" }, { status: 500 });
  const decision_package = await buildDecisionPackage(created.id, "scale");
  return NextResponse.json({ id: created.id, status: "complete", mode: "sandbox", credits_charged: 0, created_at: new Date().toISOString(), decision_package });
}
