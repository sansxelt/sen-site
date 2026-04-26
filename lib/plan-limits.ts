import type { ModelTier, PlanKey } from "./ai-models";
import type { BillingAddonKey } from "./pricing";
import { getSupabaseAdminClient } from "./supabase-admin";
import {
  consumeCredits,
  CREDIT_COSTS,
  getCreditBalance,
  type CreditKind,
} from "./credits";

// v0.1.8 — kinds the gating layer asks about. Map to the boost addons
// that satisfy them. A user with an unconsumed credit for any of these
// keys is allowed past the cap (and the credit gets burnt by the call).
export type BoostKind = "chat" | "image" | "voice" | "copilot";

const BOOST_KIND_TO_ADDONS: Record<BoostKind, BillingAddonKey[]> = {
  // session_boost = +50 chats this session, weekly_boost = +500 weekly.
  // We treat both as chat-eligible — gating consumes whichever the user
  // bought first (cheapest first so weekly_boost outlives the cheaper one).
  chat: ["session_boost", "weekly_boost"],
  // v0.1.9 — image / voice / copilot one-time SKUs were dropped in
  // favour of the credit ledger. Empty arrays here mean
  // hasUnconsumedBoost / consumeBoostForKind no-op for those kinds and
  // the gating layer falls through to consumeCreditFor instead.
  image: [],
  voice: [],
  copilot: [],
};

// Sansxel limit model — our take, not a copy of anyone else's.
//
//   - Free / Apprentice / Studio: hard weekly cap on chat requests +
//     hard weekly cap on voice seconds. Hit it → blocked until the
//     reset (Monday 00:00 UTC).
//   - Pro: NO hard cap. After enough usage we silently downgrade the
//     tier they get answered on. Smart → balanced after the first
//     bucket, balanced → fast after the second. Never blocks; the
//     model just gets cheaper as they pour through requests.
//   - Teams / Enterprise: no caps at all (per-seat for teams, but
//     the seat math lives elsewhere).
//   - Session warning: every plan optionally shows a "long thread"
//     hint after N messages. Nothing happens, just a nudge.

export type PlanLimits = {
  weekly_chat_requests: number | null; // null = unlimited
  weekly_voice_seconds: number | null;
  weekly_image_requests: number | null; // null = unlimited, 0 = blocked
  // Pro-only: monotonic thresholds the resolver uses to step down
  // from smart to balanced to fast as weekly chat usage piles up.
  pro_throttle?: {
    smart_to_balanced: number;
    balanced_to_fast: number;
  };
  session_warn_after?: number;
};

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  free: {
    weekly_chat_requests: 50,
    weekly_voice_seconds: 0,
    weekly_image_requests: 3,
    session_warn_after: 30,
  },
  apprentice: {
    weekly_chat_requests: 500,
    weekly_voice_seconds: 30 * 60, // 30 min
    weekly_image_requests: 25,
    session_warn_after: 60,
  },
  studio: {
    weekly_chat_requests: 1500,
    weekly_voice_seconds: 90 * 60, // 90 min
    weekly_image_requests: 100,
    session_warn_after: 80,
  },
  pro: {
    weekly_chat_requests: null,
    weekly_voice_seconds: null,
    weekly_image_requests: null,
    pro_throttle: {
      smart_to_balanced: 1500,
      balanced_to_fast: 3000,
    },
    session_warn_after: 100,
  },
  teams: {
    weekly_chat_requests: null,
    weekly_voice_seconds: null,
    weekly_image_requests: null,
    session_warn_after: 100,
  },
  enterprise: {
    weekly_chat_requests: null,
    weekly_voice_seconds: null,
    weekly_image_requests: null,
  },
};

// Monday 00:00 UTC for the *current* week.
export function startOfWeekUtc(now = new Date()): Date {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  // getUTCDay: Sunday = 0, Monday = 1, ... Saturday = 6
  // We want the most recent Monday ≤ today.
  const day = d.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - offset);
  return d;
}

// Next Monday 00:00 UTC — shown to users as the reset moment.
export function nextWeekResetUtc(now = new Date()): Date {
  const start = startOfWeekUtc(now);
  start.setUTCDate(start.getUTCDate() + 7);
  return start;
}

export type WeeklyUsage = {
  chat_requests: number;
  voice_seconds: number;
  image_requests: number;
  week_start: Date;
};

