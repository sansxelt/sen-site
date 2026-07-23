"use client";

// The verification composer, Design 01's primary action. It reads as creating a durable assurance record,
// not asking an AI a question: name a deployed build and the outcome it claims, and Vraelis derives the
// requirements, shows them back, runs a real browser, and returns a public decision.
//
// It is a CLIENT of the app's own public API, exclusively through lib/verification-client (no endpoint is
// touched directly, no internal identifier is rendered). Every visible conclusion is Verified / Failed /
// Blocked. No em dashes in copy.

import { useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  startVerification,
  pollVerification,
  normalizeDeploymentUrl,
  normalizeClaim,
  type Decision,
  type Verification,
  type ClientError,
} from "@/lib/verification-client";

type Phase =
  | { k: "idle" }
  | { k: "deriving" }
  | { k: "running"; id: string; requirements: string[]; claim: string; v: Verification | null }
  | { k: "done"; id: string; requirements: string[]; claim: string; v: Verification }
  | { k: "error"; error: ClientError; requirements?: string[]; id?: string };

const DECISION: Record<Decision, { label: string; tone: "verified" | "failed" | "blocked"; line: string }> = {
  verified: { label: "Verified", tone: "verified", line: "The claim held, with evidence." },
  failed: { label: "Failed", tone: "failed", line: "The claim did not hold. A repair prompt is ready." },
  blocked: { label: "Blocked", tone: "blocked", line: "Vraelis could not reach a reliable conclusion." },
};

const toneStyle = (tone: "verified" | "failed" | "blocked") =>
  tone === "verified"
    ? { color: "var(--a-verified, #2F5D50)", bg: "var(--acc-soft)", border: "var(--acc-line)" }
    : tone === "failed"
    ? { color: "var(--a-failed, #A8452A)", bg: "#F6ECE7", border: "#E7CFC5" }
    : { color: "var(--a-blocked, #7E6F43)", bg: "#F2ECDD", border: "#E4D9BE" };

const lbl: CSSProperties = {
  fontFamily: "var(--font-code)", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.12em",
  textTransform: "uppercase", color: "var(--fg-3)",
};

