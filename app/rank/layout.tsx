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

  // WHAT THE CHROME NEEDS TO KNOW, RESOLVED ON THE SERVER.
  //
  // The command surface jumps to a system by name and the topbar shows a review indicator, so both need real
  // rows. They are read HERE rather than from a new endpoint: this layout already resolves the session, so
  // the alternative was a fresh public API route existing only to feed navigation, which is a new backend
  // surface to secure and scope for no gain. Member-scoped by the same function the Systems page uses.
  //
  // Gated on the app host so the marketing pages that share this layout do no database work, and wrapped so
  // a slow or failed read costs the chrome nothing: the palette simply offers destinations instead of
  // destinations plus systems, and the indicator stays hidden rather than guessing.
  let systems: { id: string; name: string }[] = [];
  let pendingReviews = 0;
  if (email && appHost) {
    try {
      const [{ preflightDbReady }, { listApplicationsForMember }, { listPendingReviews }] = await Promise.all([
        import("@/lib/preflight/db-ready"),
        import("@/lib/v-applications"),
        import("@/lib/preflight/reviewed-plan-db"),
      ]);
      if (await preflightDbReady()) {
        const [apps, pending] = await Promise.all([
          listApplicationsForMember(email),
          listPendingReviews(email.toLowerCase()),
        ]);
        systems = apps.map((a) => ({ id: a.id, name: a.name }));
        pendingReviews = pending.length;
      }
    } catch { /* chrome degrades quietly; the pages themselves still report their own errors */ }
  }

  return (
    <RankShell signedIn={Boolean(email)} email={email} appHost={appHost} systems={systems} pendingReviews={pendingReviews}>
      {children}
    </RankShell>
  );
}
