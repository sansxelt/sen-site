// Lightweight "who am I + what plan" lookup for client components
// (e.g. the pricing page marks the plan you already own).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOrCreateWorkspace } from "@/lib/vraelis-db";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ signedIn: false, plan: null, cycle: null });
  const ws = await getOrCreateWorkspace(email);
  return NextResponse.json({
    signedIn: true,
    plan: ws?.plan ?? null,
    cycle: ws?.plan_cycle ?? null,
    // planStatus lets the pricing page treat a lapsed plan as not-currently-owned
    // (so the user can re-buy their old tier instead of hitting a blocked tile).
    planStatus: ws?.plan_status ?? null,
    planProvider: ws?.plan_provider ?? null,
  });
}
