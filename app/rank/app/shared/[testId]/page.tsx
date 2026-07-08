import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTestWithOptions, getReport, OPTION_LETTERS } from "@/lib/v-db";
import { reportAccessRole, canViewSharedProject, ROLE_LABEL } from "@/lib/v-workspace";
import { ReportBody, OptionThumb } from "@/app/rank/app/tests/[id]/report-body";
import { AnalysisPanel } from "@/app/rank/app/tests/[id]/analysis-panel";
import { ThemesPanel } from "@/app/rank/app/tests/[id]/themes-panel";

export const metadata: Metadata = { title: "Shared decision record" };

// A client-ready, read-only decision report for workspace members. Reuses the same
// public-safe ReportBody, NO owner controls (no exports/screening/sources/collection
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
        <div className="empty"><div className="empty__icon">🔒</div><h3>No access to this decision record</h3><p>This decision record hasn&apos;t been shared with you, or your access was changed. Ask the workspace owner to invite you.</p><Link href="/app/team" className="btn">Back to Team</Link></div>
      </div>
    );
  }

  const data = await getTestWithOptions(testId);
  if (!data) {
    return <div className="wrap" style={{ maxWidth: 720, paddingTop: 48, paddingBottom: 80 }}><div className="empty"><div className="empty__icon">∅</div><h3>Decision record not found</h3><Link href="/app/team" className="btn">Back to Team</Link></div></div>;
  }
  const { test, options } = data;
  const report = test.status === "complete" ? await getReport(testId) : null;

  // Back to the shared project when the viewer reached this via a shared project.
  const inSharedProject = test.project_id ? await canViewSharedProject(email, test.project_id) : false;
  const back = inSharedProject ? { href: `/app/shared/projects/${test.project_id}`, label: "Program" } : { href: "/app/team", label: "Team" };

  return (
    <div className="wrap" style={{ maxWidth: 820, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <Link href={back.href} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, color: "var(--fg-3)", textDecoration: "none", marginBottom: 18 }}>← {back.label}</Link>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <p className="eyebrow" style={{ margin: 0 }}>Shared decision record</p>
        <span className="pill" style={{ fontSize: 10.5, color: "var(--fg-4)" }}>{ROLE_LABEL[role]} | client-safe view</span>
      </div>
      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 8 }}>{test.title}</h1>

      {test.status === "active" ? (
        <>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-4)", marginBottom: 14 }}>Evaluation in progress, {test.votes_valid} of {test.votes_target} qualified judgments collected so far.</p>
          {options.every((o) => !o.asset_url) ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              {options.map((o, i) => (
                <div key={o.id} className="card" style={{ background: "var(--bg-2)" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 7 }}>Response {OPTION_LETTERS[i] ?? "?"}</div>
                  <p style={{ fontSize: 14, color: "var(--fg-1)", lineHeight: 1.55, margin: 0, whiteSpace: "pre-wrap" }}>{o.label}</p>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 10, maxWidth: 460 }}>
              {options.map((o, i) => (
                <div key={o.id} style={{ position: "relative" }}>
                  <OptionThumb o={o} size={84} />
                  <span style={{ position: "absolute", top: 6, left: 6, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.55)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 11 }}>{OPTION_LETTERS[i] ?? "?"}</span>
                </div>
              ))}
            </div>
          )}
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", marginTop: 16 }}>This evaluation is still gathering qualified signal. Check back soon for the complete decision record.</p>
        </>
      ) : report ? (
        <>
          <p style={{ fontSize: 14, color: "var(--fg-4)", marginBottom: 22 }}>A decision record derived from qualified human judgment.</p>
          <ReportBody
            results={report.results}
            options={options}
            votesTarget={test.votes_target}
            analysisSlot={report.results.analysis ? <AnalysisPanel testId="" initial={report.results.analysis} readOnly /> : null}
            themesSlot={report.results.themes ? <ThemesPanel testId="" initial={report.results.themes} readOnly /> : null}
          />
        </>
      ) : (
        <div className="empty" style={{ marginTop: 20 }}><div className="empty__icon">◷</div><h3>No report yet</h3><p>This evaluation hasn&apos;t produced a report.</p></div>
      )}
    </div>
  );
}
