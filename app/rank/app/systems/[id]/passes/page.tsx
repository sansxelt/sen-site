import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightAppAccess } from "@/lib/v-preflight-guard";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { SetupRequired } from "../../setup-required";
import { getApplication, type RunSummary } from "@/lib/v-applications";
import { listRunsForApp } from "@/lib/preflight/runs-db";
import { AppTabs } from "../app-tabs";
import { I, EmptyIcon } from "@/app/rank/_components/icons";
import { Verdict } from "@/app/rank/_components/verdict";
import { Page, PageHeader } from "@/app/rank/_components/page-header";

export const metadata: Metadata = { title: "Verifications" };

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

// A LOCAL runPill() USED TO LIVE HERE, AND ITS HISTORY IS WHY IT NO LONGER DOES.
//
// The first version said "Verified" for a run the API, the webhooks and the CI gate all call blocked: it
// mapped repair_verified to a green Verified, when a targeted repair rerun exercises only the flows that
// failed and is therefore evidence the repair worked, never evidence the system's critical promises hold.
// It also read `decision` without ever looking at `state`, so a run that did not complete but carried a
// decision from an earlier attempt rendered that decision as a settled verdict. Both were fixed by handing
// the decision to toPublicDecision.
//
// What survived the fix was the SHAPE of the mistake: a private table of labels and colours, sitting next
// to seven other private tables that had each been corrected at a different time. This one still called the
// undecided state "No decision" while the list page called it "Not tested" and home-verdict.ts calls it
// "Not yet verified". <Verdict> renders runVerdict(), so there is nothing left here to correct or to drift.
function RunRow({ appId, r }: { appId: string; r: RunSummary }) {
  return (
    <Link href={`/systems/${appId}/passes/${r.id}`}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-1)", textDecoration: "none" }}>
      {/* The row used to lead with a 9px dot painted the pill's own colour. It was aria-hidden, so it said
          nothing the pill does not, and the only way to keep it was for this file to hold a second copy of
          the signal palette, which is the drift being removed. The pill carries the colour now. */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, color: "var(--fg-2)", fontWeight: 600 }}>{timeAgo(r.created_at) || "Verification"}</div>
        {r.deployment_url ? (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 3 }}>
            {r.deployment_url}
          </div>
        ) : null}
      </div>
      <Verdict state={r.state} decision={r.decision} style={{ flex: "none" }} />
      <span aria-hidden style={{ color: "var(--fg-5)", flex: "none", fontSize: 13 }}>&rarr;</span>
    </Link>
  );
}

// All Production Passes for one application. Owner-gated server component; every read degrades to an
// empty state, so nothing here is ever fabricated.
export default async function AppRunsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requirePreflightAppAccess(id, "/systems/" + id);
  const owner = access?.owner ?? "";
  if (!(await preflightDbReady())) return <SetupRequired />;

  const app = await getApplication(owner, id);
  if (!app) {
    return (
      <Page>
        <div className="empty" style={{ marginBottom: 80 }}>
          <EmptyIcon d={I.slash} />
          <h3>System not found</h3>
          <p>This system doesn&apos;t exist, or it belongs to another account.</p>
          <Link href="/systems" className="btn">Back to systems</Link>
        </div>
      </Page>
    );
  }

  const runs = await listRunsForApp(owner, id, 50);

  return (
    <Page>
      <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, marginBottom: 14 }}>
        <Link href="/systems" style={{ color: "var(--fg-4)", textDecoration: "none" }}>Systems</Link>
        <span aria-hidden style={{ color: "var(--fg-5)" }}>/</span>
        <span style={{ color: "var(--fg-2)", fontWeight: 600, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.name}</span>
      </nav>

      {/* Every /systems/[id] page set this same h1 to clamp(1.7rem, 3vw, 2.4rem), which is the 38.4px
          member of the six-size set; <PageHeader> gives the whole console one. The deployment URL is the
          lead line it always was, only now at the one size the component owns. */}
      <PageHeader
        title={app.name}
        lead={
          <a href={app.app_url} target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-4)", textDecoration: "none", wordBreak: "break-all" }}>
            {app.app_url}
          </a>
        }
      />

      {/* <Page> owns the measure and the shell owns padding-top, so the tail room stays here on the body. */}
      <div style={{ paddingBottom: 80 }}>
        <AppTabs appId={id} active="passes" />

        {runs.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {runs.map((r) => <RunRow key={r.id} appId={id} r={r} />)}
          </div>
        ) : (
          <div className="empty">
            <EmptyIcon d={I.shield} />
            <h3>No verifications yet</h3>
            <p>A verification walks this app in a real browser against its contract and returns a decision with evidence. Once one runs, it shows here.</p>
            <Link href={`/systems/${id}`} className="btn">Back to overview</Link>
          </div>
        )}
      </div>
    </Page>
  );
}