// Sum the user's usage_events since the start of the current UTC
// week. Returns zeros on any failure (table missing, transient DB
// hiccup, etc.) — limits should fail open, not block paying users.
export async function getWeeklyUsage(email: string): Promise<WeeklyUsage> {
  const weekStart = startOfWeekUtc();
  const result: WeeklyUsage = {
    chat_requests: 0,
    voice_seconds: 0,
    image_requests: 0,
    week_start: weekStart,
  };
  try {
    const supabase = getSupabaseAdminClient();
    const sinceIso = weekStart.toISOString();

    const [chatRes, voiceRes, imageRes] = await Promise.all([
      supabase
        .from("usage_events" as never)
        .select("id", { count: "exact", head: true })
        .eq("email", email)
        .in("kind", ["chat", "copilot"])
        .gte("created_at", sinceIso),
      supabase
        .from("usage_events" as never)
        .select("audio_seconds")
        .eq("email", email)
        .eq("kind", "voice_speak")
        .gte("created_at", sinceIso),
      supabase
        .from("usage_events" as never)
        .select("id", { count: "exact", head: true })
        .eq("email", email)
        .eq("kind", "image")
        .gte("created_at", sinceIso),
    ]);

    result.chat_requests = chatRes.count ?? 0;
    if (voiceRes.data) {
      const rows = voiceRes.data as unknown as { audio_seconds: number | null }[];
      for (const row of rows) {
        result.voice_seconds += Number(row.audio_seconds ?? 0);
      }
    }
    result.image_requests = imageRes.count ?? 0;
  } catch (err) {
    console.warn("getWeeklyUsage failed:", err);
  }
  return result;
}

export type LimitDecision =
  | { kind: "ok"; throttledTier?: ModelTier }
  | { kind: "blocked"; reason: string; reset: string; limit: number; used: number };

// Decide whether a chat request can proceed. Returns either { ok }
// (optionally with a throttled tier the caller should use instead of
// what the user asked for) or { blocked } with the human-readable
// reason + reset time.
//
// activeAddons (optional) — when present, copilot_pro_pack or
// power_pack make the chat cap unlimited (matches "Unlimited copilot
// for any plan" copy on the addon). Pro tier throttling also relaxes
// — paying for unlimited shouldn't silently get you a worse model.
export function decideChatRequest(args: {
  plan: PlanKey;
  requestedTier: ModelTier;
  weekly: WeeklyUsage;
  activeAddons?: Set<BillingAddonKey>;
}): LimitDecision {
  const limits = PLAN_LIMITS[args.plan];
  const liftedByAddon =
    !!args.activeAddons &&
    (args.activeAddons.has("power_pack") ||
      args.activeAddons.has("copilot_pro_pack"));

  // 1. Hard cap (free / apprentice / studio) — bypassed if the user
  // has Copilot Pro Pack or Power Pack.
  if (
    !liftedByAddon &&
    limits.weekly_chat_requests !== null &&
    args.weekly.chat_requests >= limits.weekly_chat_requests
  ) {
    return {
      kind: "blocked",
      reason: `You've used your ${args.plan} weekly chat limit (${limits.weekly_chat_requests}). Resets ${nextWeekResetUtc().toISOString()}.`,
      reset: nextWeekResetUtc().toISOString(),
      limit: limits.weekly_chat_requests,
      used: args.weekly.chat_requests,
    };
  }

  // 2. Pro throttle — also bypassed when an unlimited addon is on
  // file. Otherwise unchanged.
  if (limits.pro_throttle && !liftedByAddon) {
    let tier = args.requestedTier;
    if (
      tier === "smart" &&
      args.weekly.chat_requests >= limits.pro_throttle.smart_to_balanced
    ) {
      tier = "balanced";
    }
    if (
      tier === "balanced" &&
      args.weekly.chat_requests >= limits.pro_throttle.balanced_to_fast
    ) {
      tier = "fast";
    }
    if (tier !== args.requestedTier) {
      return { kind: "ok", throttledTier: tier };
    }
  }

  return { kind: "ok" };
}

