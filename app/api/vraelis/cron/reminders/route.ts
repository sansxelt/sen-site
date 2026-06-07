// Daily appointment-reminder sweep. Texts each lead whose confirmed booking
// starts within the next 24h (once). Vercel Cron hits this; CRON_SECRET-gated.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getBookingsDueReminder, markBookingReminded, slotLabel } from "@/lib/vraelis-booking";
import { getWorkspaceContact } from "@/lib/vraelis-db";
import { sendSms, isTwilioConfigured } from "@/lib/vraelis-sms";
import { captureError } from "@/lib/vraelis-monitor";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!isTwilioConfigured()) {
    return NextResponse.json({ ok: true, skipped: "twilio_not_configured" });
  }

  const due = await getBookingsDueReminder(24);
  const sentIds: string[] = [];
  // Cache twilio_number per owner to avoid repeat lookups.
  const fromByOwner = new Map<string, string | undefined>();

  for (const b of due) {
    try {
      if (!b.contact_phone) continue;
      if (!fromByOwner.has(b.owner_email)) {
        const c = await getWorkspaceContact(b.owner_email);
        fromByOwner.set(b.owner_email, c?.twilio_number ?? undefined);
      }
      const ok = await sendSms(
        b.contact_phone,
        `Reminder: your appointment is ${slotLabel(b.slot)}. Reply here if you need to reschedule.`,
        fromByOwner.get(b.owner_email),
      );
      if (ok) sentIds.push(b.id);
    } catch (e) {
      captureError("reminders", e, { booking: b.id });
    }
  }
  await markBookingReminded(sentIds);
  return NextResponse.json({ ok: true, due: due.length, reminded: sentIds.length });
}
