// Google Calendar OAuth callback. Identity comes from the signed-in session
// (state is CSRF-only); we exchange the code for a refresh token and store it.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { exchangeCode } from "@/lib/vraelis-calendar";
import { setWorkspaceCalendar } from "@/lib/vraelis-db";

const ORIGIN = "https://vraelis.com";

export async function GET(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.redirect(`${ORIGIN}/signin?callbackUrl=%2Faccount`);

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(`${ORIGIN}/v/account?calendar=error`);

  const refreshToken = await exchangeCode(code);
  if (!refreshToken) {
    // Google omits refresh_token if already granted without prompt=consent.
    return NextResponse.redirect(`${ORIGIN}/v/account?calendar=error`);
  }
  await setWorkspaceCalendar(email, { refreshToken, connected: true, calendarId: "primary" });
  return NextResponse.redirect(`${ORIGIN}/v/account?calendar=done`);
}
