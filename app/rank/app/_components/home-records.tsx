// Home's operational records: the presentational half of Design 01 Increment 4.
//
// These are pure, prop-driven SERVER components (no "use client", no data fetching). page.tsx loads real
// persisted data and hands it in; a development-only preview can hand in deterministic fixtures. That split
// is deliberate: every conclusion these render comes from a real run's persisted (state, decision), never a
// guess, and nothing here can invent a metric, a customer, a guarantee, or a deployment the model does not
// carry. The only vocabulary shown is Verified / Failed / Blocked (plus the honest In progress / Not yet
// verified for records that have not reached a verdict). No internal decision string, no "Production Pass".
import Link from "next/link";
import type { CSSProperties } from "react";
import type { PassRow, IssueRow } from "@/lib/preflight/overview-db";
import { DecisionMark, Ic, I } from "@/app/rank/_components/icons";
import { isActiveRun, runVerdict, systemProof, runningStage, timeAgo, type Tone, type Verdict } from "@/lib/preflight/home-verdict";

export { isActiveRun, timeAgo } from "@/lib/preflight/home-verdict";

const TONE: Record<Tone, { color: string; bg: string; border: string }> = {
  verified: { color: "var(--acc-deep)", bg: "var(--acc-soft)", border: "var(--acc-line)" },
  failed: { color: "var(--a-failed, #A8452A)", bg: "#F6ECE7", border: "#E7CFC5" },
  blocked: { color: "var(--a-blocked, #7E6F43)", bg: "#F2ECDD", border: "#E4D9BE" },
  progress: { color: "var(--fg-3)", bg: "var(--bg-2)", border: "var(--line-2)" },
  unproven: { color: "var(--fg-4)", bg: "var(--bg-2)", border: "var(--line-2)" },
};

const headLbl: CSSProperties = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" };
const rowLink: CSSProperties = { display: "grid", alignItems: "center", color: "inherit", textDecoration: "none" };

function VerdictPill({ verdict, decision }: { verdict: Verdict; decision?: string | null }) {
  const t = TONE[verdict.tone];
  return (
    <span className="pill" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: t.color, background: t.bg, borderColor: t.border, flex: "none", display: "inline-flex", alignItems: "center", gap: 5 }}>
      <DecisionMark decision={decision ?? undefined} />{verdict.label}
    </span>
  );
}

// A deployment identifier, shown compactly (host only) but carrying its full value for assistive tech and
// hover. Never renders a secret or a credential — deployment_url is a public build URL.
export function DeploymentReference({ url }: { url: string | null | undefined }) {
  if (!url) return null;
  let host = url;
  try { host = new URL(url).host; } catch { /* not a URL: show the raw string, still truncated by CSS */ }
  return (
    <span title={url} aria-label={`Deployment ${url}`} style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-4)", maxWidth: "22ch", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block", verticalAlign: "bottom" }}>
      {host}
    </span>
  );
}

// ── Section heading + degraded/empty shells ───────────────────────────────────────────────────────────

function SectionHead({ label, count, href, hrefLabel }: { label: string; count?: number; href?: string; hrefLabel?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, gap: 12 }}>
      <h2 style={headLbl}>{label}{typeof count === "number" ? ` (${count})` : ""}</h2>
      {href && hrefLabel && <Link href={href} style={{ fontSize: 13, color: "var(--acc-deep)", flex: "none" }}>{hrefLabel} <span aria-hidden>→</span></Link>}
    </div>
  );
}

// One failed section must not destroy the rest of Home. This renders in place of a section's records with a
// plain-language message and a keyboard-reachable retry (a full reload, since Home is server-rendered). No raw
// server text, stack trace, or database name is ever shown.
export function SectionError({ label }: { label: string }) {
  return (
    <section aria-label={`${label} unavailable`}>
      <SectionHead label={label} />
      <div role="status" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "13px 16px", border: "1px solid var(--line-2)", borderRadius: "var(--r-md, 12px)", background: "var(--bg-2)", fontSize: 13.5, color: "var(--fg-2)" }}>
        <span>This section could not be loaded right now. Your other records are unaffected.</span>
        <Link href="/app" className="btn btn--ghost" style={{ padding: "6px 13px", fontSize: 12.5 }}>Reload</Link>
      </div>
    </section>
  );
}

// ── Needs attention ───────────────────────────────────────────────────────────────────────────────────

const SEV_COLOR: Record<string, string> = { critical: "var(--a-failed, #A8452A)", high: "#B45309", medium: "var(--fg-3)", low: "var(--fg-4)" };

