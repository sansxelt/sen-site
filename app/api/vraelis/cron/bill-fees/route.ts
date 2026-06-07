// Monthly revenue-cut billing sweep. Vercel Cron hits this (schedule in
// vercel.json). For every workspace with unbilled won-deal revenue, it
// raises a Stripe invoice the customer pays.
//
// Auth: Vercel sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET
// is set in the project env — we require it so the endpoint can't be
// triggered by anyone.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAllWorkspaces } from "@/lib/vraelis-db";
import { billWorkspaceFee } from "@/lib/vraelis-billing";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const workspaces = await getAllWorkspaces();
  const billed: { owner: string; amountCents: number; deals: number }[] = [];
  for (const ws of workspaces) {
    const r = await billWorkspaceFee(ws);
    if (r.billed) billed.push({ owner: ws.owner_email, amountCents: r.amountCents, deals: r.deals });
  }
  return NextResponse.json({ ok: true, workspaces: workspaces.length, invoiced: billed.length, billed });
}
