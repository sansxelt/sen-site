import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { requirePreflightAppAccess } from "@/lib/v-preflight-guard";
import { capabilities } from "@/lib/preflight/role-capabilities";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { SetupRequired } from "../../../setup-required";
import { getApplication } from "@/lib/v-applications";
import { getGuarantee, guaranteeRunHistory } from "@/lib/preflight/guarantees-db";
import { guaranteeStatus, lastProvenRun } from "@/lib/preflight/guarantee-status";
import { findLivePendingPlanForClaim } from "@/lib/preflight/reviewed-plan-db";
import { toPublicDecision } from "@/lib/preflight/public-decision";
import { Ic, I, EmptyIcon } from "@/app/rank/_components/icons";
import { GuaranteeStatusPill } from "../../guarantee-ui";
import { DerivePlanButton, ApprovePlanButton, RegenerateButton } from "./guarantee-plan";

// The guarantee detail: a durable, named claim on a system, its approved proof plan, and whether it is
// currently proven. Server component. The PREPARED plan is read from the database here (not held in the
// client), so a refresh always shows the plan that exists rather than regenerating a new one.
export const metadata: Metadata = { title: "Guarantee" };

function when(iso: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC"; } catch { return ""; }
}
function ago(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso); if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24); return `${d} day${d === 1 ? "" : "s"} ago`;
}

const label = { fontFamily: "var(--font-code)", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--fg-4)", margin: 0 } as const;
const h2Style = { fontFamily: "var(--font-display)", fontWeight: 650, fontSize: "clamp(1.15rem, 2vw, 1.4rem)", color: "var(--fg-1)", margin: 0 } as const;

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section aria-label={title} style={{ borderTop: "1px solid var(--line-2)", paddingTop: 22, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-5)", fontWeight: 600 }}>{n}</span>
        <h2 style={h2Style}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function RequirementList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, padding: "0 0 0 18px", display: "grid", gap: 6, maxWidth: "68ch" }}>
      {items.map((r, i) => <li key={i} style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.5, wordBreak: "break-word" }}>{r}</li>)}
    </ul>
  );
}

