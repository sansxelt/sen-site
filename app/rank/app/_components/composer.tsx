"use client";

// The verification composer, Design 01's primary action. It reads as creating a durable assurance record,
// not asking an AI a question: name a deployed build and the outcome it claims, REVIEW the exact plan Vraelis
// derived, EXPLICITLY approve it, then run precisely that plan.
//
// It is a CLIENT of the app's own public API, exclusively through lib/verification-client (no endpoint is
// touched directly, no internal identifier is rendered). Approval and execution are two distinct events, and
// the plan's state comes from the PERSISTED reviewed-plan record, never a local guess. Every visible
// conclusion is Verified / Failed / Blocked. No em dashes in copy.

import Link from "next/link";
import { useRef, useState, type CSSProperties } from "react";
import {
  createReviewedPlan, getReviewedPlan, approveReviewedPlan, executeReviewedPlan, pollVerification,
  normalizeDeploymentUrl, normalizeClaim,
  type Decision, type Verification, type ClientError, type PlanView, type PlanDraft,
} from "@/lib/verification-client";

type Bound = { deployment: string; claim: string };
type Phase =
  | { k: "compose" }
  | { k: "planning" }
  | { k: "not_provable"; draft: PlanDraft }
  | { k: "plan"; plan: PlanView; bound: Bound; busy?: "approving" | "executing" }
  | { k: "running"; id: string; requirements: string[]; v: Verification | null }
  | { k: "done"; id: string; v: Verification }
  // verificationId is present ONLY when the error follows a started (paid) run — a poll timeout/blip, not a
  // failed launch. It changes the recovery: open/keep watching the real run, never "try again" a fresh paid one.
  | { k: "error"; error: ClientError; plan?: PlanView; bound?: Bound; verificationId?: string };

const DECISION: Record<Decision, { label: string; tone: "verified" | "failed" | "blocked"; line: string }> = {
  verified: { label: "Verified", tone: "verified", line: "The claim held, with evidence." },
  failed: { label: "Failed", tone: "failed", line: "The claim did not hold. A repair prompt is ready." },
  blocked: { label: "Blocked", tone: "blocked", line: "Vraelis could not reach a reliable conclusion." },
};
const toneStyle = (t: "verified" | "failed" | "blocked") =>
  t === "verified" ? { color: "var(--go-ink)", bg: "var(--go-wash)", border: "var(--go-line)" }
  : t === "failed" ? { color: "var(--stop-ink)", bg: "var(--stop-wash)", border: "var(--stop-line)" }
  : { color: "var(--wait-ink)", bg: "var(--wait-wash)", border: "var(--wait-line)" };

const lbl: CSSProperties = { fontFamily: "var(--font-code)", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--fg-3)" };

function expiryText(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.round((Date.parse(iso) - Date.now()) / 60000);
  if (Number.isNaN(mins)) return "";
  if (mins <= 0) return "expired";
  if (mins < 60) return `expires in ${mins}m`;
  return `expires in ${Math.round(mins / 60)}h`;
}

