import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { ensureProfile, getPlan } from "@/lib/v-db";
import { ensureSignupGrant, balance } from "@/lib/v-credits";
import { isAdmin } from "@/lib/v-entitlements";
import { getDomainAccessForEmail } from "@/lib/v-organization";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { listApplicationsForMember, latestRunByAppForApps, type Application, type RunSummary } from "@/lib/v-applications";
import { listAllRuns, listAllIssues, overviewCounts, type PassRow, type IssueRow, type OverviewCounts } from "@/lib/preflight/overview-db";
import { getDisplayName } from "@/lib/v-account-profile";
import { Composer } from "./_components/composer";
import {
  HomeAttention, RunningWork, RecentVerifications, SystemsSummary, EmptyHome, isActiveRun,
  type SystemSummaryItem,
} from "./_components/home-records";

export const metadata: Metadata = { title: "Home" };

// Per-request render: this page branches on auth() (signed-in home vs the signed-out hero). Without this pin
// a session-less prerendered shell can be cached and shown to a signed-in user. It is also what makes a
// workspace switch (a full navigation) always re-read fresh server state — there is no client cache of these
// records to leave stale.
export const dynamic = "force-dynamic";

// A record group is loaded independently and its failure is isolated: one section that cannot load must not
// take down the composer or the other sections. Each helper already degrades to []/0 internally; this catches
// the unexpected throw on top of that so the page still renders.
async function settle<T>(p: Promise<T>, fallback: T): Promise<{ value: T; error: boolean }> {
  try { return { value: await p, error: false }; }
  catch { return { value: fallback, error: true }; }
}

export default async function Home() {
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

  // Account basics (fast, per-individual by design — balance and plan are owner-anchored, never re-keyed by
  // workspace). These are the page's spine; the record groups below load and fail independently.
  const [bal, plan, domainAccess, displayName] = await Promise.all([
    balance(email), getPlan(email), getDomainAccessForEmail(email), getDisplayName(email),
  ]);

  // Record groups, each settled so one failure degrades only its own section. Issues are fetched web-scoped so
  // the needs-attention list and the running/verified badges count the same population. Runs are fetched a
  // little deeper than shown so a currently-running record (newest by created_at) is captured alongside recent.
  const emptyCounts: OverviewCounts = { openCriticalIssues: 0, runningPasses: 0, verifiedRepairs: 0 };
  const [appsR, countsR, runsR, issuesR] = await Promise.all([
    settle(preflightReady ? listApplicationsForMember(email) : Promise.resolve([] as Application[]), [] as Application[]),
    settle(preflightReady ? overviewCounts(owner) : Promise.resolve(emptyCounts), emptyCounts),
    settle(preflightReady ? listAllRuns(owner, 8) : Promise.resolve([] as PassRow[]), [] as PassRow[]),
    settle(preflightReady ? listAllIssues(owner, { status: "open", webOnly: true, limit: 12 }) : Promise.resolve([] as IssueRow[]), [] as IssueRow[]),
  ]);
  const apps = appsR.value;
  const latestR = await settle(apps.length ? latestRunByAppForApps(apps) : Promise.resolve({} as Record<string, RunSummary>), {} as Record<string, RunSummary>);

  const planName = plan === "free" ? "Free" : plan.charAt(0).toUpperCase() + plan.slice(1);

  // Split the run window into what is still running vs what has settled. runningPasses is the authoritative
  // count; the rows are whatever running records fell inside the recent window.
  const runningRows = runsR.value.filter(isActiveRun);
  const settledRuns = runsR.value.filter((r) => !isActiveRun(r)).slice(0, 6);
  const runningCount = countsR.value.runningPasses;

  const attention = issuesR.value.filter((i) => i.severity === "critical" || i.severity === "high").slice(0, 4);

  const systems: SystemSummaryItem[] = apps.map((a) => {
    const run = latestR.value[a.id];
    return { id: a.id, name: a.name, state: run?.state ?? null, decision: run?.decision ?? null, deploymentUrl: run?.deployment_url ?? null };
  });

  // Truly empty means: nothing to act on AND nothing failed to load (a load failure is degraded, not empty, so
  // we must not hide it behind onboarding).
  const anyError = appsR.error || countsR.error || runsR.error || issuesR.error || latestR.error;
  const fullyEmpty = !anyError && apps.length === 0 && runsR.value.length === 0 && runningCount === 0 && attention.length === 0;

  return (
    <div className="wrap" style={{ maxWidth: 1080, paddingTop: "clamp(20px, 2.6vw, 32px)", paddingBottom: 80, display: "flex", flexDirection: "column", gap: 26 }}>
      {/* Compact context line: the person and their standing, not a dashboard of tiles. */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 15, fontWeight: 600, color: "var(--fg-2)", margin: 0, letterSpacing: "-0.01em" }}>
          {displayName ? `Welcome back, ${displayName}` : "Welcome back"}
        </h1>
        <span style={{ flex: 1 }} />
        <span className="badge-now">{planName} plan</span>
        {isAdmin(email) && <Link href="/app/admin" style={{ fontSize: 12.5, color: "var(--fg-4)" }}>Admin</Link>}
      </div>

      {/* Primary action, visually dominant: the composer. */}
      <Composer balance={bal} />

      {domainAccess.length > 0 && (
        <Link href="/organization" className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", color: "inherit", background: "var(--bg-2)" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14.5 }}>You may belong to {domainAccess[0].name}</div>
            <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 2 }}>Your email domain matches a verified organization. {domainAccess[0].requestStatus === "pending" ? "Your request is pending admin approval." : "Request access to join."}</div>
          </div>
          <span style={{ fontSize: 13, color: "var(--acc-deep)", whiteSpace: "nowrap" }}>{domainAccess[0].requestStatus === "pending" ? "View →" : "Request access →"}</span>
        </Link>
      )}

      {fullyEmpty ? (
        <EmptyHome />
      ) : (
        <>
          <HomeAttention issues={attention} error={issuesR.error} />
          <RunningWork rows={runningRows} count={runningCount} error={countsR.error} />
          <RecentVerifications rows={settledRuns} error={runsR.error} />
          <SystemsSummary systems={systems} error={appsR.error || latestR.error} />
        </>
      )}
    </div>
  );
}