export function HomeAttention({ issues, error }: { issues: IssueRow[]; error?: boolean }) {
  if (error) return <SectionError label="Needs attention" />;
  if (!issues.length) return null;
  return (
    <section aria-label="Needs attention">
      <SectionHead label="Needs attention" count={issues.length} href="/verifications" hrefLabel="All failures" />
      <div style={{ display: "grid", gap: 8 }}>
        {issues.map((iss) => {
          const href = iss.applicationId ? `/applications/${iss.applicationId}/issues` : "/verifications";
          return (
            <Link key={iss.id} href={href}
              style={{ ...rowLink, gridTemplateColumns: "auto 1fr auto auto", gap: 12, padding: "11px 14px", border: "1px solid var(--line-2)", borderLeft: `3px solid ${SEV_COLOR[iss.severity] ?? "var(--fg-4)"}`, borderRadius: "var(--r-sm, 8px)", background: "var(--bg-1)" }}
              aria-label={`${iss.title}${iss.applicationName ? `, ${iss.applicationName}` : ""}, ${iss.severity} severity`}>
              <span className="pill" aria-hidden style={{ fontSize: 10, color: SEV_COLOR[iss.severity] ?? "var(--fg-4)", borderColor: "var(--line-2)", background: "var(--bg-2)", flex: "none" }}>{iss.severity}</span>
              <span style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 500, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{iss.title || "A blocking issue needs attention"}</span>
              <span style={{ fontSize: 12, color: "var(--fg-4)", flex: "none", maxWidth: "18ch", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{iss.applicationName}</span>
              <span aria-hidden style={{ color: "var(--fg-5)", flex: "none" }}>→</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ── Running work ──────────────────────────────────────────────────────────────────────────────────────
// `count` is the authoritative number of running/queued verifications (a head-count). `rows` are the running
// records we could show from the recent window; when count exceeds them we say so rather than overstate.

export function RunningWork({ rows, count, error }: { rows: PassRow[]; count: number; error?: boolean }) {
  if (error) return <SectionError label="Running now" />;
  if (count <= 0 && rows.length === 0) return null;
  const hidden = Math.max(0, count - rows.length);
  return (
    <section aria-label="Running now">
      <SectionHead label="Running now" count={count > 0 ? count : rows.length} href="/verifications" hrefLabel="View all" />
      <div className="card" style={{ padding: 0, overflow: "hidden", background: "var(--bg-1)" }}>
        {rows.map((r, i) => {
          const href = r.applicationId ? `/applications/${r.applicationId}/passes/${r.id}` : "/verifications";
          return (
            <Link key={r.id} href={href}
              style={{ ...rowLink, gridTemplateColumns: "1fr auto", gap: 14, padding: "13px 16px", borderTop: i ? "1px solid var(--line-2)" : "none" }}
              aria-label={`${r.applicationName || "Verification"}, ${runningStage(r.state).toLowerCase()}, started ${timeAgo(r.createdAt) || "recently"}`}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.applicationName || "Verification"}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--fg-3)", fontWeight: 500 }}><span className="run-dot" aria-hidden />{runningStage(r.state)}</span>
                  <DeploymentReference url={r.deploymentUrl} />
                  <span style={{ fontSize: 12, color: "var(--fg-5)" }}>{timeAgo(r.createdAt)}</span>
                </div>
              </div>
              <span aria-hidden style={{ color: "var(--fg-5)", flex: "none" }}>→</span>
            </Link>
          );
        })}
        {rows.length === 0 && count > 0 && (
          <div style={{ padding: "13px 16px", fontSize: 13.5, color: "var(--fg-3)" }}>{count} verification{count === 1 ? "" : "s"} running. <Link href="/verifications" style={{ color: "var(--acc-deep)" }}>Watch progress →</Link></div>
        )}
      </div>
      {hidden > 0 && rows.length > 0 && <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 6 }}>Showing the most recent. {hidden} more running.</div>}
      <style>{`.run-dot{width:7px;height:7px;border-radius:50%;background:var(--acc-deep);display:inline-block;animation:runPulse 1.2s ease-in-out infinite}@keyframes runPulse{0%,100%{opacity:.35}50%{opacity:1}}@media(prefers-reduced-motion:reduce){.run-dot{animation:none}}`}</style>
    </section>
  );
}

// ── Recent verifications ──────────────────────────────────────────────────────────────────────────────
// The real record. The row leads with the system and a useful summary (flow counts when present); the public
// conclusion is supporting information, not the whole row. No persisted outcome sentence exists at list grain,
// so claim-specific prose stays on the record's detail page.

export function VerificationRecordRow({ run, top }: { run: PassRow; top: boolean }) {
  const verdict = runVerdict(run.state, run.decision);
  const href = run.applicationId ? `/applications/${run.applicationId}/passes/${run.id}` : "/verifications";
  const flows = run.flowsTotal > 0 ? `${run.flowsPassed}/${run.flowsTotal} flows` : "";
  const meta = [timeAgo(run.completedAt ?? run.createdAt), flows].filter(Boolean).join(" · ");
  return (
    <Link href={href}
      style={{ ...rowLink, gridTemplateColumns: "1fr auto auto", gap: 16, padding: "13px 16px", borderTop: top ? "none" : "1px solid var(--line-2)" }}
      aria-label={`${run.applicationName || "Verification"}${meta ? `, ${meta}` : ""}, ${verdict.label}`}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{run.applicationName || "Verification"}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
          {meta && <span style={{ fontSize: 12, color: "var(--fg-4)" }}>{meta}</span>}
          <DeploymentReference url={run.deploymentUrl} />
        </div>
      </div>
      <VerdictPill verdict={verdict} decision={run.decision} />
      <span aria-hidden style={{ color: "var(--fg-5)", flex: "none" }}>→</span>
    </Link>
  );
}

export function RecentVerifications({ rows, error }: { rows: PassRow[]; error?: boolean }) {
  if (error) return <SectionError label="Recent verifications" />;
  if (!rows.length) return null;
  return (
    <section aria-label="Recent verifications">
      <SectionHead label="Recent verifications" href="/verifications" hrefLabel="View all" />
      <div className="card" style={{ padding: 0, overflow: "hidden", background: "var(--bg-1)" }}>
        {rows.map((r, i) => <VerificationRecordRow key={r.id} run={r} top={i === 0} />)}
      </div>
    </section>
  );
}

// ── Systems summary ───────────────────────────────────────────────────────────────────────────────────
// A compact, honest systems roll-up: name, its latest proof-state (from run decision), and its latest checked
// deployment. Proof-state language is "needs proof" / "not yet verified" — never Failed/Blocked unless a real
// verification reached that conclusion. Links into the existing system detail route.

export type SystemSummaryItem = { id: string; name: string; state: string | null; decision: string | null; deploymentUrl: string | null };

export function SystemsSummary({ systems, error }: { systems: SystemSummaryItem[]; error?: boolean }) {
  if (error) return <SectionError label="Systems" />;
  if (!systems.length) return null;
  const needsProof = systems.filter((s) => systemProof(s.state === null ? null : { state: s.state, decision: s.decision }).needsProof).length;
  return (
    <section aria-label="Systems">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, gap: 12 }}>
        <h2 style={headLbl}>Systems ({systems.length}){needsProof > 0 ? ` · ${needsProof} need proof` : ""}</h2>
        <Link href="/systems" style={{ fontSize: 13, color: "var(--acc-deep)", flex: "none" }}>Open Systems <span aria-hidden>→</span></Link>
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden", background: "var(--bg-1)" }}>
        {systems.map((s, i) => {
          const proof = systemProof(s.state === null ? null : { state: s.state, decision: s.decision });
          return (
            <Link key={s.id} href={s.id ? `/applications/${s.id}` : "/systems"}
              style={{ ...rowLink, gridTemplateColumns: "1fr auto auto", gap: 14, padding: "12px 16px", borderTop: i ? "1px solid var(--line-2)" : "none" }}
              aria-label={`${s.name || "System"}, ${proof.verdict.label}`}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name || "System"}</div>
                {s.deploymentUrl && <div style={{ marginTop: 2 }}><DeploymentReference url={s.deploymentUrl} /></div>}
              </div>
              <VerdictPill verdict={proof.verdict} decision={s.decision} />
              <span aria-hidden style={{ color: "var(--fg-5)", flex: "none" }}>→</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ── Empty account onboarding ──────────────────────────────────────────────────────────────────────────
// Shown only when there is genuinely nothing to act on. Explains the workflow in the product's own terms; no
// fake example records.

const STEPS = [
  { icon: I.layers, t: "Name the deployed build", d: "Point Vraelis at the public URL of the product you shipped." },
  { icon: I.list, t: "State what must be true", d: "Describe the outcome a real user should be able to reach." },
  { icon: I.shield, t: "Review the proof plan", d: "See the exact browser journeys Vraelis will run, then approve." },
  { icon: I.vote, t: "Run the verification", d: "Get a decision backed by evidence, with a repair prompt if it fails." },
];

export function EmptyHome() {
  return (
    <section aria-label="Getting started" style={{ border: "1px dashed var(--line-3)", borderRadius: "var(--r-lg, 14px)", background: "var(--bg-2)", padding: "clamp(18px, 2.4vw, 26px)" }}>
      <h2 style={{ ...headLbl, marginBottom: 4 }}>Getting started</h2>
      <p style={{ margin: "0 0 18px", fontSize: 14, color: "var(--fg-3)", maxWidth: "54ch", lineHeight: 1.55 }}>
        Nothing has been verified yet. Name a deployment and the outcome it should prove above; your records
        appear here. Your first verification is free.
      </p>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }}>
        {STEPS.map((s, i) => (
          <li key={i} style={{ display: "grid", gridTemplateColumns: "auto auto 1fr", gap: 12, alignItems: "start", padding: "10px 0", borderTop: i ? "1px solid var(--line-2)" : "none" }}>
            <span style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "var(--fg-5)", fontWeight: 600, marginTop: 2 }}>{i + 1}</span>
            <span style={{ color: "var(--acc-deep)", marginTop: 1 }}><Ic d={s.icon} size={16} /></span>
            <span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>{s.t}</span>
              <span style={{ display: "block", fontSize: 13, color: "var(--fg-4)", marginTop: 1, lineHeight: 1.5 }}>{s.d}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