export function Composer({ balance }: { balance: number }) {
  const [deployment, setDeployment] = useState("");
  const [claim, setClaim] = useState("");
  const [phase, setPhase] = useState<Phase>({ k: "compose" });
  const abort = useRef<AbortController | null>(null);
  const gen = useRef(0); // guards a stale async response from overwriting newer composer state

  const urlOk = normalizeDeploymentUrl(deployment).length > 0;
  const claimOk = normalizeClaim(claim).length >= 12;
  const busy = phase.k === "planning" || (phase.k === "plan" && !!phase.busy) || phase.k === "running";
  const canReview = urlOk && claimOk && !busy;
  // The plan is bound to the exact deployment + claim it was minted for. Editing either makes the visible
  // approval stale: the server would refuse execution, so we require a fresh review rather than run the wrong
  // plan (mirrors reviewed_plan_deployment_changed / reviewed_plan_claim_changed).
  const bound: Bound | undefined = phase.k === "plan" ? phase.bound : phase.k === "error" ? phase.bound : undefined;
  const stale = !!bound && (normalizeDeploymentUrl(deployment) !== bound.deployment || normalizeClaim(claim) !== bound.claim);

  async function review() {
    if (!canReview) return;
    const g = ++gen.current;
    setPhase({ k: "planning" });
    const r = await createReviewedPlan({ deploymentUrl: deployment, claim });
    if (g !== gen.current) return; // superseded
    if (!r.ok) { setPhase({ k: "error", error: r.error }); return; }
    if (!r.value.wouldLaunch || !r.value.reviewedPlanId) { setPhase({ k: "not_provable", draft: r.value }); return; }
    const pv = await getReviewedPlan(r.value.reviewedPlanId); // ground the UI in the persisted record
    if (g !== gen.current) return;
    if (!pv.ok) { setPhase({ k: "error", error: pv.error }); return; }
    setPhase({ k: "plan", plan: pv.value, bound: { deployment: normalizeDeploymentUrl(deployment), claim: normalizeClaim(claim) } });
  }

  async function approve() {
    if (phase.k !== "plan" || phase.busy || stale) return;
    const g = ++gen.current;
    const b = phase.bound;
    setPhase({ ...phase, busy: "approving" });
    const r = await approveReviewedPlan(phase.plan.reviewedPlanId);
    if (g !== gen.current) return;
    if (!r.ok) { setPhase({ k: "error", error: r.error, plan: phase.plan, bound: b }); return; }
    const pv = await getReviewedPlan(phase.plan.reviewedPlanId); // re-read persisted approval_state
    if (g !== gen.current) return;
    if (!pv.ok) { setPhase({ k: "error", error: pv.error, bound: b }); return; }
    setPhase({ k: "plan", plan: pv.value, bound: b });
  }

  async function execute() {
    if (phase.k !== "plan" || phase.busy || stale || phase.plan.approvalState !== "approved") return;
    const g = ++gen.current;
    const b = phase.bound;
    setPhase({ ...phase, busy: "executing" });
    const started = await executeReviewedPlan({ deploymentUrl: b.deployment, claim: b.claim, reviewedPlanId: phase.plan.reviewedPlanId });
    if (g !== gen.current) return;
    if (!started.ok) { setPhase({ k: "error", error: started.error, plan: phase.plan, bound: b }); return; }
    const { verificationId, requirements } = started.value;
    setPhase({ k: "running", id: verificationId, requirements, v: null });
    abort.current?.abort();
    abort.current = new AbortController();
    const final = await pollVerification(verificationId, {
      signal: abort.current.signal,
      onUpdate: (v) => setPhase((p) => (p.k === "running" && p.id === verificationId ? { ...p, v } : p)),
    });
    if (g !== gen.current) return;
    // The run is already paid and running. If the poll ends without a verdict (timeout/blip/cancelled), carry
    // the id so recovery is "open the record", never a second paid run.
    if (final.ok) setPhase({ k: "done", id: verificationId, v: final.value });
    else setPhase({ k: "error", error: final.error, verificationId });
  }

  function reset() { gen.current++; abort.current?.abort(); setPhase({ k: "compose" }); }

  const composing = phase.k === "compose" || phase.k === "planning" || phase.k === "not_provable" || phase.k === "error";
  const primaryLabel = phase.k === "planning" ? "Building the plan..." : stale ? "Review the updated plan" : "Review the proof plan";

  return (
    <section className="card" aria-label="New verification" style={{ background: "var(--bg-1)", padding: "clamp(22px, 3vw, 30px)", boxShadow: "var(--shadow-md)" }}>
      <div style={lbl}>New verification</div>
      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3.4vw, 2.15rem)", letterSpacing: "-0.03em", margin: "8px 0 6px", lineHeight: 1.05 }}>
        What should be <span className="em">true</span>?
      </h1>
      <p style={{ margin: "0 0 20px", color: "var(--fg-3)", fontSize: 14, maxWidth: "56ch", lineHeight: 1.55 }}>
        Name a deployed build and the outcome it claims. Vraelis derives the plan it would run, shows it to you
        to approve, then runs a real browser and returns a decision backed by evidence.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 15 }}>
        <label htmlFor="cmp-deploy" style={{ ...lbl, color: "var(--fg-2)" }}>Deployment to verify</label>
        <input id="cmp-deploy" className="cmp-inp" inputMode="url" spellCheck={false} autoCapitalize="off"
          placeholder="your-app.vercel.app" value={deployment} disabled={busy}
          onChange={(e) => setDeployment(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && canReview) review(); }}
          aria-invalid={deployment.length > 0 && !urlOk} aria-describedby="cmp-deploy-h" />
        <span id="cmp-deploy-h" style={{ fontSize: 12, color: "var(--fg-4)" }}>The public URL of the build to check.</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 15 }}>
        <label htmlFor="cmp-claim" style={{ ...lbl, color: "var(--fg-2)" }}>What must be true</label>
        <textarea id="cmp-claim" className="cmp-inp" rows={3} spellCheck={false} disabled={busy}
          placeholder="A signed-in user can create a record, and it is still there after signing out and back in."
          value={claim} onChange={(e) => setClaim(e.target.value)} style={{ resize: "vertical", minHeight: 66 }}
          aria-invalid={claim.length > 0 && !claimOk} aria-describedby="cmp-claim-h" />
        <span id="cmp-claim-h" style={{ fontSize: 12, color: claim.length > 0 && !claimOk ? "var(--stop-ink)" : "var(--fg-4)" }}>
          {claim.length > 0 && !claimOk ? "Describe a specific, observable result: what a person does and what should be true afterwards." : "Be specific about the result, identity, timing, or persistence that matters."}
        </span>
      </div>

      {composing && (
        <div style={{ display: "flex", alignItems: "center", gap: 15, flexWrap: "wrap", marginTop: 4 }}>
          <button className="btn" onClick={review} disabled={!canReview} aria-busy={phase.k === "planning"}
            style={{ flex: "none", opacity: canReview ? 1 : 0.55, cursor: canReview ? "pointer" : "not-allowed" }}>
            {primaryLabel} <span aria-hidden>→</span>
          </button>
          <span style={{ fontSize: 12.5, color: "var(--fg-4)", maxWidth: "46ch", lineHeight: 1.5 }}>
            No one is charged to review a plan. You approve the exact requirements before anything runs.
          </span>
        </div>
      )}

      {phase.k === "not_provable" && (
        <div role="status" style={{ marginTop: 16, border: "1px solid var(--wait-line)", borderRadius: "var(--r-lg, 14px)", overflow: "hidden", background: "var(--wait-wash)" }}>
          <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--wait-line)" }}>
            <div style={{ ...lbl, color: "var(--wait-ink)" }}>Cannot prove this yet</div>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--fg-1)" }}>{phase.draft.blockedReason || "Vraelis could not build a browser flow that would prove this outcome. Nothing was charged."}</p>
          </div>
          {phase.draft.remainingObligations.length > 0 && (
            <ul style={{ margin: 0, padding: "12px 16px 12px 34px", fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.55 }}>
              {phase.draft.remainingObligations.map((o, i) => <li key={i} style={{ marginBottom: 4 }}>{o}</li>)}
            </ul>
          )}
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--wait-line)" }}>
            <button className="btn btn--ghost" onClick={() => setPhase({ k: "compose" })}>Adjust the outcome</button>
          </div>
        </div>
      )}

      {phase.k === "plan" && <PlanPanel plan={phase.plan} balance={balance} busy={phase.busy} stale={stale} canReview={canReview} onReview={review} onApprove={approve} onExecute={execute} onReset={reset} />}

      {(phase.k === "running" || phase.k === "done") && (
        <RunPanel
          requirements={phase.k === "running" ? phase.requirements : phase.v.requirements}
          status={phase.k === "done" ? "done" : phase.v?.state === "completed" ? "settling" : "running"}
          decision={phase.k === "done" ? phase.v.decision : null}
          onReset={reset}
        />
      )}

      {phase.k === "error" && (
        <div role="alert" style={{ marginTop: 16, padding: "13px 16px", borderRadius: "var(--r-md, 12px)", border: "1px solid var(--stop-line)", background: "var(--stop-wash)", fontSize: 13.5, color: "var(--fg-1)" }}>
          <div style={{ fontWeight: 600, marginBottom: 3 }}>{phase.verificationId ? "Still running" : phase.error.code === "cancelled" ? "Stopped watching" : "That step could not be completed"}</div>
          <div style={{ color: "var(--fg-2)", lineHeight: 1.5 }}>
            {phase.verificationId ? "This verification is already running and stays available under Verifications. It was not charged again." : phase.error.message}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 11, flexWrap: "wrap" }}>
            {/* The run already started and is paid for: recover by opening it, never by launching a fresh paid run. */}
            {phase.verificationId ? (
              <Link href="/verifications" className="btn btn--ghost" style={{ padding: "7px 14px", fontSize: 13 }}>Open the record</Link>
            ) : (
              <>
                {/* Back to /credits, because topping up now clears this refusal: the PAYG hold debits the
                    same 'credit' rows a purchase mints (accept-run.ts converts the cent price at
                    CENTS_PER_CREDIT). This briefly pointed at /contact, correctly, during the window when
                    the hold spent a denomination no purchase could produce. */}
                {phase.error.code === "insufficient_balance" && <Link href="/credits" className="btn btn--ghost" style={{ padding: "7px 14px", fontSize: 13 }}>Add balance</Link>}
                {String(phase.error.code).startsWith("reviewed_plan_") && <button className="btn btn--ghost" onClick={review} style={{ padding: "7px 14px", fontSize: 13 }} disabled={!canReview}>Review a fresh plan</button>}
                {phase.error.retryable && phase.error.code !== "cancelled" && !String(phase.error.code).startsWith("reviewed_plan_") && <button className="btn btn--ghost" onClick={review} style={{ padding: "7px 14px", fontSize: 13 }}>Try again</button>}
              </>
            )}
            <button className="btn btn--ghost" onClick={reset} style={{ padding: "7px 14px", fontSize: 13 }}>Start over</button>
          </div>
        </div>
      )}

      {/* Balance line, quiet, only at rest. Never a fabricated dollar cost the backend did not return. */}
      {phase.k === "compose" && balance > 0 && (
        <div style={{ marginTop: 16, paddingTop: 13, borderTop: "1px solid var(--line-2)", fontSize: 12.5, color: "var(--fg-4)" }}>
          Balance <b style={{ color: "var(--fg-2)", fontFamily: "var(--font-code)" }}>{balance.toLocaleString()}</b>.
          Reviewing a plan is free. You are charged only when an approved verification runs. Nothing runs, nothing charged.
        </div>
      )}

      <style>{`
        .cmp-inp{border:1px solid var(--line-3);border-radius:var(--r-md,10px);background:var(--bg-2);padding:12px 14px;font:inherit;font-size:14.5px;color:var(--fg-1);width:100%;transition:border-color .13s,box-shadow .13s,background .13s}
        .cmp-inp::placeholder{color:var(--fg-5)}
        .cmp-inp:focus{outline:none;border-color:var(--acc-deep);box-shadow:0 0 0 3px var(--acc-soft);background:var(--bg-1)}
        .cmp-inp:disabled{opacity:.7}
        .cmp-inp[aria-invalid="true"]{border-color:var(--stop-ink)}
        .cmp-dot{width:7px;height:7px;border-radius:50%;background:var(--acc-deep);animation:cmpPulse 1.2s ease-in-out infinite}
        @keyframes cmpPulse{0%,100%{opacity:.35;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}
        @media(prefers-reduced-motion:reduce){.cmp-dot{animation:none}}
      `}</style>
    </section>
  );
}

