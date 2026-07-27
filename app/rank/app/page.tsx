import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { ensureProfile } from "@/lib/v-db";
import { ensureSignupGrant, balance } from "@/lib/v-credits";
import { isAdmin } from "@/lib/v-entitlements";
import { getDomainAccessForEmail } from "@/lib/v-organization";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { listApplicationsForMember, latestRunByAppForApps, type Application, type RunSummary } from "@/lib/v-applications";
import { listAllRuns, listAllIssues, listRepairs, overviewCounts, type PassRow, type IssueRow, type RepairRow, type OverviewCounts } from "@/lib/preflight/overview-db";
import { listPendingReviews, type PendingReviewRow } from "@/lib/preflight/reviewed-plan-db";
import { listGuaranteesForApps } from "@/lib/preflight/guarantees-db";
import { toPublicDecision } from "@/lib/preflight/public-decision";
import { systemProof, isActiveRun } from "@/lib/preflight/home-verdict";
import { Composer } from "./_components/composer";
import { CompactComposer } from "./_components/compact-composer";
import { SectionError } from "./_components/home-records";
import {
  OperationalState, NeedsAttention, SystemsTable, PendingReview, RecentVerificationsTable,
  EmptyOverview, OVERVIEW_CSS, type AttentionItem, type SystemRow,
} from "./_components/overview-sections";

export const metadata: Metadata = { title: "Overview" };

// Per-request render: this page branches on auth() (signed-in overview vs the signed-out hero). Without this
// pin a session-less prerendered shell can be cached and shown to a signed-in user. It is also what makes a
// workspace switch (a full navigation) always re-read fresh server state.
export const dynamic = "force-dynamic";

// A record group is loaded independently and its failure is isolated: one section that cannot load must not
// take down the rest. Each helper already degrades internally; this catches the unexpected throw on top.
async function settle<T>(p: Promise<T>, fallback: T): Promise<{ value: T; error: boolean }> {
  try { return { value: await p, error: false }; }
  catch { return { value: fallback, error: true }; }
}

// Guarantees across systems the member can see, one query per distinct SYSTEM OWNER. Every guarantee read is
// scoped to user_id, and a member's visible systems can belong to several people, so a single call with the
// caller's own id would silently return nothing for shared systems.
async function guaranteesForMemberApps(apps: Application[]) {
  const byOwner = new Map<string, string[]>();
  for (const a of apps) byOwner.set(a.user_id, [...(byOwner.get(a.user_id) ?? []), a.id]);
  const groups = await Promise.all(Array.from(byOwner.entries()).map(([o, ids]) => listGuaranteesForApps(o, ids)));
  return groups.flat();
}

