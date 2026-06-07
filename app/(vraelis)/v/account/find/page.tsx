import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { FindLeads } from "./find-client";

export const metadata: Metadata = {
  title: "Find leads — Vraelis",
  robots: { index: false, follow: false },
};

export default async function FindLeadsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin?callbackUrl=%2Fv%2Faccount%2Ffind");

  return (
    <section className="section" style={{ position: "relative", overflow: "hidden" }}>
      <div className="gridbg" style={{ opacity: 0.35 }} />
      <div className="wrap" style={{ position: "relative", maxWidth: 760 }}>
        <Link href="/v/account" style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-4)", textDecoration: "none" }}>
          ← Back to inbox
        </Link>
        <div style={{ margin: "18px 0 24px" }}>
          <p className="eyebrow">Find leads</p>
          <h1 className="display" style={{ fontSize: "clamp(1.9rem, 3.4vw, 2.8rem)", marginBottom: 8 }}>
            Find local <span className="em">businesses</span> to reach.
          </h1>
          <p className="lead-copy">
            Search by what you&apos;re after and where. Add the ones you want to your inbox — then reach out (call, or add an email and let Vraelis do it).
          </p>
        </div>
        <FindLeads />
      </div>
    </section>
  );
}
