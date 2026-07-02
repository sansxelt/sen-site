import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCheck } from "@/lib/v-checks";
import { CheckReport } from "./check-report";

export const metadata: Metadata = { title: "AI output check" };

// Owner-scoped AI Check report. getCheck is scoped to the signed-in user, so a check
// is only ever visible to the account that ran it.
export default async function CheckReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect(`/signin?callbackUrl=%2Fapp%2Fchecks%2F${id}`);

  const check = await getCheck(email, id);
  if (!check) {
    return (
      <div className="wrap" style={{ maxWidth: 720, paddingTop: 48, paddingBottom: 80 }}>
        <div className="empty">
          <div className="empty__icon">∅</div>
          <h3>Check not found</h3>
          <p>This check doesn&apos;t exist, or it belongs to another account.</p>
          <a href="/app/checks/new" className="btn">Run a new check</a>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ maxWidth: 820, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <a href="/app/checks/new" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, color: "var(--fg-3)", textDecoration: "none", marginBottom: 18 }}>← New check</a>
      <CheckReport result={check.result} title={check.title} createdAt={check.created_at} />
    </div>
  );
}
