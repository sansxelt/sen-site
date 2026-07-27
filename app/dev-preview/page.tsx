// DEVELOPMENT-ONLY deterministic preview of Home's operational states, for Increment 5 visual review.
//
// This is not a customer surface and holds no real records. It renders the SAME prop-driven Home components
// against fixed fixtures so the empty, populated, running, needs-proof, and degraded states can be reviewed
// without an authenticated session or any production data.
//
// Safety: it is gated with notFound() unless NODE_ENV is development, so it 404s in every preview/production
// build regardless of how it is reached — there is no query string that can enable it. It lives at a top-level
// path (not under /rank/app and not an APP_ROOT) purely so the app proxy leaves it alone in local dev; that
// same fact means the app host redirects it to the marketing host, where the gate then 404s it. It performs
// no reads or writes and touches no secret. Final authenticated capture still belongs to a real session.
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { PassRow, IssueRow } from "@/lib/preflight/overview-db";
import { HomeAttention, RunningWork, RecentVerifications, SystemsSummary, EmptyHome, type SystemSummaryItem } from "@/app/rank/app/_components/home-records";
import { Composer } from "@/app/rank/app/_components/composer";

export const metadata: Metadata = { title: "Home preview (dev)", robots: { index: false, follow: false } };

// Fixed offsets from render time keep the preview stable to review.
const H = 3600_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

const pass = (o: Partial<PassRow> & { id: string }): PassRow => ({
  id: o.id, applicationId: o.applicationId ?? "app-" + o.id, applicationName: o.applicationName ?? "Example System",
  state: o.state ?? "completed", decision: o.decision ?? null, deploymentUrl: o.deploymentUrl ?? null, parentRunId: null, invalidatedAt: o.invalidatedAt ?? null,
  createdAt: o.createdAt ?? ago(2 * H), completedAt: o.completedAt ?? ago(2 * H),
  flowsTotal: o.flowsTotal ?? 0, flowsPassed: o.flowsPassed ?? 0, criticalTotal: o.criticalTotal ?? 0, criticalPassed: o.criticalPassed ?? 0,
});
const issue = (o: Partial<IssueRow> & { id: string; title: string }): IssueRow => ({
  id: o.id, applicationId: o.applicationId ?? "app-x", applicationName: o.applicationName ?? "Checkout App",
  severity: o.severity ?? "critical", category: o.category ?? null, title: o.title, status: "open",
  firstSeenRun: null, lastSeenRun: null, resolvedRun: null, flowId: null, createdAt: o.createdAt ?? ago(3 * H),
});

const ATTENTION: IssueRow[] = [
  issue({ id: "i1", title: "Checkout completed, but the account remained on the Free plan", severity: "critical", applicationName: "Payments" }),
  issue({ id: "i2", title: "The latest deployment has not been verified", severity: "high", applicationName: "Marketing site" }),
];
const RUNNING: PassRow[] = [pass({ id: "r-run", applicationName: "Payments", state: "running", deploymentUrl: "https://pay.example.app", createdAt: ago(4 * 60_000) })];
const RECENT: PassRow[] = [
  pass({ id: "r1", applicationName: "Payments", decision: "ready", deploymentUrl: "https://pay.example.app", flowsTotal: 5, flowsPassed: 5, completedAt: ago(2 * H) }),
  pass({ id: "r2", applicationName: "Checkout App with a deliberately long product name that must truncate", decision: "blocked", deploymentUrl: "https://checkout.a-very-long-deployment-hostname.example.app", flowsTotal: 6, flowsPassed: 4, completedAt: ago(5 * H) }),
  pass({ id: "r3", applicationName: "Docs portal", decision: "needs_review", deploymentUrl: "https://docs.example.app", flowsTotal: 3, flowsPassed: 3, completedAt: ago(26 * H) }),
  pass({ id: "r4", applicationName: "Onboarding", decision: "repair_verified", deploymentUrl: "https://app.example.app", flowsTotal: 4, flowsPassed: 4, completedAt: ago(50 * H) }),
];
const SYSTEMS: SystemSummaryItem[] = [
  { id: "s1", name: "Payments", state: "completed", decision: "ready", deploymentUrl: "https://pay.example.app" },
  { id: "s2", name: "Checkout App", state: "completed", decision: "blocked", deploymentUrl: "https://checkout.example.app" },
  { id: "s3", name: "New service", state: null, decision: null, deploymentUrl: null },
];

function Scene({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 44 }}>
      <div style={{ fontFamily: "var(--font-code)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fg-4)", borderBottom: "1px solid var(--line-2)", paddingBottom: 6, marginBottom: 16 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>{children}</div>
    </section>
  );
}

export default function HomePreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    // Render inside the authenticated token boundary (the same wrapper app/rank/app/layout.tsx applies), with
    // the authenticated stylesheet, so the preview shows the real warm-neutral product surface.
    <>
      <link rel="stylesheet" href="/vraelis/authenticated.css?v=1" />
      <div data-surface="app" style={{ minHeight: "100vh", background: "var(--bg-0)" }}>
        <div className="wrap" style={{ maxWidth: 1080, paddingTop: 28, paddingBottom: 80 }}>
          <p style={{ fontSize: 13, color: "var(--fg-3)", marginBottom: 26, padding: "10px 14px", border: "1px dashed var(--line-3)", borderRadius: 10, background: "var(--bg-2)" }}>
            Development preview. These are fixtures for visual review, not real records.
          </p>
          <Scene title="Composer — the primary action (compose state)">
            <Composer balance={240} />
          </Scene>
          <Scene title="Populated — attention, running, recent, systems">
            <HomeAttention issues={ATTENTION} />
            <RunningWork rows={RUNNING} count={1} />
            <RecentVerifications rows={RECENT} />
            <SystemsSummary systems={SYSTEMS} />
          </Scene>
          <Scene title="Running count exceeds shown rows">
            <RunningWork rows={RUNNING} count={3} />
          </Scene>
          <Scene title="Empty account — onboarding">
            <EmptyHome />
          </Scene>
          <Scene title="Degraded — one section failed to load, others unaffected">
            <HomeAttention issues={[]} error />
            <RecentVerifications rows={RECENT} />
            <SystemsSummary systems={[]} error />
          </Scene>
        </div>
      </div>
    </>
  );
}
