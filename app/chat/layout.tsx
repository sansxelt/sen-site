import type { ReactNode } from "react";
import { auth } from "../../auth";
import { DashboardNav } from "../../components/dashboard-nav";
import { isAdminEmail } from "../../lib/admin";

export default async function ChatLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const userEmail = session?.user?.email ?? "";
  const isAdmin = isAdminEmail(userEmail || null);

  return (
    <div className="relative min-h-screen bg-background text-neutral-100">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <DashboardNav userEmail={userEmail} zone="chat" isAdmin={isAdmin} />
        <main className="flex-1 min-w-0 pb-[88px] lg:pb-0">
          {children}
        </main>
      </div>
    </div>
  );
}
