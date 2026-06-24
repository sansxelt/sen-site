import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTestWithOptions, getReport, OPTION_LETTERS } from "@/lib/v-db";
import { reportAccessRole, canViewSharedProject, ROLE_LABEL } from "@/lib/v-workspace";
import { ReportBody, OptionThumb } from "@/app/rank/app/tests/[id]/report-body";
import { AnalysisPanel } from "@/app/rank/app/tests/[id]/analysis-panel";

export const metadata: Metadata = { title: "Shared report" };

// A client-ready, read-only decision report for workspace members. Reuses the same
// public-safe ReportBody — NO owner controls (no exports/screening/sources/collection
// links/data-quality). Access is gated by active workspace membership.
export default async function SharedReportPage({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect(`/signin?callbackUrl=%2Fapp%2Fshared%2F${testId}`);

  const role = await reportAccessRole(email, testId);
  // Owners use their full report page (with controls).
  if (role === "owner") redirect(`/app/tests/${testId}/report`);

  if (!role) {
    return (
      <div className="wrap" style={{ maxWidth: 720, paddingTop: 48, paddingBottom: 80 }}>
        <div className="empty"><div className="empty__icon">🔒</div><h3>No access to this report</h3><p>This decision report hasn&apos;t been shared with you, or your access was changed. Ask the workspace owner to invite you.</p><a href="/app/team" className="btn">Back to Team</a></div>
      </div>
    );
  }

  const data = await getTestWithOptions(testId);
  if (!data) {
    return <div className="wrap" style={{ maxWidth: 720, paddingTop: 48, paddingBottom: 80 }}><div className="empty"><div className="empty__icon">∅</div><h3>Report not found</h3><a href="/app/team" className="btn">Back to Team</a></div></div>;
  }
  const { test, options } = data;
  const report = test.status === "complete" ? await getReport(testId) : null;

  // Back to the shared project when the viewer reached this via a shared project.
  const inSharedProject = test.project_id ? await canViewSharedProject(email, test.project_id) : false;
  const back = inSharedProject ? { href: `/app/shared/projects/${test.project_id}`, label: "Project" } : { href: "/app/team", label: "Team" };

  return (
    <div className="wrap" style={{ maxWidth: 820, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <a href={back.href} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, color: "var(--fg-3)", textDecoration: "none", marginBottom: 18 }}>← {back.label}</a>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <p className="eyebrow" style={{ margin: 0 }}>Shared decision report</p>
        <span className="pill" style={{ fontSize: 10.5, color: "var(--fg-4)" }}>{ROLE_LABEL[role]} · client-safe view</span>
      </div>
      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 8 }}>{test.title}</h1>

      {test.status === "active" ? (
        <>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-4)", marginBottom: 14 }}>Collecting — {test.votes_valid} / {test.votes_target} valid judgments so far.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 10, maxWidth: 460 }}>
            {options.map((o, i) => (
              <div key={o.id} style={{ position: "relative" }}>
                <OptionThumb o={o} size={84} />
                <span style={{ position: "absolute", top: 6, left: 6, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.55)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 11 }}>{OPTION_LETTERS[i]}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", marginTop: 16 }}>This evaluation is still gathering real responses. Check back soon for the full report.</p>
        </>
      ) : report ? (
        <>
          <p style={{ fontSize: 14, color: "var(--fg-4)", marginBottom: 22 }}>A read-only decision report from qualified human signal.</p>
          <ReportBody
            results={report.results}
            options={options}
            votesTarget={test.votes_target}
            analysisSlot={report.results.analysis ? <AnalysisPanel testId="" initial={report.results.analysis} readOnly /> : null}
          />
        </>
      ) : (
        <div className="empty" style={{ marginTop: 20 }}><div className="empty__icon">◷</div><h3>No report yet</h3><p>This evaluation hasn&apos;t produced a report.</p></div>
      )}
    </div>
  );
}
