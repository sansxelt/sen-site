import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { getCreditBalance } from "../../../../../lib/credits";
import { getPlanForEmail } from "../../../../../lib/account-billing";
import {
  getWeeklyUsage,
  nextWeekResetUtc,
  PLAN_LIMITS,
} from "../../../../../lib/plan-limits";
import { getActiveAddonKeys } from "../../../../../lib/active-addons";
import { getSupabaseAdminClient, isDatabaseConfigured } from "../../../../../lib/supabase-admin";
import { isOneTimeBoost } from "../../../../../lib/pricing";

// v0.1.16 — Single read for the billing-panel Credits section.
// Combines balance + weekly usage + any unconsumed one-time boost
// credits (Session Boost / Weekly Boost) so the panel can show the
// user's complete usage picture in one place without three separate
// round-trips. Falls back gracefully on any failure — partial data
// is fine for a status display.

type Out = {
  balance: number;
  weekly: {
    chat: { used: number; cap: number | null; lifted: boolean };
    image: { used: number; cap: number | null; lifted: boolean };
    voice_seconds: { used: number; cap: number | null; lifted: boolean };
    reset_iso: string;
  };
  boosts: { session: number; weekly: number };
};

export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase() ?? "";
  const empty: Out = {
    balance: 0,
    weekly: {
      chat: { used: 0, cap: null, lifted: false },
      image: { used: 0, cap: null, lifted: false },
      voice_seconds: { used: 0, cap: null, lifted: false },
      reset_iso: nextWeekResetUtc().toISOString(),
    },
    boosts: { session: 0, weekly: 0 },
  };
  if (!email) return NextResponse.json(empty, { status: 200 });

  try {
    const [balance, plan, weekly, addons, boostCounts] = await Promise.all([
      getCreditBalance(email),
      getPlanForEmail(email),
      getWeeklyUsage(email),
      getActiveAddonKeys(email),
      countUnconsumedBoosts(email),
    ]);
    const limits = PLAN_LIMITS[plan];
    // A cap-lift addon (power_pack lifts everything; copilot_pro_pack
    // lifts chat) effectively makes the cap unlimited for the user.
    const chatLifted =
      addons.has("power_pack") || addons.has("copilot_pro_pack");
    const imageLifted = addons.has("power_pack");
    const voiceLifted = addons.has("power_pack");
    return NextResponse.json({
      balance,
      weekly: {
        chat: {
          used: weekly.chat_requests,
          cap: chatLifted ? null : limits.weekly_chat_requests,
          lifted: chatLifted,
        },
        image: {
          used: weekly.image_requests,
          cap: imageLifted ? null : limits.weekly_image_requests,
          lifted: imageLifted,
        },
        voice_seconds: {
          used: weekly.voice_seconds,
          cap: voiceLifted ? null : limits.weekly_voice_seconds,
          lifted: voiceLifted,
        },
        reset_iso: nextWeekResetUtc().toISOString(),
      },
      boosts: boostCounts,
    } satisfies Out);
  } catch (err) {
    console.warn("[usage-summary] failed:", err);
    return NextResponse.json(empty, { status: 200 });
  }
}

async function countUnconsumedBoosts(
  email: string,
): Promise<{ session: number; weekly: number }> {
  if (!isDatabaseConfigured()) return { session: 0, weekly: 0 };
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("boost_credits" as never)
      .select("addon_key")
      .eq("email", email)
      .eq("consumed", false);
    if (error || !data) return { session: 0, weekly: 0 };
    let session = 0;
    let weekly = 0;
    for (const row of data as Array<{ addon_key: string }>) {
      // Only one-time boosts count as "remaining boosts" — recurring
      // addon rows (Power Pack via PayPal etc.) shouldn't show up
      // here because they grant ongoing access, not single-use.
      if (!isOneTimeBoost(row.addon_key)) continue;
      if (row.addon_key === "session_boost") session += 1;
      if (row.addon_key === "weekly_boost") weekly += 1;
    }
    return { session, weekly };
  } catch {
    return { session: 0, weekly: 0 };
  }
}