export default async function GuaranteeDetailPage({ params }: { params: Promise<{ id: string; gid: string }> }) {
  const { id, gid } = await params;
  const access = await requirePreflightAppAccess(id, `/applications/${id}/guarantees/${gid}`);
  if (!(await preflightDbReady())) return <SetupRequired />;
  const owner = access?.owner ?? "";
  const caps = capabilities(access?.role);
  const canEdit = caps.canEditContract;

  const g = access ? await getGuarantee(owner, gid) : null;
  const app = access ? await getApplication(owner, id) : null;
  if (!access || !g || !app || g.application_id !== id) {
    return (
      <div className="wrap" style={{ maxWidth: 900, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
        <div className="empty">
          <EmptyIcon d={I.slash} />
          <h3>Guarantee not found</h3>
          <p>This guarantee does not exist, or you do not have access to it.</p>
          <Link href={`/applications/${id}`} className="btn">Back to the system</Link>
        </div>
      </div>
    );
  }

  const notApproved = g.plan_state !== "ok";
  // The prepared plan is read from the DB (sticky across refresh). Only relevant while unapproved.
  const pending = notApproved && app.app_url ? await findLivePendingPlanForClaim(owner, app.app_url, g.title) : null;

  const history = await guaranteeRunHistory(owner, gid);
  const latest = history[0] ?? null;
  const status = guaranteeStatus(g.plan_state === "review_required" ? null : latest, g.plan_state);
  const proven = lastProvenRun(history);
  const approvedReqs = g.approved_plan?.requirements?.map((r) => r.text) ?? [];
  const pendingReqs = pending?.plan.requirements?.map((r) => r.text) ?? [];

  return (
    <div className="wrap" style={{ maxWidth: 900, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, marginBottom: 18 }}>
        <Link href="/applications" style={{ color: "var(--fg-4)", textDecoration: "none" }}>Systems</Link>
        <span aria-hidden style={{ color: "var(--fg-5)" }}>/</span>
        <Link href={`/applications/${id}`} style={{ color: "var(--fg-4)", textDecoration: "none", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.name}</Link>
        <span aria-hidden style={{ color: "var(--fg-5)" }}>/</span>
        <span style={{ color: "var(--fg-2)", fontWeight: 600 }}>Guarantee</span>
      </nav>

      <header style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={label}>Guarantee</div>
          <GuaranteeStatusPill planState={g.plan_state} status={status} />
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(1.5rem, 3vw, 2.1rem)", letterSpacing: "-0.02em", lineHeight: 1.15, color: "var(--fg-1)", margin: 0, maxWidth: "36ch", wordBreak: "break-word" }}>
          {g.title}
        </h1>
        {g.scope ? <p style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: 1.55, margin: 0, maxWidth: "64ch" }}>{g.scope}</p> : null}
      </header>

      <div style={{ display: "grid", gap: "clamp(20px, 3vw, 30px)", marginTop: "clamp(20px, 3vw, 30px)" }}>

        {/* ── Author: derive + approve, or review the prepared plan (editor+, session-only) ── */}
        {notApproved && canEdit ? (
          <Section n="01" title={g.plan_state === "review_required" ? "Re-approve the proof plan" : "Approve a proof plan"}>
            {g.plan_state === "review_required" ? (
              <p style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.55, margin: 0, maxWidth: "64ch" }}>
                The plan changed since this guarantee was last approved, so its status is held until a human approves the current plan again. Nothing is carried forward from the old approval.
              </p>
            ) : (
              <p style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.55, margin: 0, maxWidth: "64ch" }}>
                Derive the checks this guarantee implies, review them, and approve the plan once. After that Vraelis can keep proving it across deployments.
              </p>
            )}
            {pending ? (
              <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-md, 10px)", background: "var(--bg-1)", padding: "clamp(16px, 2.2vw, 22px)", display: "grid", gap: 12 }}>
                <div style={label}>What Vraelis will check</div>
                <RequirementList items={pendingReqs} />
                <p style={{ fontFamily: "var(--font-code)", fontSize: 10.5, color: "var(--fg-4)", lineHeight: 1.5, margin: 0 }}>
                  Machine derived from your claim. Approving records that a human accepted this exact plan.
                </p>
                <ApprovePlanButton appId={id} guaranteeId={gid} reviewedPlanId={pending.id} />
              </div>
            ) : (
              <DerivePlanButton appId={id} guaranteeId={gid} />
            )}
          </Section>
        ) : null}

        {/* Read-only member on an unapproved guarantee. */}
        {notApproved && !canEdit ? (
          <Section n="01" title="Proof plan">
            <p style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: 1.55, margin: 0, maxWidth: "64ch" }}>
              A proof plan has not been approved for this guarantee yet.
            </p>
          </Section>
        ) : null}

        {/* ── The approved proof plan (what a human accepted) ── */}
        {g.plan_state === "ok" && approvedReqs.length ? (
          <Section n="01" title="Approved proof plan">
            <RequirementList items={approvedReqs} />
            <p style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)", lineHeight: 1.5, margin: 0 }}>
              {g.plan_approved_by ? <>Approved by {g.plan_approved_by}{g.plan_approved_at ? <> on <span title={when(g.plan_approved_at)}>{ago(g.plan_approved_at)}</span></> : null}, plan v{g.plan_version}.</> : <>Approved plan v{g.plan_version}.</>}
              {" "}Reverification runs this exact plan against each new deployment; a changed definition returns it for re-approval.
            </p>
            {canEdit ? <div style={{ marginTop: 4 }}><RegenerateButton appId={id} guaranteeId={gid} approved={true} /></div> : null}
          </Section>
        ) : null}

        {/* ── Current status: derived from the guarantee's runs (Inc3 populates history + the verify action) ── */}
        {g.plan_state === "ok" ? (
          <Section n={approvedReqs.length ? "02" : "01"} title="Current status">
            {history.length === 0 ? (
              <p style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: 1.55, margin: 0, maxWidth: "64ch" }}>
                Not verified yet. Once this guarantee runs against a deployment, its decision and the evidence behind it show here, and it is reverified as new deployments appear.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {proven?.deployment_url ? (
                  <p style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.55, margin: 0 }}>
                    Last proven on <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{proven.deployment_url}</span><span title={when(proven.completed_at ?? proven.created_at)}>, {ago(proven.completed_at ?? proven.created_at)}</span>.
                  </p>
                ) : null}
                <div style={{ display: "grid", gap: 8 }}>
                  {history.map((r) => {
                    const pub = toPublicDecision(r.state, r.decision);
                    const tone = pub === "verified" ? "var(--acc-deep)" : pub === "failed" ? "#A8452A" : pub === "blocked" ? "#7E6F43" : "var(--fg-4)";
                    return (
                      <Link key={r.id} href={`/applications/${id}/passes/${r.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-1)", textDecoration: "none" }}>
                        <span aria-hidden style={{ width: 9, height: 9, borderRadius: "50%", background: tone, flex: "none" }} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, color: "var(--fg-2)", fontWeight: 600 }} title={when(r.created_at)}>{ago(r.completed_at ?? r.created_at) || "Verification"}</div>
                          {r.deployment_url ? <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{r.deployment_url}</div> : null}
                        </div>
                        <span aria-hidden style={{ color: "var(--fg-5)", flex: "none", fontSize: 13 }}>→</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </Section>
        ) : null}

      </div>
    </div>
  );
}
