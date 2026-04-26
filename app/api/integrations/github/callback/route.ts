import { NextResponse } from "next/server";
import { upsertGithubIntegration } from "../../../../../lib/github";

export const runtime = "nodejs";

// GET /api/integrations/github/callback
//
// GitHub redirects here after the user approves the OAuth consent
// screen. We exchange the short-lived `code` for an access token,
// fetch the user's GitHub identity, persist everything against the
// originating account (carried in `state`), then bounce the browser
// back into the integrations page.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const failureUrl = new URL("/account/integrations", url.origin);
  failureUrl.searchParams.set("github", "error");

  if (errorParam) {
    failureUrl.searchParams.set("reason", errorParam);
    return NextResponse.redirect(failureUrl, 302);
  }

  if (!code || !state) {
    failureUrl.searchParams.set("reason", "missing_params");
    return NextResponse.redirect(failureUrl, 302);
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    failureUrl.searchParams.set("reason", "server_misconfigured");
    return NextResponse.redirect(failureUrl, 302);
  }

  // 1. Exchange code for an access token.
  let tokenJson: {
    access_token?: string;
    scope?: string;
    token_type?: string;
    error?: string;
  };
  try {
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          state,
        }),
      },
    );
    if (!tokenResponse.ok) {
      failureUrl.searchParams.set("reason", "token_exchange_failed");
      return NextResponse.redirect(failureUrl, 302);
    }
    tokenJson = (await tokenResponse.json()) as typeof tokenJson;
  } catch {
    failureUrl.searchParams.set("reason", "token_exchange_threw");
    return NextResponse.redirect(failureUrl, 302);
  }

  if (tokenJson.error || !tokenJson.access_token) {
    failureUrl.searchParams.set("reason", tokenJson.error ?? "no_token");
    return NextResponse.redirect(failureUrl, 302);
  }

  // 2. Resolve the GitHub identity for this token. Best-effort
  //    if /user fails we still persist the token; downstream calls
  //    will just lack the cached login/id.
  let githubLogin: string | null = null;
  let githubId: number | null = null;
  try {
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${tokenJson.access_token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (userResponse.ok) {
      const userJson = (await userResponse.json()) as {
        login?: string;
        id?: number;
      };
      githubLogin = userJson.login ?? null;
      githubId = typeof userJson.id === "number" ? userJson.id : null;
    }
  } catch {
    // Swallow, identity lookup is non-fatal.
  }

  // 3. Persist. `state` is the user's email (set by the oauth init route).
  try {
    await upsertGithubIntegration({
      email: state,
      access_token: tokenJson.access_token,
      scope: tokenJson.scope ?? "",
      github_login: githubLogin,
      github_id: githubId,
    });
  } catch {
    failureUrl.searchParams.set("reason", "persist_failed");
    return NextResponse.redirect(failureUrl, 302);
  }

  const successUrl = new URL("/account/integrations", url.origin);
  successUrl.searchParams.set("github", "connected");
  return NextResponse.redirect(successUrl, 302);
}
