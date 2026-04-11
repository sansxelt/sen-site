import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseConfig } from "../../../lib/supabase";

const productionAppOrigin = "https://sansxel.ai";

function getRedirectOrigin(request: NextRequest) {
  const { hostname, origin } = request.nextUrl;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return origin;
  }

  return productionAppOrigin;
}

function getSafeNextPath(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next") ?? "/account";

  return next.startsWith("/") ? next : "/account";
}

function renderHashRedirectPage(nextPath: string) {
  const escapedNextPath = JSON.stringify(nextPath);

  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Finishing sign-in</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #050505;
        color: #f5f5f5;
        font-family: Inter, "Segoe UI", sans-serif;
      }
      .card {
        width: min(32rem, calc(100vw - 2rem));
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 1.75rem;
        background: rgba(255,255,255,0.05);
        padding: 2rem;
        box-sizing: border-box;
      }
      .eyebrow {
        font-size: 0.75rem;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: rgba(245,245,245,0.7);
      }
      h1 {
        margin: 0.75rem 0 0;
        font-size: 1.875rem;
        line-height: 1.1;
      }
      p {
        margin: 1rem 0 0;
        color: rgba(245,245,245,0.82);
        line-height: 1.6;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="eyebrow">Account Access</div>
      <h1>Finishing your sign-in</h1>
      <p>One moment while we return you to your account.</p>
    </div>
    <script>
      const nextPath = ${escapedNextPath};
      if (window.location.hash) {
        window.location.replace(nextPath + window.location.hash);
      } else {
        window.location.replace("/#auth");
      }
    </script>
  </body>
</html>`,
    {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );
}

export async function GET(request: NextRequest) {
  const config = getSupabaseConfig();
  const redirectOrigin = getRedirectOrigin(request);
  const nextPath = getSafeNextPath(request);
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return renderHashRedirectPage(nextPath);
  }

  if (!config) {
    return NextResponse.redirect(new URL("/#auth", redirectOrigin));
  }

  const response = NextResponse.redirect(new URL(nextPath, redirectOrigin));

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, options, value }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("OAuth callback exchange failed:", error);
    return NextResponse.redirect(new URL("/#auth", redirectOrigin));
  }

  return response;
}