function PlanPanel({ plan, balance, busy, stale, canReview, onReview, onApprove, onExecute, onReset }: {
  plan: PlanView; balance: number; busy?: "approving" | "executing"; stale: boolean; canReview: boolean;
  onReview: () => void; onApprove: () => void; onExecute: () => void; onReset: () => void;
}) {
  const approved = plan.approvalState === "approved";
  const consumed = plan.executionState !== "unconsumed";
  const exp = expiryText(plan.expiresAt);
  const expired = exp === "expired";
  const blocked = !!busy || stale || expired || consumed;
  return (
    <div style={{ marginTop: 18, border: "1px solid var(--line-2)", borderRadius: "var(--r-lg, 14px)", overflow: "hidden", background: "var(--bg-1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--line-2)", background: "var(--bg-2)", flexWrap: "wrap" }}>
        <span style={lbl}>Proof plan</span>
        <span style={{ flex: 1 }} />
        <span aria-live="polite" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
          color: approved ? "var(--go-ink)" : "var(--fg-3)", padding: "3px 9px", borderRadius: 6,
          background: approved ? "var(--acc-soft)" : "var(--bg-3)", border: `1px solid ${approved ? "var(--acc-line)" : "var(--line-2)"}` }}>
          {approved ? "Approved" : "Pending approval"}
        </span>
        {exp && <span style={{ fontSize: 11.5, color: expired ? "var(--stop-ink)" : "var(--fg-4)" }}>{exp}</span>}
      </div>

      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-2)", fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.5 }}>
        Bound to <b style={{ color: "var(--fg-2)", fontFamily: "var(--font-code)" }}>{(() => { try { return new URL(plan.deploymentUrl).host; } catch { return plan.deploymentUrl; } })()}</b>. This exact plan runs once, verbatim. It will not change after you approve it.
      </div>

      <div style={{ padding: "6px 16px 4px" }}>
        <div style={{ ...lbl, margin: "10px 0 4px" }}>Requirements it will judge ({plan.requirements.length})</div>
        <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {plan.requirements.map((r, i) => (
            <li key={i} style={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: 11, alignItems: "baseline", padding: "8px 0", borderTop: i ? "1px solid var(--line-2)" : "none" }}>
              <span style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "var(--fg-5)", fontWeight: 600 }}>{i + 1}</span>
              <span style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.5 }}>{r}</span>
            </li>
          ))}
        </ol>
      </div>

      {plan.flows.length > 0 && (
        <div style={{ padding: "4px 16px 8px" }}>
          <div style={{ ...lbl, margin: "10px 0 4px" }}>Journeys it will run in a real browser</div>
          {plan.flows.map((f, i) => (
            <div key={i} style={{ padding: "8px 0", borderTop: i ? "1px solid var(--line-2)" : "none" }}>
              <div style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 500 }}>{f.name}</div>
              {f.goal && <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 2 }}>{f.goal}</div>}
              <div style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-5)", marginTop: 3 }}>{f.steps} step{f.steps === 1 ? "" : "s"}</div>
            </div>
          ))}
        </div>
      )}

      {stale && (
        <div role="status" style={{ margin: "0 16px 12px", padding: "10px 13px", borderRadius: 10, background: "var(--wait-wash)", border: "1px solid var(--wait-line)", fontSize: 12.5, color: "var(--fg-1)" }}>
          You changed the deployment or the outcome, so this plan no longer matches. Review the updated plan before approving.
        </div>
      )}
      {!stale && expired && (
        <div role="status" style={{ margin: "0 16px 12px", padding: "10px 13px", borderRadius: 10, background: "var(--stop-wash)", border: "1px solid var(--stop-line)", fontSize: 12.5, color: "var(--fg-1)" }}>
          This plan expired. Review the outcome again to build a fresh one against the current build.
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 16px", borderTop: "1px solid var(--line-2)" }}>
        {/* A stale plan cannot be approved or run; the one clear next action is a fresh review, rendered right
            here (not just described) so a mouse user or claim-editor is never told to click a control that
            isn't shown. */}
        {stale ? (
          <button className="btn" onClick={onReview} disabled={!canReview} style={{ flex: "none", opacity: canReview ? 1 : 0.55 }}>
            Review the updated plan <span aria-hidden>→</span>
          </button>
        ) : !approved ? (
          <button className="btn" onClick={onApprove} disabled={blocked} aria-busy={busy === "approving"} style={{ flex: "none", opacity: blocked ? 0.55 : 1 }}>
            {busy === "approving" ? "Approving..." : "Approve plan"}
          </button>
        ) : (
          <button className="btn" onClick={onExecute} disabled={blocked} aria-busy={busy === "executing"} style={{ flex: "none", opacity: blocked ? 0.55 : 1 }}>
            {busy === "executing" ? "Starting..." : "Run approved verification"} <span aria-hidden>→</span>
          </button>
        )}
        {/* THE PLAN HAS AN ADDRESS NOW. Until /review/{id} existed, a minted plan lived only inside this
            component: navigate away or refresh and the thing you were asked to take responsibility for was
            gone, recoverable by no URL. Approving is the most consequential act in the product and it was
            the only one you could not come back to. */}
        <Link href={`/review/${plan.reviewedPlanId}`} style={{ fontSize: 12.5, color: "var(--fg-4)", textDecoration: "none", flex: "none" }}>
          Open as a page <span aria-hidden>→</span>
        </Link>
        <button className="btn btn--ghost" onClick={onReset} style={{ flex: "none" }} disabled={!!busy}>Discard</button>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: "var(--fg-4)" }}>
          {approved ? "Approved" : "Approval and running are separate steps"}. Balance <b style={{ color: "var(--fg-2)", fontFamily: "var(--font-code)" }}>{balance.toLocaleString()}</b>. Charged only when it runs.
        </span>
      </div>
    </div>
  );
}

