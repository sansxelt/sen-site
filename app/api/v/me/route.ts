import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureProfile, getPlan } from "@/lib/v-db";
import { ensureSignupGrant, balance } from "@/lib/v-credits";
import { topupMaxDollars, isElevatedTopup } from "@/lib/v-entitlements";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ signedIn: false });
  await ensureProfile(email, session.user?.name ?? undefined);
  await ensureSignupGrant(email);
  const [plan, bal] = await Promise.all([getPlan(email), balance(email)]);
  // topupMax = the single-charge ceiling (same for everyone). elevatedTopup unlocks
  // the contact-for-invoice path in the UI for amounts above that ceiling.
  return NextResponse.json({ signedIn: true, email, plan, balance: bal, topupMax: topupMaxDollars(), elevatedTopup: isElevatedTopup(plan, email) });
}
