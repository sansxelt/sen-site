// GET /api/v/launch-context — everything the create-test flow needs to be
// plan-aware: balance, plan caps, and the active-test count this month.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureProfile, getPlan, countActiveTestsThisMonth } from "@/lib/v-db";
import { ensureSignupGrant, balance } from "@/lib/v-credits";
import { entitlements, MIN_OPTIONS, MIN_VOTES } from "@/lib/v-entitlements";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ signedIn: false, minOptions: MIN_OPTIONS, minVotes: MIN_VOTES });
  await ensureProfile(email, session.user?.name ?? undefined);
  await ensureSignupGrant(email);
  const [plan, bal, activeTests] = await Promise.all([getPlan(email), balance(email), countActiveTestsThisMonth(email)]);
  const ent = entitlements(plan);
  return NextResponse.json({
    signedIn: true, email, plan, balance: bal, activeTests,
    maxOptions: ent.maxOptions, maxVotes: ent.maxVotes, activeTestsPerMonth: ent.activeTestsPerMonth,
    minOptions: MIN_OPTIONS, minVotes: MIN_VOTES,
  });
}
