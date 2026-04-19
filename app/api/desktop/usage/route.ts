import { NextResponse } from "next/server";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import { getPlanForEmail } from "../../../../lib/account-billing";
import {
  getWeeklyUsage,
  nextWeekResetUtc,
  PLAN_LIMITS,
  startOfWeekUtc,
} from "../../../../lib/plan-limits";
import { listRecentUsage } from "../../../../lib/usage";

export async function GET(request: Request) {
  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const [plan, weekly, recent] = await Promise.all([
      getPlanForEmail(email),
      getWeeklyUsage(email),
      listRecentUsage(email, 20),
    ]);

    const limits = PLAN_LIMITS[plan];

    let proThrottle = null;
    if (limits.pro_throttle) {
      const used = weekly.chat_requests;
      const currentTier =
        used >= limits.pro_throttle.balanced_to_fast
          ? "fast"
          : used >= limits.pro_throttle.smart_to_balanced
            ? "balanced"
            : "smart";
      const nextThreshold =
        currentTier === "smart"
          ? limits.pro_throttle.smart_to_balanced
          : currentTier === "balanced"
            ? limits.pro_throttle.balanced_to_fast
            : null;
      proThrottle = {
        smart_to_balanced: limits.pro_throttle.smart_to_balanced,
        balanced_to_fast: limits.pro_throttle.balanced_to_fast,
        current_tier: currentTier,
        next_downshift_in: nextThreshold !== null ? nextThreshold - used : null,
      };
    }

    return NextResponse.json({
      chat_requests: weekly.chat_requests,
      voice_seconds: weekly.voice_seconds,
      week_start: startOfWeekUtc().toISOString(),
      week_reset: nextWeekResetUtc().toISOString(),
      weekly_chat_limit: limits.weekly_chat_requests,
      weekly_voice_seconds_limit: limits.weekly_voice_seconds,
      pro_throttle: proThrottle,
      recent: recent.map((r) => ({
        id: r.id,
        kind: r.kind,
        model: r.model,
        surface: r.surface,
        total_tokens: r.total_tokens,
        audio_seconds: r.audio_seconds,
        created_at: r.created_at,
      })),
    });
  } catch (err) {
    console.error("desktop/usage failed:", err);
    return NextResponse.json(
      { error: "Could not load usage." },
      { status: 500 },
    );
  }
}
