// Start Google Calendar OAuth (owner-authed) → Google consent screen.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isCalendarConfigured, consentUrl } from "@/lib/vraelis-calendar";

const ORIGIN = "https://vraelis.com";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.redirect(`${ORIGIN}/signin?callbackUrl=%2Faccount`);
  if (!isCalendarConfigured()) return NextResponse.redirect(`${ORIGIN}/v/account?calendar=unavailable`);
  return NextResponse.redirect(consentUrl("vraelis"));
}
