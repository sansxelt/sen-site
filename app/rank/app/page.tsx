import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { ensureProfile, getPlan } from "@/lib/v-db";
import { ensureSignupGrant, balance } from "@/lib/v-credits";
import { isAdmin } from "@/lib/v-entitlements";
import { resolveWorkspaceSelection, workspaceProjectSummaries } from "@/lib/v-workspace";
import { getDomainAccessForEmail } from "@/lib/v-organization";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { listApplicationsForMember, latestRunByAppForApps, type Application, type RunSummary } from "@/lib/v-applications";
import { listAllRuns, listAllIssues, overviewCounts, type PassRow, type IssueRow } from "@/lib/preflight/overview-db";
import { WorkspaceMemberView } from "./_workspace/workspace-member-view";
import { DecisionMark } from "@/app/rank/_components/icons";

export const metadata: Metadata = { title: "Dashboard" };

// Per-request render: this page branches on auth() (signed-in dashboard vs the signed-out "Continue with
// Google" hero). Without this pin it can be served from a session-less prerendered shell, showing the
// signed-out hero to a signed-in user while the client-resolved topbar shows the signed-in menu. Belt-
// and-suspenders with the same export on app/rank/layout.tsx.
export const dynamic = "force-dynamic";

const headLbl = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--fg-4)", marginBottom: 12 };

const ACTIVE_RUN_STATES = new Set(["queued", "discovering", "running", "analyzing"]);
const isActiveRun = (run: { decision: string | null; state: string } | null | undefined): boolean => !!run && !run.decision && ACTIVE_RUN_STATES.has(run.state);

// "3m ago / 4h ago / Jul 12" (server component; rendered once per request).
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

const SEV_COLOR: Record<string, string> = { critical: "#C0392B", high: "#B45309", medium: "var(--fg-3)", low: "var(--fg-4)" };

function decisionStyle(run: { decision: string | null; state: string } | null | undefined): { label: string; color: string; bg: string; border: string } {
  switch (run?.decision) {
    case "ready": return { label: "Ready", color: "var(--acc-deep)", bg: "var(--acc-soft)", border: "var(--acc-line)" };
    case "repair_verified": return { label: "Repair verified", color: "var(--acc-deep)", bg: "var(--acc-soft)", border: "var(--acc-line)" };
    case "needs_review": return { label: "Needs review", color: "#B45309", bg: "#FEF6E7", border: "#F3DFB0" };
    case "blocked": return { label: "Blocked", color: "#C0392B", bg: "#FBEBEA", border: "#F0C7C2" };
    default:
      if (isActiveRun(run)) return { label: "In progress", color: "var(--acc-deep)", bg: "var(--acc-soft)", border: "var(--acc-line)" };
      return { label: "Not tested", color: "var(--fg-4)", bg: "var(--bg-2)", border: "var(--line-2)" };
  }
}

function AppCard({ app, run }: { app: Application; run: RunSummary | undefined }) {
  const st = decisionStyle(run);
  return (
    <Link href={`/applications/${app.id}`} className="acard" style={{ textDecoration: "none", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div className="acard__t" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{app.name}</div>
          <div style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.app_url}</div>
        </div>
        <span className="pill" style={{ fontSize: 10, color: st.color, background: st.bg, borderColor: st.border, flex: "none" }}><DecisionMark decision={run?.decision} />{st.label}</span>
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--acc-deep)", marginTop: "auto" }}>Open <span aria-hidden>→</span></span>
    </Link>
  );
}