// Image generation limit check. Free / apprentice / studio have a
// hard weekly cap; pro / teams / enterprise have none. A limit of 0
// means "image gen is not in this plan" → blocked with an upgrade
// nudge instead of a "you've used your N" message.
//
// activeAddons (optional) — Power Pack lifts the cap to unlimited
// (it bundles "Bonus credit allowance for voice + image"). Plans
// that are completely blocked (cap=0, e.g. potential future free
// tier with no image gen) are NOT unblocked by an addon — the addon
// adds VOLUME, not entitlement.
export function decideImageRequest(args: {
  plan: PlanKey;
  weekly: WeeklyUsage;
  activeAddons?: Set<BillingAddonKey>;
}): LimitDecision {
  const limits = PLAN_LIMITS[args.plan];
  const cap = limits.weekly_image_requests;
  const liftedByAddon = !!args.activeAddons?.has("power_pack");
  if (cap === null) return { kind: "ok" };
  if (cap === 0) {
    return {
      kind: "blocked",
      reason: `Image generation is on paid plans. Upgrade to draw with sansxel-1.`,
      reset: nextWeekResetUtc().toISOString(),
      limit: 0,
      used: args.weekly.image_requests,
    };
  }
  if (!liftedByAddon && args.weekly.image_requests >= cap) {
    return {
      kind: "blocked",
      reason: `You've used your ${args.plan} weekly image limit (${cap}). Resets ${nextWeekResetUtc().toISOString()}.`,
      reset: nextWeekResetUtc().toISOString(),
      limit: cap,
      used: args.weekly.image_requests,
    };
  }
  return { kind: "ok" };
}

// Deep research is only on Plus / Pro / Teams / Enterprise. The free
// tiers (free / apprentice / studio) get a friendly upgrade nudge.
// Internally we treat "plus" as an alias of pro for the purposes of
// this gate — the existing PlanKey set already covers the higher
// tiers, and "plus" is currently surfaced as `pro` in plan-limits.
export function decideDeepResearchRequest(args: {
  plan: PlanKey;
}): LimitDecision {
  const allowed: PlanKey[] = ["pro", "teams", "enterprise"];
  if (allowed.includes(args.plan)) {
    return { kind: "ok" };
  }
  return {
    kind: "blocked",
    reason: `Deep research is on Plus and up. Upgrade to unlock multi-source synthesis.`,
    reset: nextWeekResetUtc().toISOString(),
    limit: 0,
    used: 0,
  };
}

// Voice limit check — separate so the speak/transcribe routes can
// gate without going through the chat decision tree.
//
// activeAddons (optional) — Power Pack lifts the voice cap to
// unlimited. Plans that explicitly disallow voice (cap=0, e.g. free)
// still cannot use it via addon — it has to be a paid plan first.
export function decideVoiceRequest(args: {
  plan: PlanKey;
  weekly: WeeklyUsage;
  added_seconds?: number;
  activeAddons?: Set<BillingAddonKey>;
}): LimitDecision {
  const limits = PLAN_LIMITS[args.plan];
  if (limits.weekly_voice_seconds === null) {
    return { kind: "ok" };
  }
  // cap=0 means voice isn't on this plan at all — addon doesn't unlock.
  const liftedByAddon =
    !!args.activeAddons?.has("power_pack") &&
    limits.weekly_voice_seconds > 0;
  if (liftedByAddon) return { kind: "ok" };
  const projected =
    args.weekly.voice_seconds + (args.added_seconds ?? 0);
  if (projected > limits.weekly_voice_seconds) {
    return {
      kind: "blocked",
      reason:
        limits.weekly_voice_seconds === 0
          ? `Voice is on paid plans. Upgrade to use sansxel-1's voice.`
          : `You've used your ${args.plan} weekly voice budget (${Math.round(limits.weekly_voice_seconds / 60)} minutes).`,
      reset: nextWeekResetUtc().toISOString(),
      limit: limits.weekly_voice_seconds,
      used: args.weekly.voice_seconds,
    };
  }
  return { kind: "ok" };
}

// ───────────────────────────────────────────────────────────────────
// v0.1.8 — boost credit ledger
// ───────────────────────────────────────────────────────────────────
//
// One-time boosts (session_boost, weekly_boost, voice_minute_pack,
// image_credit_pack, copilot_time_pack) are written by the Stripe
// webhook (payment_intent.succeeded → boost_credits row with
// consumed=false). The gating layer asks hasUnconsumedBoost() to
// override a "blocked" plan-limit decision, then calls consumeBoost()
// to flip the row to consumed=true so it can't be reused.
//
// Both helpers fail open: any DB error returns false / no-op so a
// flaky Supabase never blocks a paying user. Worst case we don't
// honour a credit — that's a refund ticket, not a hung product.

/**
 * Returns true if the user has at least one unconsumed boost credit
 * that satisfies the given kind. The webhook stores rows keyed by
 * addon_key (e.g. "session_boost"); we OR over all addons that map
 * to the kind.
 */
