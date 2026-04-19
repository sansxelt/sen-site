import type { ModelTier, PlanKey } from "./ai-models";
import { getSupabaseAdminClient } from "./supabase-admin";

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
export function decideChatRequest(args: {
  plan: PlanKey;
  requestedTier: ModelTier;
  weekly: WeeklyUsage;
}): LimitDecision {
  const limits = PLAN_LIMITS[args.plan];

  // 1. Hard cap (free / apprentice / studio)
  if (
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

  // 2. Pro throttle — never block, just degrade tier
  if (limits.pro_throttle) {
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
export function decideImageRequest(args: {
  plan: PlanKey;
  weekly: WeeklyUsage;
}): LimitDecision {
  const limits = PLAN_LIMITS[args.plan];
  const cap = limits.weekly_image_requests;
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
  if (args.weekly.image_requests >= cap) {
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
export function decideVoiceRequest(args: {
  plan: PlanKey;
  weekly: WeeklyUsage;
  added_seconds?: number;
}): LimitDecision {
  const limits = PLAN_LIMITS[args.plan];
  if (limits.weekly_voice_seconds === null) {
    return { kind: "ok" };
  }
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
