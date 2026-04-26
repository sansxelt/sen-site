import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { DashboardNav } from "../../components/dashboard-nav";
import { getZone } from "../../lib/zone";

// /account moved off the proxy auth gate (proxy.ts now only gates
// /api/account). The page-tree auth check lives here so any new
// /account/* page inherits it without thinking. Same /app pattern,
// avoids the getToken-vs-auth() cookie disagreement loop that hit
// users right after OAuth signin.
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const [session, zone] = await Promise.all([auth(), getZone()]);
  const userEmail = session?.user?.email ?? "";
  if (!userEmail) {
    redirect("/signin?callbackUrl=%2Faccount");
  }

  return (
    <div className="relative min-h-screen bg-neutral-950 text-neutral-100">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_40%)]" />

      {/* Flex column on mobile, flex row on desktop */}
      <div className="flex min-h-screen flex-col lg:flex-row">
        {/* DashboardNav renders the sidebar on desktop and top bar on mobile */}
        <DashboardNav userEmail={userEmail} zone={zone} />

        {/* pb-[calc(env(safe-area-inset-bottom,0px)+72px)] clears the fixed mobile bottom nav */}
        <main className="flex-1 px-4 py-6 pb-[88px] sm:px-6 sm:pb-[88px] lg:py-10 lg:pl-10 lg:pr-8 lg:pb-10">
          {children}
        </main>
      </div>
    </div>
  );
}
