import { NextResponse } from "next/server";
import { getDisplayName } from "@/lib/v-account-profile";
import { auth } from "@/auth";
import { ensureProfile, getPlan } from "@/lib/v-db";
import { ensureSignupGrant, balance } from "@/lib/v-credits";
import { topupMaxDollars, isElevatedTopup } from "@/lib/v-entitlements";
import { passPricingEnabled } from "@/lib/preflight/pass-pricing";
import { getPlanV1State } from "@/lib/preflight/entitlements-v1";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ signedIn: false });
  await ensureProfile(email, session.user?.name ?? undefined);
  await ensureSignupGrant(email);
  // The display name rides along: the shell already calls this on mount, and asking twice for one label
  // would be a second request on every page load to say who you are.
  const [plan, bal, displayName] = await Promise.all([getPlan(email), balance(email), getDisplayName(email).catch(() => null)]);
  // Additive _v1 plan fields (pricing cutover step 11): read only when VRAELIS_PASS_PRICING is on (no
  // extra DB round trip today) and safely null for everyone without a _v1 subscription.
  const v1 = passPricingEnabled() ? await getPlanV1State(email.toLowerCase()) : null;
  // topupMax = the single-charge ceiling (same for everyone). elevatedTopup unlocks
  // the contact-for-invoice path in the UI for amounts above that ceiling.
  return NextResponse.json({
    signedIn: true, email, displayName: displayName ?? null, plan, balance: bal, topupMax: topupMaxDollars(), elevatedTopup: isElevatedTopup(plan, email),
    plan_v1: v1?.plan ?? null, plan_v1_cycle: v1?.cycle ?? null,
  });
}
