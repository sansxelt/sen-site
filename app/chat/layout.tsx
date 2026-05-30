import type { ReactNode } from "react";
import { auth } from "../../auth";
import { DashboardNav } from "../../components/dashboard-nav";
import { isAdminEmail } from "../../lib/admin";

// /chat — Workshop shell. Single sidebar, chat as the default canvas.
// Lives outside (site) layout so the marketing header doesn't appear.
export default async function ChatLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const userEmail = session?.user?.email ?? "";
  const isAdmin = isAdminEmail(userEmail || null);

  return (
    <div
      className="relative min-h-screen text-neutral-100"
      style={{ background: "#080809" }}
    >
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: "radial-gradient(circle at top, rgba(255,255,255,0.04) 0%, transparent 40%)",
        }}
      />
      <div className="flex min-h-screen flex-col lg:flex-row">
        <DashboardNav userEmail={userEmail} zone="chat" isAdmin={isAdmin} />
        <main className="flex-1 min-w-0 pb-[88px] lg:pb-0">
          {children}
        </main>
      </div>
    </div>
  );
}
