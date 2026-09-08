import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightOwner } from "@/lib/v-preflight-guard";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { SetupRequired } from "../systems/setup-required";
import { listAllRuns, type PassRow } from "@/lib/preflight/overview-db";
import { environmentsByApp, sourceConnectionsByApp, describeSource } from "@/lib/preflight/setup-read";
import { I, EmptyIcon } from "@/app/rank/_components/icons";
import { Verdict } from "@/app/rank/_components/verdict";
import { Page, PageHeader } from "@/app/rank/_components/page-header";

export const metadata: Metadata = { title: "Deployments" };

const ENV_LABELS: Record<string, string> = { preview: "Preview", staging: "Staging", production: "Production" };

// Stable UTC render (used as a hover title): "2026-07-02 14:31 UTC".
function when(iso: string | null | undefined): string {
  if (!iso) return "";
  try { return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC"; } catch { return ""; }
}

// Relative "3m ago / 4h ago / Jul 2" for the latest-pass line. Server component, rendered once per
// request, so a wall-clock relative time carries no hydration-mismatch risk.
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

// A FALSE VERIFIED LIVED HERE, and this was the last surface still carrying it.
//
// The switch this file used to own read run.decision ALONE and mapped repair_verified to a green
// "Verified", while toPublicDecision, and therefore the public API, the CI gate and the outbound webhooks,
// call that same run blocked. A targeted repair rerun exercises only the flows that had failed, so it is
// evidence the repair worked, not evidence the system's critical promises hold. The worker actively writes
// that value (worker/preflight/execute-run.ts sets it whenever a ready run lacks full coverage), so this
// was live and not theoretical: every partial-coverage pass read green here and Blocked everywhere else.
// It also never looked at run.state except in its default arm, so a decision left over from an attempt of
// a run that never completed rendered as a settled verdict.
//
// The same defect was found and fixed twice before. app/rank/app/passes/page.tsx and the per-system
// app/rank/app/systems/[id]/deployments/page.tsx both carried postmortems for it, and this account-wide
// page was the missed third instance. That it could be missed three times is the argument against a page
// owning any part of this, so the local translator is now GONE rather than corrected once more. The pill is
// <Verdict>, which calls runVerdict itself from the run's state and decision: no local function left to
// drift, no local colour table, and no way for this page to invent a fifth name for a state.
//
// Deleting it also closed the gap between the word and the MARK. DECISION_MARK maps repair_verified to a
// verified-repair wrench, so the old code had to hand <DecisionMark> a translated tone rather than the raw
// decision, purely to stop a checkmark-wrench appearing beside the word "Blocked". <Verdict> takes the mark
// and the label from the same verdict, so the two cannot come apart again.
//
// The undecided wording went with it. This page said "No verdict" where /passes said "Not yet verified":
// one state, and lib/preflight/home-verdict.ts had already settled its name. Nothing here decides that any
// more, so nothing here can disagree about it.

type DeploymentGroup = { url: string; runs: PassRow[] };

// Group passes by the deployment URL they tested. listAllRuns returns newest first, so first-seen
// insertion order gives groups sorted by most recent activity, and each group keeps newest-first runs.
function groupByDeployment(passes: PassRow[]): DeploymentGroup[] {
  const groups = new Map<string, PassRow[]>();
  for (const p of passes) {
    if (!p.deploymentUrl) continue;
    const existing = groups.get(p.deploymentUrl);
    if (existing) existing.push(p);
    else groups.set(p.deploymentUrl, [p]);
  }
  return Array.from(groups, ([url, runs]) => ({ url, runs }));
}

function DeploymentCard({ group, envLabel, sourceLine }: { group: DeploymentGroup; envLabel: string | null; sourceLine: string | null }) {
  const latest = group.runs[0];
  const last = timeAgo(latest.completedAt ?? latest.createdAt);
  const countText = group.runs.length === 1 ? "1 verification" : `${group.runs.length} verifications`;
  const metaParts = [latest.applicationName || null, countText, last ? `Latest ${last}` : null].filter(Boolean);
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-1)", lineHeight: 1.5, wordBreak: "break-all", minWidth: 0 }}>
          {group.url}
        </div>
        <div style={{ display: "flex", gap: 6, flex: "none", alignItems: "center" }}>
          {envLabel ? <span className="pill" style={{ fontSize: 10 }}>{envLabel}</span> : null}
          <Verdict state={latest.state} decision={latest.decision} />
        </div>
      </div>
      {sourceLine ? (
        <div style={{ fontSize: 12.5, color: "var(--fg-4)" }}>
          Source: <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>{sourceLine}</span>
        </div>
      ) : null}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: "var(--fg-4)" }}>{metaParts.join(", ")}</span>
        <Link
          href={`/systems/${latest.applicationId}/passes/${latest.id}`}
          style={{ fontSize: 13, fontWeight: 600, color: "var(--acc-deep)", display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none", flex: "none" }}
        >
          View latest verification <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}

// Deployment history for Vraelis Preflight. Every Production Pass records the exact deployment URL it
// tested; this page is that history grouped by URL. Deployment guards (verify-on-deploy, deploy blocking)
// are not built yet, so the only controls here are links to real passes. Honest roadmap card, no toggles.
export default async function DeploymentsPage() {
  const owner = await requirePreflightOwner("/deployments");
  if (!(await preflightDbReady())) return <SetupRequired />;
  const passes = await listAllRuns(owner, 60);
  const groups = groupByDeployment(passes);

  // Environment + source (github / custom_deploy) context for the applications behind these deployments.
  // Both are bulk single queries and degrade to empty maps on a pre-migration schema.
  const appIds = Array.from(new Set(groups.map((g) => g.runs[0].applicationId).filter(Boolean)));
  const [envByApp, sourceByApp] = await Promise.all([
    environmentsByApp(owner, appIds),
    sourceConnectionsByApp(owner, appIds),
  ]);

  // The last verified deployment across every application: the newest COMPLETED pass that recorded a
  // decision and the deployment URL it tested. Real rows only.
  const lastVerified = passes.find((p) => p.state === "completed" && p.decision && p.deploymentUrl) ?? null;
  const lvEnv = lastVerified ? (envByApp.get(lastVerified.applicationId) ?? null) : null;
  const lvSource = lastVerified ? describeSource(sourceByApp.get(lastVerified.applicationId)) : null;

  return (
    <Page>
      <PageHeader
        eyebrow="Vraelis Preflight"
        title="Deployments"
        lead="The deployments your verifications have tested, with the latest verdict for each."
      />

      {/* <Page> owns the measure and the shell overrides only padding-TOP, so the tail room this page has
          always had is kept here, on the content. Every sibling page carries the same 80px; without it the
          last row sat flush against the bottom of the window on this page alone. */}
      <div style={{ paddingBottom: 80 }}>

        {lastVerified ? (
          <div className="card" style={{ padding: "clamp(16px, 2.2vw, 22px)", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" }}>
                Last verified deployment
              </div>
              {/* The one verdict on this page that is a conclusion rather than a row in a list, so it takes
                  the larger of the component's two sizes. Every pill below it is a list row and stays small. */}
              <Verdict state={lastVerified.state} decision={lastVerified.decision} size="md" style={{ flex: "none" }} />
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 13.5, fontWeight: 600, color: "var(--fg-1)", marginTop: 10, wordBreak: "break-all" }}>
              {lastVerified.deploymentUrl}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 6 }}>
              {lastVerified.applicationName ? `${lastVerified.applicationName}, ` : ""}
              <span title={when(lastVerified.completedAt ?? lastVerified.createdAt)}>completed {timeAgo(lastVerified.completedAt ?? lastVerified.createdAt)}</span>
              {lvEnv && ENV_LABELS[lvEnv] ? `, ${ENV_LABELS[lvEnv].toLowerCase()} environment` : ""}
            </div>
            {lvSource ? (
              <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 4 }}>
                Source: <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>{lvSource}</span>
              </div>
            ) : null}
            <div style={{ marginTop: 12 }}>
              <Link href={`/systems/${lastVerified.applicationId}/passes/${lastVerified.id}`}
                style={{ fontSize: 13, fontWeight: 600, color: "var(--acc-deep)", textDecoration: "none" }}>
                View verification report →
              </Link>
            </div>
          </div>
        ) : null}

        {groups.length === 0 ? (
          <div className="empty">
            <EmptyIcon d={I.deploy} />
            <h3>No deployments tested yet</h3>
            <p>Run a verification and the deployment it tests appears here with its verdict.</p>
            <Link href="/systems" className="btn">Go to systems</Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {groups.map((g) => {
              const appId = g.runs[0].applicationId;
              const env = envByApp.get(appId);
              return (
                <DeploymentCard key={g.url} group={g}
                  envLabel={env ? (ENV_LABELS[env] ?? null) : null}
                  sourceLine={describeSource(sourceByApp.get(appId))} />
              );
            })}
          </div>
        )}

        {/* honest roadmap: guards are not built yet, and there is nothing here pretending otherwise */}
        <div className="card" style={{ background: "var(--bg-2)", display: "flex", flexDirection: "column", gap: 10, padding: 18, marginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--fg-1)", margin: 0 }}>Deployment guards are coming</h2>
            {/* NOT a <Verdict>. "Planned" is this company talking about its own roadmap, not a conclusion
                about the customer's software, and the verdict vocabulary has no word for it. Handing it the
                product's one signal component would put the shape that means "we checked this" on a promise. */}
            <span className="pill" style={{ fontSize: 10, color: "var(--fg-4)", background: "var(--bg-2)", borderColor: "var(--line-2)", flex: "none" }}>Planned</span>
          </div>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.6, margin: 0, maxWidth: 640 }}>
            Automated verify-on-deploy and deploy blocking are not active yet. Today, every verification
            records the exact deployment it tested, which is the history you see on this page. Guards will
            build on that record to verify each new deploy and hold a launch when a verification comes back Failed.
          </p>
        </div>
      </div>
    </Page>
  );
}
