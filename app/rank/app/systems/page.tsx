import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightOwner } from "@/lib/v-preflight-guard";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { SetupRequired } from "./setup-required";
import { listApplicationsForMember, latestRunByAppForApps, type Application, type RunSummary } from "@/lib/v-applications";
import { activateInvitesForEmail } from "@/lib/v-workspace";
import { isActiveRun, systemProof } from "@/lib/preflight/home-verdict";
import { I, EmptyIcon } from "@/app/rank/_components/icons";
import { Verdict } from "@/app/rank/_components/verdict";
import { Page, PageHeader } from "@/app/rank/_components/page-header";

// The tab title said "Applications" while the h1 said Systems, on the same screen.
export const metadata: Metadata = { title: "Systems" };

// Relative "3m ago / 4h ago / Jul 2" for the last-run line. This is a server component, rendered once per
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

// THE PILL THAT USED TO LIVE HERE WAS THE WORST COPY OF THE PRODUCT'S ONE SIGNAL.
//
// A local decisionStyle() sat at the top of this file and painted its own badge. It delegated the DECISION
// to toPublicDecision correctly, so the words were right, but everything around them was invented here:
//
//   COLOUR. Failed was rgba(194,84,12,0.08) on rgba(194,84,12,0.28) and Blocked's border was
//   rgba(194,131,26,0.3). Those are the CREAM theme's inks, hardcoded onto a graphite surface. This is the
//   most visited list in the product, so the pill a customer saw most often was the one furthest from the
//   tokens. In progress was painted --acc-deep, which on this surface resolves to the headline white, so a
//   run that had not finished yet shouted louder than one that had concluded.
//
//   WORDS. The undecided state was called "Not tested" here, against "No verdict", "No decision" and
//   "Not yet verified" on four neighbouring pages, for the identical state.
//
// It is <Verdict> now, which renders runVerdict() and therefore cannot disagree with the API, the CI gate,
// the webhooks or any other page. Nothing about the decision changed; only who is allowed to describe it.
// isActiveRun is imported for the same reason: this file kept a private copy of the active-state set, which
// is a second place for the worker's states to be listed and a second place to forget to update.

// summary is a loose JSON blob; read the critical-flow counters defensively and only when both are present.
function criticalFlows(summary: Record<string, unknown> | null | undefined): string | null {
  if (!summary) return null;
  const passed = summary.critical_passed, total = summary.critical_total;
  if (typeof passed === "number" && typeof total === "number" && total > 0) return `${passed} / ${total} critical flows`;
  return null;
}

function StatChip({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "11px 16px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", minWidth: 92 }}>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, lineHeight: 1, color: color ?? "var(--fg-1)" }}>{value}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-4)" }}>{label}</span>
    </div>
  );
}

function SystemCard({ system, run }: { system: Application; run: RunSummary | undefined }) {
  // systemProof is the canonical read of what a SYSTEM has been shown to do, and it already answers for the
  // no-run case, so the card no longer carries a null branch of its own.
  const proof = systemProof(run ?? null);
  const last = timeAgo(run?.completed_at ?? run?.created_at);
  const crit = criticalFlows(run?.summary);
  const metaParts = [crit, last ? `Last run ${last}` : null].filter(Boolean);
  const metaText = metaParts.length ? metaParts.join(", ") : "No verification yet";
  return (
    <Link href={`/systems/${system.id}`} className="card card--hover" style={{ display: "flex", flexDirection: "column", gap: 14, textDecoration: "none", color: "inherit", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--fg-1)", lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{system.name}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{system.app_url}</div>
        </div>
        <Verdict verdict={proof.verdict} style={{ flex: "none" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: "auto" }}>
        <span style={{ fontSize: 12, color: "var(--fg-4)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{metaText}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--acc-deep)", display: "inline-flex", alignItems: "center", gap: 5, flex: "none" }}>Open <span aria-hidden>&rarr;</span></span>
      </div>
    </Link>
  );
}

// Systems dashboard for Vraelis Preflight. Server component behind the preflight owner gate; every read
// degrades to an empty state when the data layer has nothing (or the tables are not migrated yet). No browser
// execution or discovery lives here: a run is a later phase.
export default async function SystemsPage() {
  const caller = await requirePreflightOwner("/systems");
  // A token-less (email-match) invite activates on first Preflight visit so a newly-invited teammate sees
  // their shared apps here immediately. Idempotent + best-effort.
  await activateInvitesForEmail(caller);
  if (!(await preflightDbReady())) return <SetupRequired />;
  // TEAM: the caller's OWN apps + any shared into workspaces they belong to. For a solo user this is exactly
  // their own apps (identical to before). Runs are resolved per-owner so no cross-member metering leak.
  const apps = await listApplicationsForMember(caller);
  const latest = await latestRunByAppForApps(apps);

  const readyCount = apps.filter((a) => latest[a.id]?.decision === "ready").length;
  const blockedCount = apps.filter((a) => latest[a.id]?.decision === "blocked").length;
  const untestedCount = apps.filter((a) => !latest[a.id]?.decision && !isActiveRun(latest[a.id])).length;

  return (
    <Page>
      {/* The nav says Systems and this page is what it opens, so it says Systems. "Vraelis Preflight" was an
          internal programme name no customer has ever been taught. The h1 used to declare its own
          clamp(1.7rem, 3vw, 2.4rem), one of six sizes across the console; the size is <PageHeader>'s now.
          The old .wrap also carried paddingTop: clamp(24px, 3vw, 40px), which the shell has been overriding
          with !important for as long as it has existed, so it is simply gone rather than moved. */}
      <PageHeader
        title="Systems"
        lead="Connect an AI-built system and Vraelis looks for failures in the flows you approve, before your users hit them."
        actions={<Link href="/systems/new" className="btn" style={{ flex: "none" }}>Connect a system <span aria-hidden>&rarr;</span></Link>}
      />

      {/* <Page> deliberately owns only the measure and the shell only overrides padding-TOP, so the tail room
          this list has always had is kept here, on the content, rather than on the .wrap. */}
      <div style={{ paddingBottom: 80 }}>
        {apps.length === 0 ? (
          <div className="empty">
            <EmptyIcon d={I.layers} />
            <h3>No systems yet</h3>
            <p>A verification walks your live system the way a user would, then reports which of your approved critical flows broke. Connect your first system to begin.</p>
            <Link href="/systems/new" className="btn">Connect a system</Link>
          </div>
        ) : (
          <>
            {/* The counters are unchanged; only the fourth one's NAME is. It called "Untested" the same state
                the pill beside it called "Not tested" and home-verdict.ts calls "Not yet verified", which is
                three names for one thing on one screen. Failed reads --stop-ink rather than --err for the
                same reason: both resolve to #FF7A55 here, but only one of them is the signal vocabulary. */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
              <StatChip label="Systems" value={apps.length} />
              <StatChip label="Verified" value={readyCount} color={readyCount ? "var(--go-ink)" : undefined} />
              <StatChip label="Failed" value={blockedCount} color={blockedCount ? "var(--stop-ink)" : undefined} />
              <StatChip label="Not yet verified" value={untestedCount} />
            </div>

            {/* app cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(288px, 1fr))", gap: 12 }}>
              {apps.map((a) => <SystemCard key={a.id} system={a} run={latest[a.id]} />)}
            </div>
          </>
        )}
      </div>
    </Page>
  );
}
