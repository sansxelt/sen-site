// GET /api/v/vote-context — read-only: balance, credits earned today, and the
// daily reward cap, so the vote page can show real earnings/progress. No writes.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureProfile } from "@/lib/v-db";
import { balance, rewardsToday } from "@/lib/v-credits";

export const runtime = "nodejs";
const REWARD_CAP_PER_DAY = 30;

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ signedIn: false, rewardCap: REWARD_CAP_PER_DAY });
  await ensureProfile(email, session.user?.name ?? undefined);
  const [bal, earned] = await Promise.all([balance(email), rewardsToday(email)]);
  return NextResponse.json({ signedIn: true, balance: bal, earnedToday: earned, rewardCap: REWARD_CAP_PER_DAY });
}