export async function hasUnconsumedBoost(
  email: string,
  kind: BoostKind,
): Promise<boolean> {
  const addons = BOOST_KIND_TO_ADDONS[kind];
  if (!addons || addons.length === 0) return false;
  try {
    const supabase = getSupabaseAdminClient();
    const { count, error } = await supabase
      .from("boost_credits" as never)
      .select("id", { count: "exact", head: true })
      .eq("email", email.toLowerCase())
      .eq("consumed", false)
      .in("addon_key", addons);
    if (error) {
      console.warn("hasUnconsumedBoost lookup failed:", error.message);
      return false;
    }
    return (count ?? 0) > 0;
  } catch (err) {
    console.warn("hasUnconsumedBoost threw:", err);
    return false;
  }
}

/**
 * Marks one unconsumed boost credit as consumed for the given email +
 * addon key. Picks the OLDEST credit so the cheapest top-up burns first
 * (FIFO). Returns true if a credit was actually consumed.
 *
 * Callers should prefer the kind-aware variant (consumeBoostForKind)
 * for chat / image / voice / copilot gating; this lower-level helper
 * exists for surfaces that already know exactly which addon to spend.
 */
export async function consumeBoost(
  email: string,
  addonKey: BillingAddonKey,
): Promise<boolean> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data: rows, error: pickErr } = await supabase
      .from("boost_credits" as never)
      .select("id")
      .eq("email", email.toLowerCase())
      .eq("addon_key", addonKey)
      .eq("consumed", false)
      .order("created_at", { ascending: true })
      .limit(1);
    if (pickErr) {
      console.warn("consumeBoost pick failed:", pickErr.message);
      return false;
    }
    const picked = (rows ?? [])[0] as { id?: string } | undefined;
    if (!picked?.id) return false;

    const { error: updErr } = await supabase
      .from("boost_credits" as never)
      .update({ consumed: true, consumed_at: new Date().toISOString() } as never)
      .eq("id", picked.id)
      .eq("consumed", false); // re-check guards against double-spend races
    if (updErr) {
      console.warn("consumeBoost update failed:", updErr.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("consumeBoost threw:", err);
    return false;
  }
}

/**
 * Burn one credit for the given kind. Tries each candidate addon in
 * order (cheap → expensive) so a $2 session_boost is consumed before a
 * $5 weekly_boost. Returns the addon key that was actually spent, or
 * null if no credit was available.
 */
export async function consumeBoostForKind(
  email: string,
  kind: BoostKind,
): Promise<BillingAddonKey | null> {
  for (const addonKey of BOOST_KIND_TO_ADDONS[kind] ?? []) {
    if (await consumeBoost(email, addonKey)) return addonKey;
  }
  return null;
}

// ───────────────────────────────────────────────────────────────────
// v0.1.9 — credit ledger fallback
// ───────────────────────────────────────────────────────────────────
//
// When a plan limit blocks a request and no boost credit is available,
// the gating layer asks consumeCreditFor() whether the user can pay
// for it out of their credit balance instead. Returns true (and burns
// CREDIT_COSTS[kind] credits) when the user has enough; false when
// they don't. The boost path stays as a v0.1.8 fallback for users who
// already bought a session_boost / weekly_boost.

/**
 * Burn credits for a chat / image / voice_minute / copilot request.
 * Returns true if the user had enough credits and the call should be
 * allowed past the limit; false if the credit balance is insufficient.
 *
 * The refId stitches consume rows back to the request that spent them
 * so support can reconstruct what was paid for. We mix in a coarse
 * timestamp (per-second) so a retried request inside the same second
 * de-duplicates against itself and a longer interval doesn't.
 */
export async function consumeCreditFor(
  email: string,
  kind: CreditKind,
): Promise<boolean> {
  const cost = CREDIT_COSTS[kind];
  if (!cost || cost <= 0) return false;
  const refId = `${kind}:${Math.floor(Date.now() / 1000)}`;
  try {
    const result = await consumeCredits(email, cost, "consume", refId);
    return result.ok;
  } catch (err) {
    console.warn("consumeCreditFor threw:", err);
    return false;
  }
}

/**
 * Cheap "would consumeCreditFor succeed?" check that does not mutate
 * the balance. Useful for surfacing "you have $X.XX of credits left"
 * UI without spending any.
 */
export async function hasEnoughCreditFor(
  email: string,
  kind: CreditKind,
): Promise<boolean> {
  const cost = CREDIT_COSTS[kind];
  if (!cost || cost <= 0) return false;
  const balance = await getCreditBalance(email);
  return balance >= cost;
}
