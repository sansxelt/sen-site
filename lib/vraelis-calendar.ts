// Google Calendar — dependency-free (Google REST over fetch). Everything is
// fail-soft: if calendar isn't configured/connected or a call fails, booking
// works exactly as before.
//
// Setup (one-time, free — no billing):
//   1. Google Cloud Console → new project → enable "Google Calendar API".
//   2. OAuth consent screen (External) → add scopes calendar.events +
//      calendar.readonly → add yourself as a test user (or publish).
//   3. Credentials → OAuth client (Web) → redirect URI:
//      https://vraelis.com/api/vraelis/calendar/callback
//   4. Set env GOOGLE_CALENDAR_CLIENT_ID / GOOGLE_CALENDAR_CLIENT_SECRET.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REDIRECT = "https://vraelis.com/api/vraelis/calendar/callback";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

export function isCalendarConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
}

export function consentUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: (process.env.GOOGLE_CALENDAR_CLIENT_ID || "").trim(),
    redirect_uri: REDIRECT,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: SCOPES,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

// Exchange the one-time auth code for a refresh token.
export async function exchangeCode(code: string): Promise<string | null> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: (process.env.GOOGLE_CALENDAR_CLIENT_ID || "").trim(),
        client_secret: (process.env.GOOGLE_CALENDAR_CLIENT_SECRET || "").trim(),
        redirect_uri: REDIRECT,
        grant_type: "authorization_code",
      }),
    });
    const j = (await res.json()) as { refresh_token?: string };
    return j.refresh_token ?? null;
  } catch {
    return null;
  }
}

async function accessToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: (process.env.GOOGLE_CALENDAR_CLIENT_ID || "").trim(),
        client_secret: (process.env.GOOGLE_CALENDAR_CLIENT_SECRET || "").trim(),
        grant_type: "refresh_token",
      }),
    });
    const j = (await res.json()) as { access_token?: string };
    return j.access_token ?? null;
  } catch {
    return null;
  }
}

// Create a calendar event; returns the event id (or null).
export async function createEvent(
  refreshToken: string,
  calendarId: string,
  ev: { summary: string; description?: string; startIso: string; endIso: string; attendeeEmail?: string | null },
): Promise<string | null> {
  const token = await accessToken(refreshToken);
  if (!token) return null;
  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: ev.summary,
          description: ev.description ?? "",
          start: { dateTime: ev.startIso },
          end: { dateTime: ev.endIso },
          ...(ev.attendeeEmail ? { attendees: [{ email: ev.attendeeEmail }] } : {}),
        }),
      },
    );
    const j = (await res.json()) as { id?: string };
    return j.id ?? null;
  } catch {
    return null;
  }
}

export async function deleteEvent(refreshToken: string, calendarId: string, eventId: string): Promise<void> {
  const token = await accessToken(refreshToken);
  if (!token) return;
  try {
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
    );
  } catch {
    /* fail-soft */
  }
}

// Busy time ranges for conflict prevention.
export async function getBusy(
  refreshToken: string,
  calendarId: string,
  fromIso: string,
  toIso: string,
): Promise<{ start: string; end: string }[]> {
  const token = await accessToken(refreshToken);
  if (!token) return [];
  try {
    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ timeMin: fromIso, timeMax: toIso, items: [{ id: calendarId }] }),
    });
    const j = (await res.json()) as { calendars?: Record<string, { busy?: { start: string; end: string }[] }> };
    return j.calendars?.[calendarId]?.busy ?? [];
  } catch {
    return [];
  }
}
