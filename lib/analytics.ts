// Server-side conversion tracking — fires the funnel's money events to BOTH
// Meta (Conversions API) and GA4 (Measurement Protocol) from the server, where
// they actually happen, so ad-blockers / iOS can't drop them. Client pageviews
// + browser-observable events go through the Pixel/gtag base script instead.
//
// Everything here is:
//   - ENV-GATED: no-ops entirely if the relevant IDs/tokens aren't set, so it's
//     dormant until you add them in Vercel (nothing to break before then).
//   - FAIL-SOFT: every send is best-effort and swallowed — a tracking failure
//     must NEVER break a signup, lead, booking, or payment.
//   - PII-SAFE: Meta requires email/phone to be SHA-256 hashed; we hash here and
//     never send raw PII. GA4 gets only a pseudonymous client/user id.
//
// Env vars (all optional):
//   META_PIXEL_ID, META_CAPI_TOKEN         — Meta Conversions API
//   NEXT_PUBLIC_META_PIXEL_ID              — client Pixel (same id, public)
//   GA4_MEASUREMENT_ID, GA4_API_SECRET     — GA4 Measurement Protocol
//   NEXT_PUBLIC_GA4_MEASUREMENT_ID         — client gtag (same id, public)

import { createHash, randomUUID } from "node:crypto";

// Our internal event names → (Meta standard event, GA4 event name).
export type FunnelEvent =
  | "signup"
  | "onboarding_complete"
  | "lead"
  | "booking"
  | "payment";

const EVENT_MAP: Record<FunnelEvent, { meta: string; ga4: string }> = {
  signup:              { meta: "CompleteRegistration", ga4: "sign_up" },
  onboarding_complete: { meta: "OnboardingComplete",   ga4: "onboarding_complete" },
  lead:                { meta: "Lead",                 ga4: "generate_lead" },
  booking:             { meta: "Schedule",             ga4: "booking" },
  payment:             { meta: "Purchase",             ga4: "purchase" },
};

function sha256(v: string): string {
  return createHash("sha256").update(v.trim().toLowerCase()).digest("hex");
}

type TrackInput = {
  email?: string | null;       // hashed for Meta; never sent raw
  phone?: string | null;       // hashed for Meta; never sent raw
  value?: number;              // money value (e.g. payment amount in dollars)
  currency?: string;           // default USD
  // A stable key (email or workspace owner) used to JOIN events for one user.
  // It is SHA-256 hashed before going to GA4 (never sent raw); no key → a random
  // uuid (event still records, just not joined across the funnel).
  clientId?: string | null;
};

async function sendMeta(event: FunnelEvent, input: TrackInput): Promise<void> {
  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  if (!pixelId || !token) return; // not configured → no-op

  const userData: Record<string, string[]> = {};
  if (input.email) userData.em = [sha256(input.email)];
  if (input.phone) userData.ph = [sha256(input.phone.replace(/[^\d]/g, ""))];

  const body = {
    data: [
      {
        event_name: EVENT_MAP[event].meta,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "system_generated",
        user_data: userData,
        ...(input.value != null
          ? { custom_data: { value: input.value, currency: input.currency || "USD" } }
          : {}),
      },
    ],
  };

  await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function sendGa4(event: FunnelEvent, input: TrackInput): Promise<void> {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) return; // not configured → no-op

  const body = {
    // Never send raw PII to GA4. Callers pass an email/owner key as clientId for
    // cross-event joining; hash it to a stable pseudonymous id here. No id →
    // random uuid (event still records, just not joined to a user).
    client_id: input.clientId ? sha256(input.clientId) : randomUUID(),
    events: [
      {
        name: EVENT_MAP[event].ga4,
        params: {
          ...(input.value != null ? { value: input.value, currency: input.currency || "USD" } : {}),
        },
      },
    ],
  };

  await fetch(
    `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
}

/**
 * Record a server-side conversion to Meta + GA4. Best-effort and non-blocking:
 * never throws, so it's safe to await (or fire-and-forget) inside auth/payment/
 * lead paths. No-ops if neither provider is configured.
 */
export async function trackServer(event: FunnelEvent, input: TrackInput = {}): Promise<void> {
  try {
    await Promise.allSettled([sendMeta(event, input), sendGa4(event, input)]);
  } catch {
    // never let analytics break the real flow
  }
}
