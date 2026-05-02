// Referral system: users get a unique code, sharers earn credits when
// referred users upgrade to a paid plan.
//
// DB tables needed (add via Supabase migration before this code runs):
//
//   referral_codes(
//     id          uuid primary key default gen_random_uuid(),
//     email       text not null unique,
//     code        text not null unique,
//     created_at  timestamptz not null default now()
//   );
//
//   referral_events(
//     id               uuid primary key default gen_random_uuid(),
//     referrer_email   text not null,
//     referred_email   text not null,
//     code             text not null,
//     kind             text not null,   -- 'signup' | 'conversion'
//     credits_awarded  int  not null default 0,
//     created_at       timestamptz not null default now()
//   );
//
// Both helpers fail open (return safe defaults) when the tables don't
// exist yet so the rest of the app keeps working before the migration runs.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { addCredits } from "./credits";

export const REFERRAL_REWARD_CREDITS = 500; // $5 in credits per paid conversion
export const REFERRAL_SIGNUP_CREDITS = 100; // $1 for the referred user on signup

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Derive a short alphanumeric code from an email address. */
function deriveCode(email: string): string {
  // Simple deterministic hash → base-36 string, 8 chars.
  let h = 5381;
  for (let i = 0; i < email.length; i++) {
    h = ((h << 5) + h) ^ email.charCodeAt(i);
    h = h >>> 0; // keep unsigned 32-bit
  }
  return h.toString(36).padStart(8, "0").slice(0, 8).toUpperCase();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the user's referral code. Looks up an existing row from the DB,
 * creating one if absent. Falls back to a locally-derived code when the DB
 * is unavailable so the page still renders.
 */
export async function getReferralCode(email: string): Promise<string> {
  const fallback = deriveCode(email);
  if (!isDatabaseConfigured()) return fallback;
  try {
    const supabase = getSupabaseAdminClient();

    // Try to fetch existing code first.
    const { data: existing, error: fetchErr } = await supabase
      .from("referral_codes" as never)
      .select("code")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (fetchErr) {
      // Table likely doesn't exist yet — fail open.
      console.warn("getReferralCode fetch failed:", fetchErr.message);
      return fallback;
    }

    if (existing) {
      return (existing as { code: string }).code;
    }

    // Create a new row.
    const code = fallback;
    const { error: insertErr } = await supabase
      .from("referral_codes" as never)
      .insert({ email: email.toLowerCase(), code } as never);

    if (insertErr) {
      console.warn("getReferralCode insert failed:", insertErr.message);
    }

    return code;
  } catch (err) {
    console.warn("getReferralCode threw:", err);
    return fallback;
  }
}

/**
 * Record that a new user signed up via a referral link. Awards
 * REFERRAL_SIGNUP_CREDITS to the referred user. Safe to call from a
 * public route (no auth required) — the code was in the URL.
 */
export async function recordReferralSignup(
  referralCode: string,
  newEmail: string,
): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    const supabase = getSupabaseAdminClient();

    // Resolve referrer email from the code.
    const { data: codeRow, error: codeErr } = await supabase
      .from("referral_codes" as never)
      .select("email")
      .eq("code", referralCode.toUpperCase())
      .maybeSingle();

    if (codeErr || !codeRow) {
      console.warn("recordReferralSignup: unknown code", referralCode);
      return;
    }

    const referrerEmail = (codeRow as { email: string }).email;

    // Don't self-refer.
    if (referrerEmail.toLowerCase() === newEmail.toLowerCase()) return;

    // Check for duplicate signup event to keep idempotent.
    const { count: existing } = await supabase
      .from("referral_events" as never)
      .select("id", { count: "exact", head: true })
      .eq("referred_email", newEmail.toLowerCase())
      .eq("kind", "signup");

    if ((existing ?? 0) > 0) return; // already recorded

    // Write the signup event.
    await supabase.from("referral_events" as never).insert({
      referrer_email: referrerEmail,
      referred_email: newEmail.toLowerCase(),
      code: referralCode.toUpperCase(),
      kind: "signup",
      credits_awarded: REFERRAL_SIGNUP_CREDITS,
    } as never);

    // Award signup credits to the new user.
    await addCredits(
      newEmail.toLowerCase(),
      REFERRAL_SIGNUP_CREDITS,
      "purchase",
      `referral:signup:${referralCode}`,
    );
  } catch (err) {
    console.warn("recordReferralSignup threw:", err);
  }
}

/**
 * Called when a referred user converts to a paid plan. Awards
 * REFERRAL_REWARD_CREDITS to the referrer. Idempotent — won't award twice
 * for the same referred email.
 */
export async function awardReferralConversion(referredEmail: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    const supabase = getSupabaseAdminClient();

    // Find the original signup event to get the referrer.
    const { data: signupEvent, error: signupErr } = await supabase
      .from("referral_events" as never)
      .select("referrer_email, code")
      .eq("referred_email", referredEmail.toLowerCase())
      .eq("kind", "signup")
      .maybeSingle();

    if (signupErr || !signupEvent) {
      // No matching signup — nothing to award.
      return;
    }

    const { referrer_email: referrerEmail, code } = signupEvent as {
      referrer_email: string;
      code: string;
    };

    // Guard against double-awarding.
    const { count: already } = await supabase
      .from("referral_events" as never)
      .select("id", { count: "exact", head: true })
      .eq("referred_email", referredEmail.toLowerCase())
      .eq("kind", "conversion");

    if ((already ?? 0) > 0) return;

    // Record the conversion event.
    await supabase.from("referral_events" as never).insert({
      referrer_email: referrerEmail,
      referred_email: referredEmail.toLowerCase(),
      code,
      kind: "conversion",
      credits_awarded: REFERRAL_REWARD_CREDITS,
    } as never);

    // Award credits to the referrer.
    await addCredits(
      referrerEmail,
      REFERRAL_REWARD_CREDITS,
      "purchase",
      `referral:conversion:${referredEmail}`,
    );
  } catch (err) {
    console.warn("awardReferralConversion threw:", err);
  }
}

/**
 * Return referral stats for a user: their code, total signups, paid
 * conversions, and total credits earned. Returns safe zeros on any error.
 */
export async function getReferralStats(email: string): Promise<{
  code: string;
  totalReferrals: number;
  conversions: number;
  creditsEarned: number;
}> {
  const code = await getReferralCode(email);
  const defaults = { code, totalReferrals: 0, conversions: 0, creditsEarned: 0 };

  if (!isDatabaseConfigured()) return defaults;

  try {
    const supabase = getSupabaseAdminClient();

    const [signupRes, conversionRes] = await Promise.all([
      supabase
        .from("referral_events" as never)
        .select("id", { count: "exact", head: true })
        .eq("referrer_email", email.toLowerCase())
        .eq("kind", "signup"),
      supabase
        .from("referral_events" as never)
        .select("credits_awarded")
        .eq("referrer_email", email.toLowerCase())
        .eq("kind", "conversion"),
    ]);

    const totalReferrals = signupRes.count ?? 0;
    const conversionRows = (conversionRes.data ?? []) as { credits_awarded: number }[];
    const conversions = conversionRows.length;
    const creditsEarned = conversionRows.reduce(
      (sum, r) => sum + (r.credits_awarded ?? 0),
      0,
    );

    return { code, totalReferrals, conversions, creditsEarned };
  } catch (err) {
    console.warn("getReferralStats threw:", err);
    return defaults;
  }
}