export function Composer({ balance }: { balance: number }) {
  const [deployment, setDeployment] = useState("");
  const [claim, setClaim] = useState("");
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const abort = useRef<AbortController | null>(null);

  const busy = phase.k === "deriving" || phase.k === "running";
  const urlOk = normalizeDeploymentUrl(deployment).length > 0;
  const claimOk = normalizeClaim(claim).length >= 12;
  const canSubmit = urlOk && claimOk && !busy;

  async function run() {
    if (!canSubmit) return;
    setPhase({ k: "deriving" });
    const started = await startVerification({ deploymentUrl: deployment, claim });
    if (!started.ok) {
      setPhase({ k: "error", error: started.error });
      return;
    }
    const { verificationId, requirements, claim: normClaim } = started.value;
    setPhase({ k: "running", id: verificationId, requirements, claim: normClaim, v: null });

    abort.current?.abort();
    abort.current = new AbortController();
    const final = await pollVerification(verificationId, {
      signal: abort.current.signal,
      onUpdate: (v) =>
        setPhase((p) => (p.k === "running" && p.id === verificationId ? { ...p, v } : p)),
    });
    if (final.ok) {
      setPhase({ k: "done", id: verificationId, requirements, claim: normClaim, v: final.value });
    } else if (final.error.code === "cancelled") {
      // The run continues server-side; we only stopped watching.
      setPhase({ k: "error", error: final.error, requirements, id: verificationId });
    } else {
      setPhase({ k: "error", error: final.error, requirements, id: verificationId });
    }
  }

  function reset() {
    abort.current?.abort();
    setPhase({ k: "idle" });
  }

  return (
    <section className="card" aria-label="New verification"
      style={{ background: "var(--bg-1)", padding: "clamp(22px, 3vw, 30px)", boxShadow: "var(--shadow-md)" }}>
      <div style={lbl}>New verification</div>
      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3.4vw, 2.15rem)", letterSpacing: "-0.03em", margin: "8px 0 6px", lineHeight: 1.05 }}>
        What should be <span className="em" style={{ color: "var(--acc-deep)" }}>true</span>?
      </h1>
      <p style={{ margin: "0 0 20px", color: "var(--fg-3)", fontSize: 14, maxWidth: "56ch", lineHeight: 1.55 }}>
        Name a deployed build and the outcome it claims. Vraelis runs a real browser, from the outside, and
        returns a decision backed by evidence.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 15 }}>
        <label htmlFor="cmp-deploy" style={{ ...lbl, color: "var(--fg-2)" }}>Deployment</label>
        <input
          id="cmp-deploy" className="cmp-inp" inputMode="url" spellCheck={false} autoCapitalize="off"
          placeholder="your-app.vercel.app" value={deployment} disabled={busy}
          onChange={(e) => setDeployment(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && canSubmit) run(); }}
          aria-invalid={deployment.length > 0 && !urlOk}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 15 }}>
        <label htmlFor="cmp-claim" style={{ ...lbl, color: "var(--fg-2)" }}>Claimed outcome</label>
        <textarea
          id="cmp-claim" className="cmp-inp" rows={3} spellCheck={false} disabled={busy}
          placeholder="A customer can upgrade to Pro, receive access immediately, and keep it after signing out and back in."
          value={claim} onChange={(e) => setClaim(e.target.value)}
          style={{ resize: "vertical", minHeight: 66 }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 15, flexWrap: "wrap", marginTop: 4 }}>
        {phase.k !== "running" && phase.k !== "done" ? (
          <button className="btn" onClick={run} disabled={!canSubmit} aria-busy={phase.k === "deriving"}
            style={{ flex: "none", opacity: canSubmit ? 1 : 0.55, cursor: canSubmit ? "pointer" : "not-allowed" }}>
            {phase.k === "deriving" ? "Deriving requirements..." : "Verify an outcome"} <span aria-hidden>→</span>
          </button>
        ) : (
          <button className="btn btn--ghost" onClick={reset} style={{ flex: "none" }}>Start another</button>
        )}
        <span style={{ fontSize: 12.5, color: "var(--fg-4)", maxWidth: "46ch", lineHeight: 1.5 }}>
          No human approves this contract. The requirements Vraelis derives are shown back before the run, so a
          misread claim is visible, not silent.
        </span>
      </div>

      {/* Derived requirements + live status */}
      {(phase.k === "running" || phase.k === "done" || (phase.k === "error" && phase.requirements)) && (
        <RequirementsPanel
          requirements={phase.k === "error" ? phase.requirements ?? [] : phase.requirements}
          status={
            phase.k === "running"
              ? phase.v?.state === "completed" ? "settling" : "running"
              : phase.k === "done" ? "done" : "stopped"
          }
          decision={phase.k === "done" ? phase.v.decision : null}
          verificationId={phase.id}
        />
      )}

      {/* Errors (mapped once in verification-client; we render the sentence + the honest next step). */}
      {phase.k === "error" && (
        <div role="alert" style={{ marginTop: 16, padding: "13px 16px", borderRadius: "var(--r-md, 12px)",
          border: "1px solid #E7CFC5", background: "#F8F0EC", fontSize: 13.5, color: "var(--fg-1)" }}>
          <div style={{ fontWeight: 600, marginBottom: 3 }}>
            {phase.error.code === "cancelled" ? "Stopped watching" : "Could not complete this verification"}
          </div>
          <div style={{ color: "var(--fg-2)", lineHeight: 1.5 }}>{phase.error.message}</div>
          <div style={{ display: "flex", gap: 12, marginTop: 11, flexWrap: "wrap" }}>
            {phase.error.retryable && phase.error.code !== "cancelled" && (
              <button className="btn btn--ghost" onClick={run} style={{ padding: "7px 14px", fontSize: 13 }}>Try again</button>
            )}
            {phase.error.code === "insufficient_balance" && (
              <Link href="/credits" className="btn btn--ghost" style={{ padding: "7px 14px", fontSize: 13 }}>Add balance</Link>
            )}
            {phase.id && (
              <Link href="/verifications" style={{ fontSize: 13, color: "var(--acc-deep)", alignSelf: "center" }}>
                View in Verifications →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Balance line, quiet. Shown only when it is worth knowing (never a decorative tile). */}
      {phase.k === "idle" && balance > 0 && (
        <div style={{ marginTop: 16, paddingTop: 13, borderTop: "1px solid var(--line-2)", fontSize: 12.5, color: "var(--fg-4)" }}>
          Balance <b style={{ color: "var(--fg-2)", fontFamily: "var(--font-code)" }}>{balance.toLocaleString()}</b>.
          You are charged only when a verification runs. Nothing runs, nothing charged.
        </div>
      )}

      <style>{`
        .cmp-inp{border:1px solid var(--line-3);border-radius:var(--r-md,10px);background:var(--bg-2);
          padding:12px 14px;font:inherit;font-size:14.5px;color:var(--fg-1);width:100%;transition:border-color .13s,box-shadow .13s,background .13s}
        .cmp-inp::placeholder{color:var(--fg-5)}
        .cmp-inp:focus{outline:none;border-color:var(--acc-deep);box-shadow:0 0 0 3px var(--acc-soft);background:var(--bg-1)}
        .cmp-inp:disabled{opacity:.7}
        .cmp-inp[aria-invalid="true"]{border-color:#C0392B}
      `}</style>
    </section>
  );
}

function RequirementsPanel({ requirements, status, decision, verificationId }: {
  requirements: string[];
  status: "running" | "settling" | "done" | "stopped";
  decision: Decision | null;
  verificationId?: string;
}) {
  const statusText =
    status === "running" ? "Running in a real browser" :
    status === "settling" ? "Settling the decision" :
    status === "stopped" ? "Still running (you stopped watching)" :
    decision ? DECISION[decision].label : "Completed";
  const d = status === "done" && decision ? DECISION[decision] : null;

  return (
    <div style={{ marginTop: 18, border: "1px solid var(--line-2)", borderRadius: "var(--r-lg, 14px)", overflow: "hidden", background: "var(--bg-1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--line-2)", background: "var(--bg-2)" }}>
        <span style={lbl}>Requirements Vraelis derived</span>
        <span style={{ flex: 1 }} />
        {d ? (
          <span className="pill" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", ...toneStyle(d.tone) }}>{d.label}</span>
        ) : (
          <span aria-live="polite" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--fg-3)", fontWeight: 500 }}>
            {status !== "stopped" && <span className="cmp-dot" aria-hidden />}{statusText}
          </span>
        )}
      </div>
      <ol style={{ listStyle: "none", margin: 0, padding: "6px 16px 12px" }}>
        {requirements.length === 0 && (
          <li style={{ padding: "12px 0", fontSize: 13, color: "var(--fg-4)" }}>Deriving the requirements from your claim.</li>
        )}
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
          <Link href="/verifications" style={{ fontSize: 13, fontWeight: 600, color: "var(--acc-deep)" }}>Open the record →</Link>
        </div>
      )}
      <style>{`
        .cmp-dot{width:7px;height:7px;border-radius:50%;background:var(--acc-deep);animation:cmpPulse 1.2s ease-in-out infinite}
        @keyframes cmpPulse{0%,100%{opacity:.35;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}
        @media(prefers-reduced-motion:reduce){.cmp-dot{animation:none}}
      `}</style>
    </div>
  );
}