function RunPanel({ requirements, status, decision, onReset }: {
  requirements: string[]; status: "running" | "settling" | "done"; decision: Decision | null; onReset: () => void;
}) {
  const statusText = status === "running" ? "Running in a real browser" : status === "settling" ? "Settling the decision" : decision ? DECISION[decision].label : "Completed";
  const d = status === "done" && decision ? DECISION[decision] : null;
  return (
    <div style={{ marginTop: 18, border: "1px solid var(--line-2)", borderRadius: "var(--r-lg, 14px)", overflow: "hidden", background: "var(--bg-1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--line-2)", background: "var(--bg-2)" }}>
        <span style={lbl}>Verification</span>
        <span style={{ flex: 1 }} />
        {/* ONE persistent live region for the whole run: the settling text and the final decision replace each
            other inside the SAME node, so the conclusion (Verified/Failed/Blocked) is announced, not swapped in
            silently. */}
        <span role="status" aria-live="polite" aria-atomic="true" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {d ? (
            <span className="pill" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", ...toneStyle(d.tone) }}>{d.label}</span>
          ) : (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--fg-3)", fontWeight: 500 }}><span className="cmp-dot" aria-hidden />{statusText}</span>
          )}
        </span>
      </div>
      <ol style={{ listStyle: "none", margin: 0, padding: "6px 16px 12px" }}>
        {requirements.map((r, i) => (
          <li key={i} style={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: 11, alignItems: "baseline", padding: "9px 0", borderTop: i ? "1px solid var(--line-2)" : "none" }}>
            <span style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "var(--fg-5)", fontWeight: 600 }}>{i + 1}</span>
            <span style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.5 }}>{r}</span>
          </li>
        ))}
      </ol>
      {d && (
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--line-2)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, color: "var(--fg-2)" }}>{d.line}</span>
          <span style={{ flex: 1 }} />
          <Link href="/verifications" style={{ fontSize: 13, fontWeight: 600, color: "var(--acc-deep)" }}>Open the record <span aria-hidden>→</span></Link>
          <button className="btn btn--ghost" onClick={onReset} style={{ padding: "7px 14px", fontSize: 13 }}>New verification</button>
        </div>
      )}
    </div>
  );
}
