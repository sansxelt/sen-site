import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { ensureProfile, getPlan } from "@/lib/v-db";
import { ensureSignupGrant, balance } from "@/lib/v-credits";
import { isAdmin } from "@/lib/v-entitlements";
import { getDomainAccessForEmail } from "@/lib/v-organization";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { listApplicationsForMember, latestRunByAppForApps, type Application } from "@/lib/v-applications";
import { listAllRuns, listAllIssues, overviewCounts, type PassRow, type IssueRow } from "@/lib/preflight/overview-db";
import { getDisplayName } from "@/lib/v-account-profile";
import { DecisionMark } from "@/app/rank/_components/icons";
import { Composer } from "./_components/composer";

export const metadata: Metadata = { title: "Home" };

// Per-request render: this page branches on auth() (signed-in home vs the signed-out hero). Without this pin
// a session-less prerendered shell can be cached and shown to a signed-in user.
export const dynamic = "force-dynamic";

const headLbl = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--fg-4)" };

const ACTIVE_RUN_STATES = new Set(["queued", "discovering", "running", "analyzing"]);
const isActiveRun = (run: { decision: string | null; state: string } | null | undefined): boolean =>
  !!run && !run.decision && ACTIVE_RUN_STATES.has(run.state);

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const SEV_COLOR: Record<string, string> = { critical: "var(--a-failed, #A8452A)", high: "#B45309", medium: "var(--fg-3)", low: "var(--fg-4)" };

// Internal run decision -> public verdict. The interface only ever renders Verified / Failed / Blocked.
function verdict(run: { decision: string | null; state: string } | null | undefined): { label: string; color: string; bg: string; border: string } {
  switch (run?.decision) {
    case "ready":
    case "repair_verified":
      return { label: "Verified", color: "var(--acc-deep)", bg: "var(--acc-soft)", border: "var(--acc-line)" };
    case "needs_review":
      return { label: "Blocked", color: "var(--a-blocked, #7E6F43)", bg: "#F2ECDD", border: "#E4D9BE" };
    case "blocked":
      return { label: "Failed", color: "var(--a-failed, #A8452A)", bg: "#F6ECE7", border: "#E7CFC5" };
    default:
      if (isActiveRun(run)) return { label: "In progress", color: "var(--fg-3)", bg: "var(--bg-2)", border: "var(--line-2)" };
      return { label: "Not verified", color: "var(--fg-4)", bg: "var(--bg-2)", border: "var(--line-2)" };
  }
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
  const [bal, plan, domainAccess, apps, counts, recent, openIssues, displayName] = await Promise.all([
    balance(email), getPlan(email), getDomainAccessForEmail(email),
    preflightReady ? listApplicationsForMember(email) : Promise.resolve([] as Application[]),
    preflightReady ? overviewCounts(owner) : Promise.resolve({ openCriticalIssues: 0, runningPasses: 0, verifiedRepairs: 0 }),
    preflightReady ? listAllRuns(owner, 6) : Promise.resolve([] as PassRow[]),
    preflightReady ? listAllIssues(owner, { status: "open", limit: 4 }) : Promise.resolve([] as IssueRow[]),
    getDisplayName(email),
  ]);
  const latest = apps.length ? await latestRunByAppForApps(apps) : {};
  const planName = plan === "free" ? "Free" : plan.charAt(0).toUpperCase() + plan.slice(1);
  const needsProof = apps.filter((a) => latest[a.id]?.decision === "blocked" || latest[a.id]?.decision === "needs_review").length;
  const attention = openIssues.filter((i) => i.severity === "critical" || i.severity === "high");

  return (
    <div className="wrap" style={{ maxWidth: 1080, paddingTop: "clamp(20px, 2.6vw, 32px)", paddingBottom: 80, display: "flex", flexDirection: "column", gap: 26 }}>
      {/* Compact context line. The person and their standing, not a dashboard of tiles. */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--fg-2)", margin: 0, letterSpacing: "-0.01em" }}>
          {displayName ? `Welcome back, ${displayName}` : "Welcome back"}
        </h2>
        <span style={{ flex: 1 }} />
        <span className="badge-now">{planName} plan</span>
        {counts.runningPasses > 0 && (
          <Link href="/verifications" style={{ fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 500 }}>
            {counts.runningPasses} running →
          </Link>
        )}
        {isAdmin(email) && <Link href="/app/admin" style={{ fontSize: 12.5, color: "var(--fg-4)" }}>Admin</Link>}
      </div>

      {/* Primary action: the composer. Naming what must be true, not asking an AI. */}
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

      {/* Needs attention: the open critical/high failures standing between a system and Verified. */}
      {attention.length > 0 && (
        <section>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={headLbl}>Needs attention ({attention.length})</div>
            <Link href="/verifications" style={{ fontSize: 13, color: "var(--acc-deep)" }}>All failures →</Link>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {attention.map((iss) => (
              <Link key={iss.id} href={`/applications/${iss.applicationId}`}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", border: "1px solid var(--line-2)", borderLeft: `3px solid ${SEV_COLOR[iss.severity] ?? "var(--fg-4)"}`, borderRadius: "var(--r-sm)", background: "var(--bg-1)", color: "inherit" }}>
                <span className="pill" style={{ fontSize: 10, color: SEV_COLOR[iss.severity] ?? "var(--fg-4)", borderColor: "var(--line-2)", background: "var(--bg-2)", flex: "none" }}>{iss.severity}</span>
                <span style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{iss.title}</span>
                <span style={{ fontSize: 12, color: "var(--fg-4)", flex: "none" }}>{iss.applicationName}</span>
                <span aria-hidden style={{ color: "var(--fg-5)", flex: "none" }}>→</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent verifications: the real record. */}
      {recent.length > 0 ? (
        <section>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={headLbl}>Recent verifications</div>
            <Link href="/verifications" style={{ fontSize: 13, color: "var(--acc-deep)" }}>View all →</Link>
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden", background: "var(--bg-1)" }}>
            {recent.map((p, i) => {
              const v = verdict(p);
              return (
                <Link key={p.id} href={`/applications/${p.applicationId}/passes/${p.id}`}
                  style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 16, alignItems: "center", padding: "13px 16px", borderTop: i ? "1px solid var(--line-2)" : "none", color: "inherit" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.applicationName || "Verification"}</div>
                    <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{timeAgo(p.completedAt ?? p.createdAt)}{p.flowsTotal > 0 ? ` · ${p.flowsPassed}/${p.flowsTotal} flows` : ""}</div>
                  </div>
                  <span className="pill" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: v.color, background: v.bg, borderColor: v.border, flex: "none" }}><DecisionMark decision={p.decision} />{v.label}</span>
                  <span aria-hidden style={{ color: "var(--fg-5)", flex: "none" }}>→</span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : (
        <section aria-label="First verification" style={{ padding: "18px 20px", border: "1px dashed var(--line-3)", borderRadius: "var(--r-lg, 14px)", background: "var(--bg-2)", color: "var(--fg-3)", fontSize: 13.5, lineHeight: 1.55 }}>
          No verifications yet. Name a deployment and the outcome it should prove above, and your first record appears here. Your first verification is free.
        </section>
      )}

      {/* Systems: a quiet link, not a tile wall. */}
      {apps.length > 0 && (
        <div style={{ fontSize: 13, color: "var(--fg-4)", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span>{apps.length} system{apps.length === 1 ? "" : "s"} connected{needsProof > 0 ? `, ${needsProof} need proof on the latest deployment` : ""}.</span>
          <Link href="/systems" style={{ color: "var(--acc-deep)" }}>Open Systems →</Link>
        </div>
      )}
    </div>
  );
}
