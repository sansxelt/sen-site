import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { requirePreflightOwner } from "@/lib/v-preflight-guard";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { SetupRequired } from "../applications/setup-required";
import { listRepairs, type RepairRow } from "@/lib/preflight/overview-db";
import { I, EmptyIcon, DecisionMark } from "@/app/rank/_components/icons";

export const metadata: Metadata = { title: "Repairs" };

// Relative "3m ago / 4h ago / Jul 2". Server component rendered once per request, so a wall-clock
// relative time carries no hydration-mismatch risk. (Same helper as app/rank/app/applications/page.tsx.)
function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Repair status -> pill label + colours. The label always accompanies the colour, so status is never
// conveyed by colour alone.
const STATUS_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  suggested: { label: "Suggested", color: "var(--fg-4)", bg: "var(--bg-2)", border: "var(--line-2)" },
  applied_by_user: { label: "Awaiting verification", color: "#B45309", bg: "#FEF6E7", border: "#F3DFB0" },
  verified: { label: "Verified", color: "var(--acc-deep)", bg: "var(--acc-soft)", border: "var(--acc-line)" },
  failed: { label: "Failed", color: "#C0392B", bg: "#FBEBEA", border: "#F0C7C2" },
};

// Severity pill colours match the run report (app/rank/app/applications/[id]/passes/[runId]/page.tsx).
const SEV_COLOR: Record<string, string> = { critical: "var(--err)", high: "#c2831a", medium: "var(--fg-3)", low: "var(--fg-4)" };
const SEV_LABEL: Record<string, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };

function RepairRowItem({ repair }: { repair: RepairRow }) {
  const st = STATUS_STYLE[repair.status] ?? { label: repair.status.replace(/_/g, " "), color: "var(--fg-4)", bg: "var(--bg-2)", border: "var(--line-2)" };
  const sevColor = SEV_COLOR[repair.issueSeverity] ?? "var(--fg-3)";
  const created = timeAgo(repair.createdAt);

  // Verified repairs with a recorded rerun deep-link to that verification run; everything else opens the app.
  const verifiedRun = repair.status === "verified" && repair.verificationRunId;
  const href = repair.applicationId
    ? (verifiedRun ? `/applications/${repair.applicationId}/passes/${repair.verificationRunId}` : `/applications/${repair.applicationId}`)
    : null;
  const linkLabel = verifiedRun ? "View verification" : "Open app";

  const body = (
    <>
      <span className="pill" style={{ fontSize: 10, color: st.color, background: st.bg, borderColor: st.border, flex: "none" }}><DecisionMark decision={repair.status} />{st.label}</span>
      <div style={{ minWidth: 0, flex: "1 1 260px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14.5, color: "var(--fg-1)", lineHeight: 1.35, minWidth: 0, wordBreak: "break-word" }}>
            {repair.issueTitle || "Untitled issue"}
          </span>
          <span className="pill" style={{ fontSize: 10, color: sevColor, borderColor: "var(--line-2)", background: "var(--bg-2)", flex: "none" }}>
            {SEV_LABEL[repair.issueSeverity] ?? repair.issueSeverity}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {[repair.applicationName, created].filter(Boolean).join(", ")}
        </div>
      </div>
      {href ? (
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--acc-deep)", display: "inline-flex", alignItems: "center", gap: 5, flex: "none" }}>
          {linkLabel} <span aria-hidden>→</span>
        </span>
      ) : null}
    </>
  );

  const rowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", textDecoration: "none", color: "inherit" };
  return href
    ? <Link href={href} className="card card--hover" style={rowStyle}>{body}</Link>
    : <div className="card" style={rowStyle}>{body}</div>;
}

function Section({ heading, rows }: { heading: string; rows: RepairRow[] }) {
  if (!rows.length) return null;
  return (
    <section style={{ marginBottom: 26 }}>
      <h2 style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", margin: "0 0 10px" }}>
        {heading} <span style={{ color: "var(--fg-5)" }}>({rows.length})</span>
      </h2>
      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((r) => <RepairRowItem key={r.id} repair={r} />)}
      </div>
    </section>
  );
}

// Repairs index. Real v_repairs rows only, via the data layer. A repair in V1 is a fix prompt handed to
// the user's builder plus the verification rerun that proves the blocker is closed; Vraelis never writes
// code changes itself, and this page says so plainly.
export default async function RepairsPage() {
  const owner = await requirePreflightOwner("/repairs");
  if (!(await preflightDbReady())) return <SetupRequired />;
  const repairs = await listRepairs(owner);

  const byStatus = (s: string) => repairs.filter((r) => r.status === s);
  const known = new Set(["applied_by_user", "suggested", "verified", "failed"]);
  const other = repairs.filter((r) => !known.has(r.status));

  return (
    <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      {/* header */}
      <div style={{ marginBottom: 24 }}>
        <p className="eyebrow">Vraelis Preflight</p>
        <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "6px 0 10px" }}>Repairs</h1>
        <p style={{ fontSize: 14.5, color: "var(--fg-3)", lineHeight: 1.6, margin: 0, maxWidth: 620 }}>
          A repair is a fix prompt for your builder plus the rerun that proves the blocker is closed. Vraelis does not modify your code in V1.
        </p>
      </div>

      {repairs.length === 0 ? (
        <div className="empty">
          <EmptyIcon d={I.wrench} />
          <h3>No verified repairs yet</h3>
          <p>Open a blocker from a Production Pass to get repair guidance. When you push a fix, Vraelis reruns the exact failed check and records the verification here.</p>
          <Link href="/issues" className="btn">View issues</Link>
        </div>
      ) : (
        <>
          <Section heading="Awaiting verification" rows={byStatus("applied_by_user")} />
          <Section heading="Suggested" rows={byStatus("suggested")} />
          <Section heading="Verified" rows={byStatus("verified")} />
          <Section heading="Failed" rows={byStatus("failed")} />
          <Section heading="Other" rows={other} />
        </>
      )}
    </div>
  );
}
