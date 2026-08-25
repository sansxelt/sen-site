// Disconnect Google Calendar (clears the stored refresh token).
//
// SECURITY: POST, not GET. This destroys the stored Google refresh token, and it authenticated with the
// session cookie alone — so any page that could make the victim's browser issue a top-level GET (an image
// tag, a link, a redirect) could disconnect their calendar. SameSite=Lax does not help here: Lax
// deliberately ALLOWS the cookie on a top-level GET navigation, which is exactly the shape this took.
//
// A state-changing endpoint must not be reachable by navigation. As a POST it is covered by the
// centralized CSRF check in proxy.ts, which enforces on mutating requests that carry the session cookie.
//
// GET is kept only to answer 405 with Allow: POST, so an old bookmark or link fails visibly rather than
// silently doing nothing — and, crucially, no longer disconnects anything.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { setWorkspaceCalendar } from "@/lib/vraelis-db";

const ORIGIN = "https://vraelis.com";

export async function POST() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ ok: false, error: "signin_required" }, { status: 401 });
  await setWorkspaceCalendar(email, { refreshToken: null, connected: false });
  return NextResponse.json({ ok: true });
}

export function GET() {
  return NextResponse.json(
    { ok: false, error: "method_not_allowed", detail: "Disconnecting the calendar requires a POST." },
    { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } },
  );
}

// Referenced so the redirect target stays greppable alongside the connect flow, which still redirects.
export const DISCONNECT_RETURN = `${ORIGIN}/v/account?calendar=disconnected`;
