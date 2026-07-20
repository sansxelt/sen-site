import type { Metadata } from "next";
import type { ReactNode } from "react";
import { auth } from "../../auth";
import { DashboardNav } from "../../components/dashboard-nav";
import { isAdminEmail } from "../../lib/admin";

// RETIRED SURFACE. This describes a product Vraelis no longer is. The routes stay alive so existing links
// and stored data keep working, but they must not compete with the current product in search results or in
// a link preview, so everything under here is noindexed. robots.txt disallows the path as well; this tag is
// what keeps an already-indexed URL out, since a disallowed page can still be indexed from inbound links.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ChatLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const userEmail = session?.user?.email ?? "";
  const isAdmin = isAdminEmail(userEmail || null);

  return (
    <div className="relative min-h-screen bg-background text-neutral-100">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <DashboardNav userEmail={userEmail} zone="chat" isAdmin={isAdmin} />
        <main data-route-transition className="flex-1 min-w-0 pb-[88px] lg:pb-0">
          {children}
        </main>
      </div>
    </div>
  );
}
