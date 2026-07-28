import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { v6meta } from "../_system/meta";
import { Signal, EditorialLink, ProseLink } from "../_system/ui";
import { V6_BASE, v6SignInPath } from "@/lib/v6-routes";
import { listApplicationsForMember, latestRunByAppForApps } from "@/lib/v-applications";
import { listAllRuns, overviewCounts } from "@/lib/preflight/overview-db";
import { toPublicDecision } from "@/lib/preflight/public-decision";

/* THE V6 CONSOLE.
 *
 * This page used to say the console had not been built and point at another deployment. That was the honest
 * thing to render while nothing here read real data. It stops being honest the moment it can.
 *
 * EVERYTHING HERE IS READ FROM THE DATABASE. No placeholder rows, no sample verifications, no illustrative
 * charts. A console for a verification product that invented plausible-looking runs would be committing, in
 * its own interface, the exact failure the product exists to catch. When there is nothing to show it says
 * so, and says what would put something there.
 *
 * READS ONLY. No run is launched, no plan approved, no charge incurred. Those are deliberate acts with their
 * own screens; none of them belongs one click away from a summary.
 */

export const metadata = v6meta({
  title: "Console",
  description: "Your connected systems, their latest verification, and the evidence behind each decision.",
  path: "/app",
  type: "website",
});

const BASE = V6_BASE;
const CARD = { background: "var(--graphite-2)", border: "1px solid var(--g-line)", borderRadius: 14, padding: "clamp(20px,2.2vw,26px)" } as const;
const LABEL = { margin: 0, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--g-fg-3)" };
const P = { margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--g-fg-2)" } as const;
const ROW = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 0", borderBottom: "1px solid var(--g-line)" } as const;

/** The PUBLIC vocabulary only. A console that leaks needs_review teaches a customer a word we never use.
 *  Rendered through Signal so a verdict here looks identical to a verdict anywhere else on the site. */
function verdict(state: string, decision: string | null): { label: string; state: "go" | "wait" | "stop" } {
  const d = toPublicDecision(state, decision);
  if (d === "verified") return { label: "Verified", state: "go" };
  if (d === "failed") return { label: "Failed", state: "stop" };
  if (d === "blocked") return { label: "Blocked", state: "wait" };
  return { label: state === "completed" ? "No decision recorded" : "Running", state: "wait" };
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "not yet";

export default async function V6Console() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email) redirect(v6SignInPath(`${BASE}/app`));

  // Member-scoped, not owner-scoped: a teammate with viewer access must see the systems shared with them,
  // and must never see anyone else's.
  const apps = await listApplicationsForMember(email);
  const [latest, runs, counts] = await Promise.all([
    latestRunByAppForApps(apps),
    listAllRuns(email, 8),
    overviewCounts(email),
  ]);
  const empty = apps.length === 0;

  return (
    <section className="v6-sec" data-nav-theme="light" style={{ paddingTop: "clamp(96px,10vw,140px)" }}>
      <div className="v6-wrap">
        <p style={LABEL}>Console</p>
        <h1 style={{ margin: "10px 0 8px", fontSize: "clamp(2rem,4vw,2.9rem)", fontWeight: 600, letterSpacing: "-0.03em", color: "var(--g-fg)" }}>
          {empty ? "Nothing is connected yet." : "Your systems, and what was proven about them."}
        </h1>
        <p style={{ ...P, maxWidth: "62ch" }}>
          Signed in as <span className="v6-mono">{email}</span>.{" "}
          {empty
            ? "Connect a deployed system and give it one guarantee. Vraelis derives the checks, runs the real workflow in a browser, and the result appears here with its evidence."
            : "Every row is a real record. Nothing on this page is a sample."}
        </p>

        {!empty ? (
          <div className="v6-grid3" style={{ marginTop: 34 }}>
            {([
              ["Open critical issues", counts.openCriticalIssues],
              ["Verifications running", counts.runningPasses],
              ["Repairs proven", counts.verifiedRepairs],
            ] as const).map(([label, n]) => (
              <div key={label} style={CARD}>
                <p style={LABEL}>{label}</p>
                <p style={{ margin: "6px 0 0", fontSize: "2rem", fontWeight: 600, letterSpacing: "-0.03em", color: "var(--g-fg)" }}>{n}</p>
              </div>
            ))}
          </div>
        ) : null}

        {!empty ? (
          <div style={{ marginTop: 56 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: "1.3rem", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--g-fg)" }}>Systems</h2>
            {/* The caption the record has to carry: a row is the LATEST verification, which is not a claim
                that the system is covered. */}
            <p style={{ ...P, marginBottom: 14 }}>Each row shows the latest verification, not full coverage.</p>
            {apps.map((a) => {
              const r = latest[a.id];
              const v = r ? verdict(r.state, r.decision) : null;
              return (
                <div key={a.id} style={ROW}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 15, color: "var(--g-fg)" }}>{a.name}</p>
                    <p style={{ ...P, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.app_url}</p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {v ? <Signal state={v.state}>{v.label}</Signal> : <span style={{ fontSize: 14, color: "var(--g-fg-3)" }}>Never verified</span>}
                    <p style={{ ...P, fontSize: 12 }}>{r ? when(r.completed_at ?? r.created_at) : "no verification yet"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {runs.length ? (
          <div style={{ marginTop: 56 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: "1.3rem", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--g-fg)" }}>Recent verifications</h2>
            <p style={{ ...P, marginBottom: 14 }}>Newest first. Each one keeps the evidence behind its decision.</p>
            {runs.map((r) => {
              const v = verdict(r.state, r.decision);
              return (
                <div key={r.id} style={ROW}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 15, color: "var(--g-fg)" }}>{r.applicationName}</p>
                    <p style={{ ...P, fontSize: 13 }}>
                      {r.criticalPassed}/{r.criticalTotal} critical checks held, {r.flowsPassed}/{r.flowsTotal} journeys run
                      {r.parentRunId ? ", repairing an earlier verification" : ""}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <Signal state={v.state}>{v.label}</Signal>
                    <p style={{ ...P, fontSize: 12 }}>{when(r.completedAt ?? r.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        <div style={{ marginTop: 56, ...CARD }}>
          <p style={LABEL}>What this surface does not do</p>
          <p style={{ ...P, marginTop: 8, maxWidth: "70ch" }}>
            This page only reads. Launching a verification, approving a plan, and anything that spends are
            deliberate actions with their own screens, so no charge is ever one click away from a summary.
            Approving a plan is the moment a person takes responsibility for what will be proven, and that
            does not belong on a dashboard.
          </p>
          <p style={{ ...P, marginTop: 14 }}>
            <ProseLink href={`${BASE}/docs`}>Read the docs</ProseLink>
            <span style={{ marginLeft: 20 }}><ProseLink href={`${BASE}/limitations`}>What this cannot do</ProseLink></span>
          </p>
        </div>
      </div>
    </section>
  );
}
