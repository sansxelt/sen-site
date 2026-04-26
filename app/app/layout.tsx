import type { ReactNode } from "react";
import { auth } from "../../auth";
import { DashboardNav } from "../../components/dashboard-nav";
import { getZone } from "../../lib/zone";

// /app gets the same Workshop shell as /account/*, single sidebar,
// chat as the default canvas, every other workshop station accessible
// without bouncing between routes. Lives outside the (site) layout so
// the marketing header doesn't sit on top of the chat.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const [session, zone] = await Promise.all([auth(), getZone()]);
  const userEmail = session?.user?.email ?? "";

  return (
    <div className="relative min-h-screen bg-neutral-950 text-neutral-100">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_40%)]" />

      <div className="flex min-h-screen flex-col lg:flex-row">
        <DashboardNav userEmail={userEmail} zone={zone} />

        {/* Chat needs full height + no padding so the LEI shell can
            own the canvas. Account-style padding (py-10, px-6) would
            squeeze the workspace. */}
        <main className="flex-1 min-w-0 pb-[88px] lg:pb-0">
          {children}
        </main>
      </div>
    </div>
  );
}
