import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightOwner } from "@/lib/v-preflight-guard";
import {
  getApplication, getContract, getApprovedContract, listRequirements, listFlows,
  type ContractRequirement, type ProductionContract, type TestFlow, type Severity,
} from "@/lib/v-applications";
import { listConnections } from "@/lib/preflight/connections-db";
import { flowRequiresAuth } from "@/lib/preflight/flow-steps";
import { ContractEditor } from "./contract-editor";
import { NewDraftButton } from "./new-draft-button";
import { AppTabs } from "../app-tabs";
import { categoryLabel, SEVERITY_LABELS, SEVERITY_COLORS } from "./labels";
import { ProvenanceChip } from "./provenance-chip";
import { Ic, I, EmptyIcon, DecisionMark } from "@/app/rank/_components/icons";

// The app's test-account role labels (meta.role, falling back to meta.label — the same resolution the
// launch auth-readiness gate uses). This is the set a flow's sign-in step may target. Owner-scoped read.
async function testAccountRoles(owner: string, applicationId: string): Promise<string[]> {
  const conns = await listConnections(owner, applicationId);
  const out: string[] = [];
  for (const c of conns) {
    if (c.provider !== "test_account") continue;
    const meta = c.meta ?? {};
    const label = typeof meta.label === "string" && meta.label.trim() ? meta.label.trim() : "Standard user";
    const role = typeof meta.role === "string" && meta.role.trim() ? meta.role.trim() : label;
    if (!out.includes(role)) out.push(role);
  }
  return out;
}

export const metadata: Metadata = { title: "Production Contract" };

// Production Contract for one connected app. Server-gated by the Preflight flag + owner. A DRAFT contract
// keeps the manual editing surface (client child); an APPROVED contract is IMMUTABLE and renders as a
// read-only record: coverage summary, then clean requirement rows with provenance and flow coverage.
// Revisions happen through "Create new draft", which copies the approved version at version + 1.

// Relative "3m ago / 4h ago / Jul 2" (server component; rendered once per request, no hydration risk).
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

