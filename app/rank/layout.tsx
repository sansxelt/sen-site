import type { ReactNode } from "react";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { RankShell } from "./_components/rank-ui";

// Pin the whole signed-in app shell to per-request rendering. auth() reads headers() (a request-time
// API), but with app/rank/app/loading.tsx present and no dynamic config, Vercel can serve a prerendered
// static shell that saw NO session cookie — which renders the signed-out state and gets cached, so a
// signed-in visitor sees the "sign in" body while the client-resolved topbar shows the signed-in menu.
// force-dynamic makes auth() run on every request so the SERVER render is always correct (same fix the
// repo already uses on account/memory, account/contributors, (site)/contribute).
export const dynamic = "force-dynamic";

export default async function RankLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const email = session?.user?.email ?? null;
  // On app.vraelis.com the product overview is served at "/" (the proxy rewrites it to /rank/app),
  // so the pathname alone can't tell the shell it's inside the app; pass the host down.
  const host = ((await headers()).get("host") || "").toLowerCase();
  const appHost = host === "app.vraelis.com" || host.startsWith("app.localhost");
  return <RankShell signedIn={Boolean(email)} email={email} appHost={appHost}>{children}</RankShell>;
}
