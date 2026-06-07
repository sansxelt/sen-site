// Self-serve booking — no external calendar. Slots are generated from
// simple defaults (next ~10 weekdays, 9:00–16:30, 30-min) minus what's
// already taken. A booking writes a row, sets the lead to "booked", and
// triggers confirmation emails (caller).

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { getWorkspaceCalendar, setBookingEvent } from "./vraelis-db";
import { createEvent, getBusy } from "./vraelis-calendar";

export type Slot = { iso: string; label: string };
export type BusyRange = { start: string; end: string };

const OPEN_HOUR = 9; // 9:00
const CLOSE_HALF = 16 * 2 + 1; // last slot 16:30 (half-hour index)
const DAYS_AHEAD = 14;
const MAX_SLOTS = 60;

// Generate upcoming weekday half-hour slots (server time). Excludes slots
// already taken AND any that overlap a Google Calendar busy range.
export function generateSlots(taken: Set<string>, busy: BusyRange[] = []): Slot[] {
  const slots: Slot[] = [];
  const now = Date.now();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const busyMs = busy.map((b) => ({ s: new Date(b.start).getTime(), e: new Date(b.end).getTime() }));

  for (let d = 0; d < DAYS_AHEAD && slots.length < MAX_SLOTS; d++) {
    const day = new Date(start);
    day.setDate(start.getDate() + d);
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends
    for (let half = OPEN_HOUR * 2; half <= CLOSE_HALF; half++) {
      const slot = new Date(day);
      slot.setHours(Math.floor(half / 2), (half % 2) * 30, 0, 0);
      const slotMs = slot.getTime();
      if (slotMs < now + 60 * 60 * 1000) continue; // at least 1h out
      const iso = slot.toISOString();
      if (taken.has(iso)) continue;
      if (busyMs.some((b) => slotMs >= b.s && slotMs < b.e)) continue; // calendar conflict
      void slotMs;
      slots.push({
        iso,
        label: slot.toLocaleString("en-US", {
          weekday: "short", month: "short", day: "numeric",
          hour: "numeric", minute: "2-digit",
        }),
      });
      if (slots.length >= MAX_SLOTS) break;
    }
  }
  return slots;
}

export async function getTakenSlots(ownerEmail: string): Promise<Set<string>> {
  if (!isDatabaseConfigured()) return new Set();
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("vraelis_bookings" as never)
    .select("slot")
    .eq("owner_email", ownerEmail.trim().toLowerCase())
    .eq("status", "confirmed")
    .gte("slot", new Date().toISOString());
  return new Set(((data as unknown as { slot: string }[]) ?? []).map((r) => new Date(r.slot).toISOString()));
}

export async function createBooking(input: {
  ownerEmail: string;
  leadId?: string | null;
  slotIso: string;
  name?: string;
  contactEmail?: string;
  contactPhone?: string;
  note?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!isDatabaseConfigured()) return { ok: false, reason: "not_configured" };
  const supabase = getSupabaseAdminClient();
  const owner = input.ownerEmail.trim().toLowerCase();
  const iso = new Date(input.slotIso).toISOString();
  if (Number.isNaN(new Date(iso).getTime())) return { ok: false, reason: "bad_slot" };

  // Conflict check.
  const taken = await getTakenSlots(owner);
  if (taken.has(iso)) return { ok: false, reason: "slot_taken" };

  const { data, error } = await supabase
    .from("vraelis_bookings" as never)
    .insert({
      owner_email: owner,
      lead_id: input.leadId ?? null,
      slot: iso,
      name: input.name?.trim() || null,
      contact_email: input.contactEmail?.trim().toLowerCase() || null,
      contact_phone: input.contactPhone?.trim() || null,
      note: input.note?.trim() || null,
      status: "confirmed",
    } as never)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("createBooking failed:", error);
    return { ok: false, reason: "insert_failed" };
  }

  // Mirror to Google Calendar if connected (fail-soft — never blocks booking).
  const bookingId = (data as unknown as { id: string } | null)?.id;
  if (bookingId) {
    try {
      const cal = await getWorkspaceCalendar(owner);
      if (cal?.gcal_connected && cal.gcal_refresh_token) {
        const startD = new Date(iso);
        const endD = new Date(startD.getTime() + 30 * 60 * 1000);
        const eventId = await createEvent(cal.gcal_refresh_token, cal.gcal_calendar_id || "primary", {
          summary: `${input.name || input.contactEmail || "Booking"} — via Vraelis`,
          description: input.note || "",
          startIso: startD.toISOString(),
          endIso: endD.toISOString(),
          attendeeEmail: input.contactEmail || null,
        });
        if (eventId) await setBookingEvent(bookingId, eventId);
      }
    } catch {
      /* fail-soft */
    }
  }
  return { ok: true };
}

// Google Calendar busy ranges for the booking window (fail-soft → []).
export async function getCalendarBusy(ownerEmail: string): Promise<BusyRange[]> {
  try {
    const cal = await getWorkspaceCalendar(ownerEmail);
    if (!cal?.gcal_connected || !cal.gcal_refresh_token) return [];
    const now = new Date();
    const until = new Date(now.getTime() + DAYS_AHEAD * 24 * 3600 * 1000);
    return await getBusy(cal.gcal_refresh_token, cal.gcal_calendar_id || "primary", now.toISOString(), until.toISOString());
  } catch {
    return [];
  }
}

export type Booking = {
  id: string;
  slot: string;
  name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  lead_id: string | null;
};

export async function listUpcomingBookings(ownerEmail: string): Promise<Booking[]> {
  if (!isDatabaseConfigured()) return [];
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("vraelis_bookings" as never)
    .select("id, slot, name, contact_email, contact_phone, lead_id")
    .eq("owner_email", ownerEmail.trim().toLowerCase())
    .eq("status", "confirmed")
    .gte("slot", new Date().toISOString())
    .order("slot", { ascending: true })
    .limit(50);
  return (data as unknown as Booking[]) ?? [];
}

// Confirmed bookings starting within the next `hours` that haven't been
// reminded yet — drives the SMS reminder cron. Fail-soft if the `reminded`
// column isn't migrated.
export type DueBooking = { id: string; owner_email: string; slot: string; name: string | null; contact_phone: string | null };
export async function getBookingsDueReminder(hours: number): Promise<DueBooking[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const supabase = getSupabaseAdminClient();
    const now = new Date();
    const until = new Date(now.getTime() + hours * 3600 * 1000);
    const { data, error } = await supabase
      .from("vraelis_bookings" as never)
      .select("id, owner_email, slot, name, contact_phone")
      .eq("status", "confirmed")
      .eq("reminded", false)
      .gte("slot", now.toISOString())
      .lte("slot", until.toISOString())
      .limit(200);
    if (error) return [];
    return ((data as unknown as DueBooking[]) ?? []).filter((b) => b.contact_phone);
  } catch {
    return [];
  }
}

export async function markBookingReminded(ids: string[]): Promise<void> {
  if (ids.length === 0 || !isDatabaseConfigured()) return;
  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from("vraelis_bookings" as never).update({ reminded: true } as never).in("id", ids);
  } catch {
    /* fail-soft */
  }
}

export function slotLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