export default async function Dashboard() {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return (
      <section className="section" style={{ borderBottom: "none" }}>
        <div className="wrap" style={{ maxWidth: 520, textAlign: "center" }}>
          <p className="eyebrow" style={{ justifyContent: "center" }}>Workspace</p>
          <h1 className="display" style={{ fontSize: "clamp(1.9rem, 4vw, 2.8rem)", marginBottom: 14 }}>Finish the engineering <span className="em">AI left behind</span>.</h1>
          <p className="lead-copy" style={{ margin: "0 auto 26px" }}>Sign in to connect your AI-built app and get a launch decision before your users find the blockers.</p>
          <Link href="/signin?callbackUrl=%2Fapp" className="btn btn--lg">Continue with Google</Link>
        </div>
      </section>
    );
  }

  await ensureProfile(email, session.user?.name ?? undefined);
  await ensureSignupGrant(email);

  const { selected } = await resolveWorkspaceSelection(email, (await cookies()).get("vws")?.value);
  if (selected && !selected.isPersonal) {
    return <WorkspaceMemberView selected={selected} summary={await workspaceProjectSummaries(selected)} variant="dashboard" />;
  }

  const owner = email.toLowerCase();
  const preflightReady = await preflightDbReady();
  const [bal, plan, domainAccess, apps, counts, recentPasses, openIssues] = await Promise.all([
    balance(email), getPlan(email), getDomainAccessForEmail(email),
    // App GRID includes shared apps (the caller's own + any workspace they belong to). The aggregate counts,
    // recent passes, and open issues below stay scoped to the caller's OWN activity (a teammate's shared-app
    // detail lives on the app pages + the applications list) — never showing MORE than the caller may see.
    preflightReady ? listApplicationsForMember(email) : Promise.resolve([] as Application[]),
    preflightReady ? overviewCounts(owner) : Promise.resolve({ openCriticalIssues: 0, runningPasses: 0, verifiedRepairs: 0 }),
    preflightReady ? listAllRuns(owner, 5) : Promise.resolve([] as PassRow[]),
    preflightReady ? listAllIssues(owner, { status: "open", limit: 5 }) : Promise.resolve([] as IssueRow[]),
  ]);
  const latest = apps.length ? await latestRunByAppForApps(apps) : {};
  const planName = plan === "free" ? "Free" : plan.charAt(0).toUpperCase() + plan.slice(1);

  const readyCount = apps.filter((a) => latest[a.id]?.decision === "ready").length;
  const blockedCount = apps.filter((a) => latest[a.id]?.decision === "blocked").length;
  const blockers = openIssues.filter((i) => i.severity === "critical" || i.severity === "high");

  return (
    <div className="wrap" style={{ maxWidth: 1280, paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Vraelis Preflight</p>
          <h1 className="display">Welcome back</h1>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="badge-now">{planName} plan</span>
          {isAdmin(email) && <Link href="/app/admin" style={{ fontSize: 13.5, color: "var(--fg-3)", textDecoration: "none" }}>Admin</Link>}
        </div>
      </div>

      {/* Primary action: connect an app and run a preflight. */}
      <Link href="/applications/new" className="card card--acc" style={{ position: "relative", overflow: "hidden", display: "block", textDecoration: "none", color: "inherit", marginBottom: 18, padding: "clamp(22px, 3vw, 32px)" }}>
        <div className="glow glow--soft" style={{ opacity: 0.7 }} />
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 560 }}>
            <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 8 }}>Connect an app</div>
            <h2 className="display" style={{ fontSize: "clamp(1.4rem, 2.8vw, 2rem)", marginBottom: 8 }}>Get a launch decision, not a bug list.</h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--fg-2)", margin: 0 }}>Vraelis runs your AI-built app like production, in a real browser, as two real users, and tells you what blocks the launch with the evidence to prove it.</p>
          </div>
          <span className="btn" style={{ flex: "none" }}>Connect an app <span aria-hidden>→</span></span>
        </div>
      </Link>

      {domainAccess.length > 0 && (
        <Link href="/organization" className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", textDecoration: "none", color: "inherit", marginBottom: 18, background: "var(--bg-2)" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14.5 }}>You may belong to {domainAccess[0].name}</div>
            <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 2 }}>Your email domain matches a verified organization domain. {domainAccess[0].requestStatus === "pending" ? "Your access request is pending admin approval." : "Request access to join this organization."}</div>
          </div>
          <span style={{ fontSize: 13, color: "var(--acc-deep)", whiteSpace: "nowrap" }}>{domainAccess[0].requestStatus === "pending" ? "View →" : "Request access →"}</span>
        </Link>
      )}

      {/* overview stats: the production posture, at a glance */}
      <div className="tile-grid cols-3" style={{ marginBottom: 24 }}>
        <div className="stat"><div className="stat__l">Applications</div><div className="stat__v tnum">{apps.length}</div><div className="stat__s"><Link href="/applications" style={{ color: "var(--acc-deep)", textDecoration: "none" }}>Open all →</Link></div></div>
        <div className="stat"><div className="stat__l">Ready</div><div className="stat__v tnum" style={{ color: readyCount ? "var(--acc-deep)" : undefined }}>{readyCount}</div><div className="stat__s">cleared to launch</div></div>
        <div className="stat"><div className="stat__l">Blocked</div><div className="stat__v tnum" style={{ color: blockedCount ? "#C0392B" : undefined }}>{blockedCount}</div><div className="stat__s">not ready yet</div></div>
        <div className="stat"><div className="stat__l">Open blockers</div><div className="stat__v tnum" style={{ color: counts.openCriticalIssues ? "#C0392B" : undefined }}>{counts.openCriticalIssues}</div><div className="stat__s"><Link href="/issues" style={{ color: "var(--acc-deep)", textDecoration: "none" }}>View issues →</Link></div></div>
        <div className="stat"><div className="stat__l">Passes running</div><div className="stat__v tnum">{counts.runningPasses}</div><div className="stat__s"><Link href="/passes" style={{ color: "var(--acc-deep)", textDecoration: "none" }}>View passes →</Link></div></div>
        <div className="stat"><div className="stat__l">Credits</div><div className="stat__v tnum">{bal.toLocaleString()}</div><div className="stat__s"><Link href="/credits" style={{ color: "var(--acc-deep)", textDecoration: "none" }}>Buy more →</Link></div></div>
      </div>

      {apps.length > 0 ? (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ ...headLbl, marginBottom: 0 }}>Your applications ({apps.length})</div>
            <Link href="/applications" style={{ fontSize: 13, color: "var(--acc-deep)", textDecoration: "none" }}>All applications →</Link>
          </div>
          <div className="tile-grid cols-3" style={{ marginBottom: 26 }}>
            {apps.slice(0, 6).map((a) => <AppCard key={a.id} app={a} run={latest[a.id]} />)}
          </div>
        </>
      ) : (
        <div style={{ position: "relative", overflow: "hidden", borderRadius: "var(--r-xl)", border: "1px solid var(--acc-line)", background: "var(--bg-1)", padding: "clamp(24px, 3.5vw, 38px)", marginBottom: 22, boxShadow: "var(--shadow-md)" }}>
          <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 8 }}>Your first Production Pass is free</div>
          <h2 className="display" style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)", marginBottom: 8 }}>Run your first preflight.</h2>
          <p style={{ fontSize: 15, lineHeight: 1.55, maxWidth: 560, color: "var(--fg-2)", marginBottom: 18 }}>Connect your deployed app, approve the critical flows, and Vraelis drives it in a real browser as two real users. You get one launch decision and the exact blockers behind it.</p>
          <div className="card" style={{ background: "var(--bg-2)", marginBottom: 18 }}>
            <div style={headLbl}>How a preflight works</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {([
                ["Connect your app", "Your deployed URL and the prompt you built it from"],
                ["Approve the Production Contract", "What the app must do, so Vraelis tests only what you sign off on"],
                ["Run it like production", "A real browser runs your flows as two users and captures evidence"],
                ["Get the Production Pass", "READY, NEEDS REVIEW, or BLOCKED, with repro steps and screenshots"],
                ["Repair with proof", "A fix prompt for your builder, then a rerun that confirms it is closed"],
              ] as [string, string][]).map(([label, sub], i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ flex: "none", width: 22, height: 22, borderRadius: "50%", border: "1.5px solid var(--line-3)", color: "var(--fg-4)", display: "grid", placeItems: "center", fontSize: 11, fontFamily: "var(--font-code)", marginTop: 1 }}>{i + 1}</span>
                  <div><div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>{label}</div><div style={{ fontSize: 12, color: "var(--fg-4)" }}>{sub}</div></div>
                </div>
              ))}
            </div>
          </div>
          <Link href="/applications/new" className="btn">Connect your first app <span aria-hidden>→</span></Link>
        </div>
      )}

      {/* Open blockers: the issues standing between an app and READY */}
      {blockers.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ ...headLbl, marginBottom: 0 }}>Open blockers ({blockers.length})</div>
            <Link href="/issues" style={{ fontSize: 13, color: "var(--acc-deep)", textDecoration: "none" }}>All issues →</Link>
          </div>
          <div style={{ display: "grid", gap: 8, marginBottom: 26 }}>
            {blockers.map((iss) => (
              <Link key={iss.id} href={`/applications/${iss.applicationId}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", border: "1px solid var(--line-2)", borderLeft: `3px solid ${SEV_COLOR[iss.severity] ?? "var(--fg-4)"}`, borderRadius: "var(--r-sm)", background: "var(--bg-1)", textDecoration: "none", color: "inherit" }}>
                <span className="pill" style={{ fontSize: 10, color: SEV_COLOR[iss.severity] ?? "var(--fg-4)", borderColor: "var(--line-2)", background: "var(--bg-2)", flex: "none" }}>{iss.severity}</span>
                <span style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{iss.title}</span>
                <span style={{ fontSize: 12, color: "var(--fg-4)", flex: "none" }}>{iss.applicationName}</span>
                <span aria-hidden style={{ color: "var(--fg-5)", flex: "none", fontSize: 13 }}>→</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Recent Production Passes */}
      {recentPasses.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ ...headLbl, marginBottom: 0 }}>Recent Production Passes</div>
            <Link href="/passes" style={{ fontSize: 13, color: "var(--acc-deep)", textDecoration: "none" }}>All passes →</Link>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {recentPasses.map((p) => {
              const st = decisionStyle(p);
              return (
                <Link key={p.id} href={`/applications/${p.applicationId}/passes/${p.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-1)", textDecoration: "none", color: "inherit" }}>
                  <span className="pill" style={{ fontSize: 10, color: st.color, background: st.bg, borderColor: st.border, flex: "none" }}><DecisionMark decision={p.decision} />{st.label}</span>
                  <span style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 500, flex: "none" }}>{p.applicationName || "Application"}</span>
                  {p.flowsTotal > 0 && <span style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-4)", flex: "none" }}>{p.flowsPassed}/{p.flowsTotal} flows</span>}
                  <span style={{ fontSize: 12, color: "var(--fg-4)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>{timeAgo(p.completedAt ?? p.createdAt)}</span>
                  <span aria-hidden style={{ color: "var(--fg-5)", flex: "none", fontSize: 13 }}>→</span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
