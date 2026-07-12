import type { ReactNode } from "react";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { humanEvalEnabled } from "@/lib/v-entitlements";
import { RankShell } from "./_components/rank-ui";

export default async function RankLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const email = session?.user?.email ?? null;
  // On app.vraelis.com the product overview is served at "/" (the proxy rewrites it to /rank/app),
  // so the pathname alone can't tell the shell it's inside the app; pass the host down.
  const host = ((await headers()).get("host") || "").toLowerCase();
  const appHost = host === "app.vraelis.com" || host.startsWith("app.localhost");
  return <RankShell signedIn={Boolean(email)} email={email} humanEval={humanEvalEnabled()} appHost={appHost}>{children}</RankShell>;
}
