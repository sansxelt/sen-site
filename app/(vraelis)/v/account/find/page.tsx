import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isWorkspaceOnboarded } from "@/lib/vraelis-db";
import { FindLeads } from "./find-client";

export const metadata: Metadata = {
  title: "Find leads — Vraelis",
  robots: { index: false, follow: false },
};

export default async function FindLeadsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin?callbackUrl=%2Fv%2Faccount%2Ffind");
  // Core onboarding first — /v/account shows the setup screen until done.
  if (!(await isWorkspaceOnboarded(session.user.email))) redirect("/v/account");

  return (
    <section className="section section--app" style={{ position: "relative", overflow: "hidden" }}>
      <div className="gridbg" style={{ opacity: 0.35 }} />
      <div className="wrap" style={{ position: "relative", maxWidth: 760 }}>
        <Link href="/v/account" style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-4)", textDecoration: "none" }}>
          ← Back to inbox
        </Link>
        <div style={{ margin: "12px 0 18px" }}>
          <h1 className="display" style={{ fontSize: "clamp(1.4rem, 2.2vw, 1.9rem)", marginBottom: 6 }}>
            Find local <span className="em">businesses</span> to reach.
          </h1>
          <p style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.55, maxWidth: 560 }}>
            Search by what you&apos;re after and where. Add the ones you want to your inbox — then reach out (call, or add an email and let Vraelis do it).
          </p>
        </div>
        <FindLeads />
      </div>
    </section>
  );
}
