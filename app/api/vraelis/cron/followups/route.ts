// Daily auto follow-up sweep. For each workspace, finds quiet leads (we
// messaged last, no reply in 24h+, has an email, under the cap) and sends
// an AI-written nudge. Vercel Cron hits this (vercel.json); secured by
// CRON_SECRET.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  bumpFollowup,
  getAllWorkspaces,
  getFollowupCandidates,
  getLeadWithMessages,
  getLastMessage,
  addMessage,
} from "@/lib/vraelis-db";
import { generateFollowupMessage, type ConvoTurn } from "@/lib/vraelis-ai";
import { sendLeadReply } from "@/lib/vraelis-email";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const workspaces = await getAllWorkspaces();
  let sent = 0;

  for (const ws of workspaces) {
    const candidates = await getFollowupCandidates(ws.owner_email, cutoff);
    for (const lead of candidates) {
      if (!lead.contact_email) continue;
      // Only nudge if WE messaged last (the lead has gone quiet).
      const last = await getLastMessage(lead.id);
      if (!last || last.role !== "agent") continue;

      const data = await getLeadWithMessages(ws.owner_email, lead.id);
      const history: ConvoTurn[] = (data?.messages ?? []).map((m) => ({ role: m.role, body: m.body }));

      const text = await generateFollowupMessage({
        businessName: ws.business_name ?? "",
        businessDescription: ws.business_description ?? "",
        history,
        attempt: lead.followups_sent + 1,
      });

      const r = await sendLeadReply({
        to: lead.contact_email,
        businessName: ws.business_name ?? "Vraelis",
        replyText: text,
        replyTo: ws.owner_email,
      });
      await addMessage({ leadId: lead.id, role: "agent", body: text, channel: r.sent ? "email" : "note", delivered: r.sent });
      await bumpFollowup(lead.id, lead.followups_sent);
      if (r.sent) sent += 1;
    }
  }

  return NextResponse.json({ ok: true, workspaces: workspaces.length, nudgesSent: sent });
}
