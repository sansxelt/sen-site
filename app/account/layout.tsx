import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { DashboardNav } from "../../components/dashboard-nav";
import { isAdminEmail } from "../../lib/admin";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const userEmail = session?.user?.email ?? "";
  if (!userEmail) {
    redirect("/signin?callbackUrl=%2Faccount");
  }
  const isAdmin = isAdminEmail(userEmail);

  return (
    <div className="relative min-h-screen bg-background text-neutral-100">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <DashboardNav userEmail={userEmail} zone="chat" isAdmin={isAdmin} />
        <main data-route-transition className="flex-1 px-4 py-6 pb-[88px] sm:px-6 sm:pb-[88px] lg:py-10 lg:pl-10 lg:pr-8 lg:pb-10">
          {children}
        </main>
      </div>
    </div>
  );
}
