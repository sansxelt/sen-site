import type { ReactNode } from "react";
import { auth } from "../../auth";
import { DashboardNav } from "../../components/dashboard-nav";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const userEmail = session?.user?.email ?? "";

  return (
    <div className="relative min-h-screen bg-neutral-950 text-neutral-100">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_40%)]" />

      {/* Flex column on mobile, flex row on desktop */}
      <div className="flex min-h-screen flex-col lg:flex-row">
        {/* DashboardNav renders the sidebar on desktop and top bar on mobile */}
        <DashboardNav userEmail={userEmail} />

        <main className="flex-1 px-4 py-6 sm:px-8 lg:py-10 lg:pl-10 lg:pr-8">
          {children}
        </main>
      </div>
    </div>
  );
}
