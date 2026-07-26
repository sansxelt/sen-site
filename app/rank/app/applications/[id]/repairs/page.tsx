import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightAppAccess } from "@/lib/v-preflight-guard";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { SetupRequired } from "../../setup-required";
import { getApplication } from "@/lib/v-applications";
import { listRepairs, type RepairRow } from "@/lib/preflight/overview-db";
import { AppTabs } from "../app-tabs";
import { I, EmptyIcon, DecisionMark } from "@/app/rank/_components/icons";

export const metadata: Metadata = { title: "Repairs" };

// Relative "3m ago / 4h ago / Jul 2" (server component; rendered once per request, no hydration risk).
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

// Repair lifecycle pill: label AND colour together, never colour alone.
// suggested -> applied_by_user -> verified (or failed).
type Pill = { label: string; color: string; bg: string; border: string };
const STATUS_PILLS: Record<string, Pill> = {
  suggested: { label: "Suggested", color: "var(--fg-4)", bg: "var(--bg-2)", border: "var(--line-2)" },
  applied_by_user: { label: "Applied", color: "var(--wait-ink)", bg: "var(--wait-wash)", border: "var(--wait-line)" },
  verified: { label: "Verified", color: "var(--go-ink)", bg: "var(--go-wash)", border: "var(--go-line)" },
  failed: { label: "Failed", color: "var(--stop-ink)", bg: "var(--stop-wash)", border: "var(--stop-line)" },
};
function statusPill(status: string): Pill {
  return STATUS_PILLS[status] ?? { label: status, color: "var(--fg-4)", bg: "var(--bg-2)", border: "var(--line-2)" };
}

const SEV_LABEL: Record<string, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };

function RepairRowView({ appId, r }: { appId: string; r: RepairRow }) {
  const p = statusPill(r.status);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-1)" }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {r.issueTitle || "Repair"}
        </div>
        <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 3 }}>
          {[SEV_LABEL[r.issueSeverity] ?? r.issueSeverity, timeAgo(r.createdAt)].filter(Boolean).join(", ")}
        </div>
      </div>
      {r.verificationRunId ? (
        <Link href={`/applications/${appId}/passes/${r.verificationRunId}`}
          style={{ fontSize: 12.5, fontWeight: 600, color: "var(--acc-deep)", textDecoration: "none", flex: "none" }}>
          Verification run <span aria-hidden>→</span>
        </Link>
      ) : null}
      <span className="pill" style={{ fontSize: 10.5, color: p.color, background: p.bg, borderColor: p.border, flex: "none" }}><DecisionMark decision={r.status} />{p.label}</span>
    </div>
  );
}

// Repairs for one application: real v_repairs rows only, filtered to this app. Owner-gated server
// component; every read degrades to an empty state, so nothing here is ever fabricated.
export default async function AppRepairsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requirePreflightAppAccess(id, "/applications/" + id);
  const owner = access?.owner ?? "";
  if (!(await preflightDbReady())) return <SetupRequired />;

  const app = await getApplication(owner, id);
  if (!app) {
    return (
      <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
        <div className="empty">
          <EmptyIcon d={I.slash} />
          <h3>Application not found</h3>
          <p>This application doesn&apos;t exist, or it belongs to another account.</p>
          <Link href="/applications" className="btn">Back to applications</Link>
        </div>
      </div>
    );
  }

  const repairs = (await listRepairs(owner)).filter((r) => r.applicationId === id);

  return (
    <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, marginBottom: 14 }}>
        <Link href="/applications" style={{ color: "var(--fg-4)", textDecoration: "none" }}>Applications</Link>
        <span aria-hidden style={{ color: "var(--fg-5)" }}>/</span>
        <span style={{ color: "var(--fg-2)", fontWeight: 600, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.name}</span>
      </nav>

      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "6px 0 10px" }}>{app.name}</h1>
      <a href={app.app_url} target="_blank" rel="noopener noreferrer"
        style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-4)", textDecoration: "none", wordBreak: "break-all" }}>
        {app.app_url}
      </a>

      <AppTabs appId={id} active="repairs" />

      {repairs.length ? (
        <div style={{ display: "grid", gap: 8 }}>
          {repairs.map((r) => <RepairRowView key={r.id} appId={id} r={r} />)}
        </div>
      ) : (
        <div className="empty">
          <EmptyIcon d={I.wrench} />
          <h3>No repairs yet</h3>
          <p>When a verification finds an issue, Vraelis writes a repair prompt for your AI builder. Apply it, rerun the verification, and the result is recorded here.</p>
          <Link href={`/applications/${id}/issues`} className="btn">View issues</Link>
        </div>
      )}
    </div>
  );
}