// Stable UTC render for title attributes: "2026-07-02 14:31 UTC".
function when(iso: string): string {
  try { return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC"; } catch { return ""; }
}

const smallLabel: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" };

function SevPill({ severity }: { severity: Severity }) {
  return (
    <span className="pill" style={{ color: SEVERITY_COLORS[severity], borderColor: "var(--line-2)", background: "var(--bg-2)", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11 }}>
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: SEVERITY_COLORS[severity], flex: "none" }} />
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

// Read-only view of an APPROVED contract. One card (the coverage summary), then a flat full-width list of
// requirement rows separated by hairlines: text, severity, humanized category, provenance, flow coverage.
function ApprovedContract({ appId, contract, reqs, flows }: { appId: string; contract: ProductionContract; reqs: ContractRequirement[]; flows: TestFlow[] }) {
  // "Approved flows" = the flows a run would actually execute: enabled, and review_state approved (the
  // column defaults to approved and may be absent before the Phase-2 migration).
  const approvedFlows = flows.filter((f) => f.enabled && ((f.review_state ?? "approved") === "approved"));
  const coveredBy = (reqId: string): number =>
    approvedFlows.filter((f) => Array.isArray(f.requirement_ids) && f.requirement_ids.includes(reqId)).length;

  const enabled = reqs.filter((r) => r.enabled);
  const critical = enabled.filter((r) => r.severity === "critical");
  const criticalCovered = critical.filter((r) => coveredBy(r.id) > 0).length;

  return (
    <div>
      {/* coverage summary */}
      <div className="card" style={{ padding: "clamp(16px, 2.2vw, 22px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <span className="pill" style={{ color: "var(--acc-deep)", borderColor: "var(--acc-line)", background: "var(--acc-soft)", fontSize: 11 }}><DecisionMark decision="approved" />Approved</span>
            <span style={smallLabel}>Contract v{contract.version}</span>
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16.5, color: "var(--fg-1)", lineHeight: 1.4 }}>
            {critical.length} critical requirement{critical.length === 1 ? "" : "s"}, {criticalCovered} covered by approved flows
          </div>
          <p style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.55, margin: "6px 0 0" }}>
            {contract.approved_at ? (
              <>Approved <span title={when(contract.approved_at)}>{timeAgo(contract.approved_at)}</span>. </>
            ) : null}
            This contract is locked. Create a new draft to make changes.
          </p>
        </div>
        <NewDraftButton appId={appId} />
      </div>

      {/* requirement rows (flat, hairline-separated; no nested cards) */}
      <section style={{ marginTop: 28 }}>
        <div style={{ ...smallLabel, marginBottom: 4 }}>Requirements ({reqs.length})</div>
        {reqs.length === 0 ? (
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55, margin: "10px 0 0" }}>
            This contract was approved without requirements.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {reqs.map((r, idx) => {
              const n = coveredBy(r.id);
              return (
                <li key={r.id} style={{ padding: "16px 0", borderTop: idx > 0 ? "1px solid var(--line-1)" : "none", opacity: r.enabled ? 1 : 0.55 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 7 }}>
                    <SevPill severity={r.severity} />
                    <span style={{ fontSize: 12, color: "var(--fg-4)" }}>{categoryLabel(r.category)}</span>
                    <ProvenanceChip source={r.source} origin={r.origin} />
                    {!r.enabled ? <span style={smallLabel}>Disabled, not tested</span> : null}
                  </div>
                  <div style={{ fontSize: 14.5, color: "var(--fg-1)", lineHeight: 1.55, wordBreak: "break-word" }}>{r.requirement}</div>
                  {r.enabled ? (
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 7, fontSize: 12.5 }}>
                      {n > 0
                        ? <span style={{ color: "var(--fg-4)" }}>Covered by {n} approved flow{n === 1 ? "" : "s"}</span>
                        : <span style={{ color: "var(--err)" }}>Not covered by any flow yet</span>}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* flows (read-only on an approved contract — matches the requirement behavior) */}
      <section style={{ marginTop: 28 }}>
        <div style={{ ...smallLabel, marginBottom: 4 }}>Test flows ({flows.length})</div>
        {flows.length === 0 ? (
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55, margin: "10px 0 0" }}>
            This contract was approved without flows. Create a new draft to add the journeys Vraelis should run.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {flows.map((f, idx) => {
              const auth = flowRequiresAuth((f.steps as { action: string }[]) ?? []);
              const steps = Array.isArray(f.steps) ? f.steps.length : 0;
              return (
                <li key={f.id} style={{ padding: "14px 0", borderTop: idx > 0 ? "1px solid var(--line-1)" : "none", opacity: f.enabled ? 1 : 0.55 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                    <span className="pill" style={{ color: auth ? "var(--acc-deep)" : "var(--fg-4)", borderColor: auth ? "var(--acc-line)" : "var(--line-2)", background: auth ? "var(--acc-soft)" : "var(--bg-2)", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                      <Ic d={auth ? I.lock : I.user} size={12} sw={1.9} /> {f.role || (auth ? "Authenticated" : "Unauthenticated")}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--fg-4)" }}>{SEVERITY_LABELS[(f.priority as Severity) ?? "important"]}</span>
                    <span style={{ fontSize: 12, color: "var(--fg-4)" }}>{steps} step{steps === 1 ? "" : "s"}</span>
                    {!f.enabled ? <span style={smallLabel}>Disabled, not run</span> : null}
                  </div>
                  <div style={{ fontSize: 14.5, color: "var(--fg-1)", lineHeight: 1.55, wordBreak: "break-word" }}>{f.name}</div>
                  {f.goal ? <div style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.5, marginTop: 3 }}>{f.goal}</div> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requirePreflightOwner(`/applications/${id}/contract`);

  const app = await getApplication(owner, id);
  if (!app) {
    return (
      <div className="wrap" style={{ maxWidth: 720, paddingTop: 48, paddingBottom: 80 }}>
        <div className="empty">
          <EmptyIcon d={I.slash} />
          <h3>App not found</h3>
          <p>This app doesn&apos;t exist, or it belongs to another account.</p>
          <Link href="/applications" className="btn">Your apps</Link>
        </div>
      </div>
    );
  }

  const contract = await getContract(owner, id);
  const reqs = contract ? await listRequirements(owner, contract.id) : [];
  // Flows are loaded for BOTH states: the draft editor lists + authors them, the approved view shows them
  // read-only. Roles come from the app's connected test accounts (the set a sign-in step may target).
  const flows = contract ? await listFlows(owner, contract.id) : [];
  const roles = contract?.status === "draft" ? await testAccountRoles(owner, id) : [];
  // For a draft REVISION (v2+), find the approved version that runs still verify against, so the page can
  // say so honestly (the run-launch route targets the latest approved contract, not the draft).
  const prevApproved = contract && contract.status === "draft" && contract.version > 1
    ? await getApprovedContract(owner, id) : null;

  return (
    <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, marginBottom: 14 }}>
        <Link href="/applications" style={{ color: "var(--fg-4)", textDecoration: "none" }}>Applications</Link>
        <span aria-hidden style={{ color: "var(--fg-5)" }}>/</span>
        <Link href={`/applications/${id}`} style={{ color: "var(--fg-4)", textDecoration: "none", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.name}</Link>
        <span aria-hidden style={{ color: "var(--fg-5)" }}>/</span>
        <span style={{ color: "var(--fg-2)", fontWeight: 600 }}>Production Contract</span>
      </nav>

      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "6px 0 10px" }}>What this app must do</h1>
      <p style={{ fontSize: 14.5, color: "var(--fg-3)", lineHeight: 1.6, margin: 0, maxWidth: 640 }}>
        The approved definition of what the product promises. Vraelis tests these before you launch.
      </p>

      <AppTabs appId={id} active="contract" />

      {prevApproved ? (
        <div style={{ border: "1px solid #F3DFB0", background: "#FEF6E7", color: "#B45309", borderRadius: "var(--r-sm)", padding: "10px 14px", fontSize: 13, lineHeight: 1.55, marginBottom: 18 }}>
          Draft v{contract!.version}. The approved v{prevApproved.version} remains the version runs verify against until you approve this one.
        </div>
      ) : null}

      {contract ? (
        contract.status === "approved" ? (
          <ApprovedContract appId={id} contract={contract} reqs={reqs} flows={flows} />
        ) : (
          <ContractEditor contractId={contract.id} initial={reqs} status={contract.status} flows={flows} roles={roles} />
        )
      ) : (
        <div className="card" style={{ padding: "clamp(18px, 2.6vw, 26px)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--fg-1)", marginBottom: 4 }}>Your contract is being prepared.</div>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55, margin: 0 }}>
            The Production Contract for <strong style={{ color: "var(--fg-1)" }}>{app.name}</strong> is not ready yet. Refresh in a moment, or reconnect the app if this persists.
          </p>
        </div>
      )}
    </div>
  );
}
