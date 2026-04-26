import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../../lib/desktop-auth";

export const runtime = "nodejs";

// GET /api/integrations/github/oauth
// Initiates the GitHub OAuth flow. Accepts either a desktop bearer
// token or a NextAuth session. The user's email is passed as `state`
// so the callback (v0.1.5) can re-attach the connection to the right
// account. We hard-redirect to GitHub instead of returning JSON so a
// browser hit "just works".
export async function GET(request: Request) {
  let email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    const session = await auth();
    email = session?.user?.email ?? null;
  }
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    // Without this guard the redirect to github.com/login/oauth/authorize
    // would land on a "Bad request" page or silently fail. Bouncing
    // back to /account/integrations with an error param means the
    // user gets actionable feedback in the integrations banner.
    const url = new URL(request.url);
    const back = new URL("/account/integrations", url.origin);
    back.searchParams.set("github", "error");
    back.searchParams.set("reason", "server_misconfigured");
    return NextResponse.redirect(back, 302);
  }
  const params = new URLSearchParams({
    client_id: clientId,
    scope: "repo,user",
    state: email,
  });

  return NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params.toString()}`,
    302,
  );
}