export default async function Overview() {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return (
      <section className="section" style={{ borderBottom: "none" }}>
        <div className="wrap" style={{ maxWidth: 520, textAlign: "center" }}>
          <p className="eyebrow" style={{ justifyContent: "center" }}>Workspace</p>
          <h1 className="display" style={{ fontSize: "clamp(1.9rem, 4vw, 2.8rem)", marginBottom: 14 }}>
            Prove what your build <span className="em">claims</span>.
          </h1>
          <p className="lead-copy" style={{ margin: "0 auto 26px" }}>
            Sign in to name a deployed outcome and get a decision, backed by evidence, before your users find the failures.
          </p>
          <Link href="/signin?callbackUrl=%2Fapp" className="btn btn--lg">Sign in</Link>
        </div>
      </section>
    );
  }

  await ensureProfile(email, session.user?.name ?? undefined);
  await ensureSignupGrant(email);

  const owner = email.toLowerCase();
  const preflightReady = await preflightDbReady();
  const emptyCounts: OverviewCounts = { openCriticalIssues: 0, runningPasses: 0, verifiedRepairs: 0 };

  const [bal, domainAccess] = await Promise.all([balance(email), getDomainAccessForEmail(email)]);

  // Record groups, each settled so one failure degrades only its own section. Runs are fetched deeper than
  // shown because "last proven" is derived from the same window: a system's most recent VERIFIED run.
  const [appsR, countsR, runsR, issuesR, repairsR, pendingR] = await Promise.all([
    settle(preflightReady ? listApplicationsForMember(email) : Promise.resolve([] as Application[]), [] as Application[]),
    settle(preflightReady ? overviewCounts(owner) : Promise.resolve(emptyCounts), emptyCounts),
    settle(preflightReady ? listAllRuns(owner, 60) : Promise.resolve([] as PassRow[]), [] as PassRow[]),
    // The limit is applied in SQL BEFORE any grouping, so it bounds the per-system critical counts below.
    // 200 is far above any real open-issue population here (production holds 14 in total) and keeps the
    // counts exact; a tight limit would silently under-report a busy system rather than fail visibly.
    settle(preflightReady ? listAllIssues(owner, { status: "open", webOnly: true, limit: 200 }) : Promise.resolve([] as IssueRow[]), [] as IssueRow[]),
    settle(preflightReady ? listRepairs(owner, 60) : Promise.resolve([] as RepairRow[]), [] as RepairRow[]),
    settle(preflightReady ? listPendingReviews(owner, undefined, 5) : Promise.resolve([] as PendingReviewRow[]), [] as PendingReviewRow[]),
  ]);
  const apps = appsR.value;
  const [latestR, guaranteesR] = await Promise.all([
    settle(apps.length ? latestRunByAppForApps(apps) : Promise.resolve({} as Record<string, RunSummary>), {} as Record<string, RunSummary>),
    // Grouped by the SYSTEM's owner, not the caller: listApplicationsForMember returns shared systems too,
    // and guarantee reads are scoped to user_id, so filtering the whole set by the caller's own id would
    // count zero guarantees on every teammate's system.
    settle(guaranteesForMemberApps(apps), [] as Awaited<ReturnType<typeof listGuaranteesForApps>>),
  ]);

  // LAST PROVEN, derived rather than stored. The newest run for a system whose PUBLIC decision is "verified"
  // — through the same translator every other surface uses, so this can never disagree with the pill beside
  // it. Bounded by the loaded window: absent here means "not within recent history", which is why the UI
  // renders an em dash rather than the word "never".
  const lastProvenByApp = new Map<string, string>();
  for (const r of runsR.value) {
    if (toPublicDecision(r.state, r.decision) !== "verified") continue;
    const at = r.completedAt ?? r.createdAt;
    const prev = lastProvenByApp.get(r.applicationId);
    if (!prev || at > prev) lastProvenByApp.set(r.applicationId, at);
  }

  const openCriticalByApp = new Map<string, number>();
  for (const i of issuesR.value) {
    if (i.severity !== "critical") continue;
    openCriticalByApp.set(i.applicationId, (openCriticalByApp.get(i.applicationId) ?? 0) + 1);
  }

  const guaranteesByApp = new Map<string, number>();
  for (const g of guaranteesR.value) guaranteesByApp.set(g.application_id, (guaranteesByApp.get(g.application_id) ?? 0) + 1);

  // The newest repair per issue: the list is already newest-first, so the first one wins.
  const repairByIssue = new Map<string, RepairRow>();
  for (const r of repairsR.value) if (!repairByIssue.has(r.issueId)) repairByIssue.set(r.issueId, r);

  const systems: SystemRow[] = apps.map((a) => {
    const run = latestR.value[a.id];
    return {
      id: a.id, name: a.name,
      guarantees: guaranteesByApp.get(a.id) ?? 0,
      verdict: systemProof(run ? { state: run.state, decision: run.decision } : null).verdict,
      criticals: openCriticalByApp.get(a.id) ?? 0,
      lastProven: lastProvenByApp.get(a.id) ?? null,
      deploymentUrl: run?.deployment_url ?? null,
    };
  });

  const attention: AttentionItem[] = issuesR.value
    .filter((i) => i.severity === "critical" || i.severity === "high")
    .slice(0, 5)
    .map((issue) => {
      const run = latestR.value[issue.applicationId];
      return {
        issue,
        repair: repairByIssue.get(issue.id) ?? null,
        lastProven: lastProvenByApp.get(issue.applicationId) ?? null,
        systemVerdict: run ? systemProof({ state: run.state, decision: run.decision }).verdict : null,
      };
    });

  const criticalCount = issuesR.value.filter((i) => i.severity === "critical").length;
  const systemsAffected = new Set(issuesR.value.filter((i) => i.severity === "critical").map((i) => i.applicationId)).size;
  const settledRuns = runsR.value.filter((r) => !isActiveRun(r)).slice(0, 8);

  const anyError = appsR.error || countsR.error || runsR.error || issuesR.error || latestR.error;
  const fullyEmpty = !anyError && apps.length === 0 && runsR.value.length === 0
    && countsR.value.runningPasses === 0 && attention.length === 0 && pendingR.value.length === 0;

  return (
    <div className="wrap" style={{ maxWidth: 1080, paddingTop: "clamp(20px, 2.6vw, 32px)", paddingBottom: 80 }}>
      <style dangerouslySetInnerHTML={{ __html: OVERVIEW_CSS }} />

      <OperationalState
        criticals={criticalCount}
        systemsAffected={systemsAffected}
        pendingReviews={pendingR.value.length}
        running={countsR.value.runningPasses}
      />

      {domainAccess.length > 0 && (
        <Link href="/organization" className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", color: "inherit", background: "var(--bg-2)", marginBottom: 26 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14.5 }}>You may belong to {domainAccess[0].name}</div>
            <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 2 }}>Your email domain matches a verified organization. {domainAccess[0].requestStatus === "pending" ? "Your request is pending admin approval." : "Request access to join."}</div>
          </div>
          <span style={{ fontSize: 13, color: "var(--acc-deep)", whiteSpace: "nowrap" }}>{domainAccess[0].requestStatus === "pending" ? "View →" : "Request access →"}</span>
        </Link>
      )}

      {fullyEmpty ? (
        // An empty account gets the form at full size: there is no state to read, so the only useful thing
        // on the page is the way to create some.
        <>
          <div style={{ marginBottom: 26 }}><Composer balance={bal} /></div>
          <EmptyOverview />
        </>
      ) : (
        <>
          {issuesR.error ? <SectionError label="Needs attention" /> : <NeedsAttention items={attention} />}
          {appsR.error || latestR.error ? <SectionError label="Systems" /> : <SystemsTable rows={systems} />}
          {pendingR.error ? <SectionError label="Pending review" /> : <PendingReview rows={pendingR.value} />}
          {runsR.error ? <SectionError label="Recent verifications" /> : <RecentVerificationsTable rows={settledRuns} />}
          <CompactComposer balance={bal} />
        </>
      )}

      {/* Staff-only, and deliberately the least prominent thing on the page: it is not part of the product
          model and does not belong among the objects a customer reads. */}
      {isAdmin(email) && (
        <p style={{ marginTop: 28 }}><Link href="/app/admin" style={{ fontSize: 12, color: "var(--fg-5)", textDecoration: "none" }}>Admin</Link></p>
      )}
    </div>
  );
}
