// Disconnect Google Calendar (clears the stored refresh token).
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { setWorkspaceCalendar } from "@/lib/vraelis-db";

const ORIGIN = "https://vraelis.com";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.redirect(`${ORIGIN}/signin?callbackUrl=%2Faccount`);
  await setWorkspaceCalendar(email, { refreshToken: null, connected: false });
  return NextResponse.redirect(`${ORIGIN}/v/account?calendar=disconnected`);
}
