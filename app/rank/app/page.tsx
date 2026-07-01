import type { Metadata } from "next";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { ensureProfile, getPlan } from "@/lib/v-db";
import { ensureSignupGrant, balance } from "@/lib/v-credits";
import { isAdmin } from "@/lib/v-entitlements";
import { listProjects, listEvaluations, workspaceStats } from "@/lib/v-projects";
import { resolveWorkspaceSelection, workspaceProjectSummaries } from "@/lib/v-workspace";
import { getDomainAccessForEmail } from "@/lib/v-organization";
import { EvaluationList } from "./_workspace/evaluation-list";
import { NewProjectForm } from "./_workspace/workspace-client";
import { WorkspaceMemberView } from "./_workspace/workspace-member-view";

export const metadata: Metadata = { title: "Dashboard" };

const headLbl = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--fg-4)", marginBottom: 12 };

function FirstRun({ bal }: { bal: number }) {
  const steps: [string, string][] = [
    ["Define what you're deciding", "2 to 8 candidate options: images, AI outputs, copy, UI"],
    ["Collect qualified signal", "1 credit = 1 valid human judgment"],
    ["Gather human judgment", "Real evaluators weigh in, low-quality filtered"],
    ["Review the decision record", "Recommended option, margin, confidence, reasons"],
    ["Publish, export, or use the API", "A decision you can act on, share, or route anywhere"],
  ];
  return (
    <>
      <div style={{ position: "relative", overflow: "hidden", borderRadius: "var(--r-xl)", border: "1px solid var(--acc-line)", background: "var(--bg-1)", padding: "clamp(24px, 3.5vw, 38px)", marginBottom: 16, boxShadow: "var(--shadow-md)" }}>
        <div className="glow glow--soft" style={{ opacity: 0.7 }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 8 }}>Welcome to your workspace</div>
          <h2 className="display" style={{ fontSize: "clamp(1.5rem, 3vw, 2.1rem)", marginBottom: 8 }}>You have {bal} starter credits.</h2>
          <p style={{ fontSize: 15, lineHeight: 1.55, maxWidth: 560, color: "var(--fg-2)", marginBottom: 18 }}>Create your first decision program or run a workflow. Submit a few candidates — images, AI outputs, copy, landing heroes, UI — and qualified evaluators tell you which to ship. <strong style={{ color: "var(--fg-1)" }}>1 credit = 1 valid human judgment.</strong></p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/app/new" className="btn">Start first decision workflow →</a>
            <a href="/app/projects" className="btn btn--ghost">New decision program</a>
            <a href="/demo" className="btn btn--ghost">View a sample decision record</a>
          </div>
        </div>
      </div>
      <div className="card">
        <div style={headLbl}>How a decision workflow works</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {steps.map(([label, sub], i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ flex: "none", width: 22, height: 22, borderRadius: "50%", border: "1.5px solid var(--line-3)", color: "var(--fg-4)", display: "grid", placeItems: "center", fontSize: 11, fontFamily: "var(--font-code)", marginTop: 1 }}>{i + 1}</span>
              <div><div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>{label}</div><div style={{ fontSize: 12, color: "var(--fg-4)" }}>{sub}</div></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function QuickAction({ href, title, sub }: { href: string; title: string; sub: string }) {
  return (
    <a href={href} className="acard" style={{ textDecoration: "none", gap: 4 }}>
      <div className="acard__t" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>{title}<span style={{ color: "var(--acc-deep)" }} aria-hidden>→</span></div>
      <div className="acard__d">{sub}</div>
    </a>
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
          <h1 className="display" style={{ fontSize: "clamp(1.9rem, 4vw, 2.8rem)", marginBottom: 14 }}>Your <span className="em">decisions</span>.</h1>
          <p className="lead-copy" style={{ margin: "0 auto 26px" }}>Sign in to run decision workflows, organize them into programs, and see your decision records.</p>
          <a href="/signin?callbackUrl=%2Fapp" className="btn btn--lg">Continue with Google</a>
        </div>
      </section>
    );
  }

  await ensureProfile(email, session.user?.name ?? undefined);
  await ensureSignupGrant(email);

  // A selected SHARED workspace renders the read-only member dashboard; the personal
  // workspace (default) keeps the full owner dashboard below, unchanged.
  const { selected } = await resolveWorkspaceSelection(email, (await cookies()).get("vws")?.value);
  if (selected && !selected.isPersonal) {
    return <WorkspaceMemberView selected={selected} summary={await workspaceProjectSummaries(selected)} variant="dashboard" />;
  }
  const [bal, plan, stats, projects, evaluations, domainAccess] = await Promise.all([
    balance(email), getPlan(email), workspaceStats(email), listProjects(email), listEvaluations(email, { limit: 60 }), getDomainAccessForEmail(email),
  ]);
  const planName = plan === "free" ? "Free" : plan.charAt(0).toUpperCase() + plan.slice(1);
  const projOpts = projects.map((p) => ({ id: p.id, name: p.name }));
  const isEmpty = stats.total === 0 && projects.length === 0;

  return (
    <div className="wrap" style={{ maxWidth: 1040, paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1 className="display">Welcome back</h1>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="badge-now">{planName} plan</span>
          {isAdmin(email) && <a href="/app/admin" style={{ fontSize: 13.5, color: "var(--fg-3)", textDecoration: "none" }}>Admin</a>}
        </div>
      </div>

      {domainAccess.length > 0 && (
        <a href="/app/organization" className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", textDecoration: "none", color: "inherit", marginBottom: 18, background: "var(--bg-2)" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14.5 }}>You may belong to {domainAccess[0].name}</div>
            <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 2 }}>Your email domain matches a verified organization domain. {domainAccess[0].requestStatus === "pending" ? "Your access request is pending admin approval." : "Request access to join this organization."}</div>
          </div>
          <span style={{ fontSize: 13, color: "var(--acc-deep)", whiteSpace: "nowrap" }}>{domainAccess[0].requestStatus === "pending" ? "View →" : "Request access →"}</span>
        </a>
      )}

      {/* quick actions */}
      <div className="tile-grid cols-4" style={{ marginBottom: 22 }}>
        <QuickAction href="/app/projects" title="Decision programs" sub="Group related workflows by campaign or client" />
        <QuickAction href="/vote" title="Evaluate & earn" sub="Judge others' outputs, earn credits" />
        <QuickAction href="/demo" title="Sample decision package" sub="See a completed decision record" />
        <QuickAction href="/app/data" title="Audit & exports" sub="Aggregate decision records, JSON / CSV" />
      </div>

      {/* stats */}
      <div className="tile-grid cols-4" style={{ marginBottom: 26 }}>
        <div className="stat"><div className="stat__l">Credits</div><div className="stat__v tnum">{bal.toLocaleString()}</div><div className="stat__s"><a href="/app/credits" style={{ color: "var(--acc-deep)", textDecoration: "none" }}>Buy more →</a></div></div>
        <div className="stat"><div className="stat__l">Collecting signal</div><div className="stat__v tnum">{stats.active}</div><div className="stat__s">active workflows</div></div>
        <div className="stat"><div className="stat__l">Decisions made</div><div className="stat__v tnum">{stats.completed}</div><div className="stat__s">decision records</div></div>
        <div className="stat"><div className="stat__l">Qualified signals</div><div className="stat__v tnum">{stats.validJudgments.toLocaleString()}</div><div className="stat__s">verified human judgments</div></div>
      </div>

      {isEmpty ? (
        <FirstRun bal={bal} />
      ) : (
        <>
          {/* projects */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ ...headLbl, marginBottom: 0 }}>Decision programs ({projects.length})</div>
            <a href="/app/projects" style={{ fontSize: 13, color: "var(--acc-deep)", textDecoration: "none" }}>All programs →</a>
          </div>
          {projects.length > 0 ? (
            <div className="tile-grid cols-3" style={{ marginBottom: 28 }}>
              {projects.slice(0, 6).map((p) => (
                <a key={p.id} href={`/app/projects/${p.id}`} className="acard" style={{ textDecoration: "none", gap: 6 }}>
                  <div className="acard__t" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  <div className="acard__d">{p.evaluation_count ?? 0} workflow{(p.evaluation_count ?? 0) === 1 ? "" : "s"}</div>
                </a>
              ))}
            </div>
          ) : (
            <div className="card" style={{ marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", background: "var(--bg-2)" }}>
              <div style={{ fontSize: 13.5, color: "var(--fg-3)" }}>Group related workflows into a decision program — a campaign, a redesign, a client.</div>
              <NewProjectForm label="New program" />
            </div>
          )}

          {/* decision workflows */}
          <div style={headLbl}>Decision workflows ({stats.total})</div>
          {evaluations.length > 0 ? (
            <EvaluationList rows={evaluations.slice(0, 14)} projects={projOpts} />
          ) : (
            <div className="card" style={{ textAlign: "center", padding: "clamp(24px, 4vw, 40px)" }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, marginBottom: 6 }}>No decision workflows yet</div>
              <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: "0 auto 16px", maxWidth: 360 }}>Start your first decision workflow and the decision record shows up here.</p>
              <a href="/app/new" className="btn">Start a decision workflow →</a>
            </div>
          )}
        </>
      )}
    </div>
  );
}
