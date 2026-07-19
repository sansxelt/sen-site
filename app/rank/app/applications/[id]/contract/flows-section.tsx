"use client";

import { useState } from "react";
import type { TestFlow, Severity } from "@/lib/v-applications";
import { flowRequiresAuth } from "@/lib/preflight/flow-steps";
import { FlowEditor } from "./flow-editor";
import { Ic, I } from "@/app/rank/_components/icons";

// The Flows section for a DRAFT contract: a list of authored flows (name, role chip, step count, enabled
// toggle) with Add / edit / delete, and the FlowEditor for the add + edit lifecycle. Optimistic local
// state; a failed enable-toggle or delete reverts and surfaces an inline message. Flows freeze with the
// contract, so this section is only rendered on a draft (the approved page renders a read-only list).

const catHead: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 6 };
const SEV_LABEL: Record<Severity, string> = { critical: "Critical", important: "Important", informational: "Informational" };

function stepCount(f: TestFlow): number { return Array.isArray(f.steps) ? f.steps.length : 0; }

function RoleChip({ flow }: { flow: TestFlow }) {
  const auth = flowRequiresAuth((flow.steps as { action: string }[]) ?? []);
  const label = flow.role || (auth ? "Authenticated" : "Unauthenticated");
  return (
    <span className="pill" style={{ color: auth ? "var(--acc-deep)" : "var(--fg-4)", borderColor: auth ? "var(--acc-line)" : "var(--line-2)", background: auth ? "var(--acc-soft)" : "var(--bg-2)", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11 }}>
      <Ic d={auth ? I.lock : I.user} size={12} sw={1.9} /> {label}
    </span>
  );
}

export function FlowsSection({ contractId, initial, roles }: { contractId: string; initial: TestFlow[]; roles: string[] }) {
  const [flows, setFlows] = useState<TestFlow[]>(initial);
  const [editing, setEditing] = useState<TestFlow | "new" | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busyReview, setBusyReview] = useState(false);

  const isSuggested = (f: TestFlow) => (f.review_state ?? "approved") === "suggested";
  const suggestedFlows = flows.filter(isSuggested);
  const confirmedFlows = flows.filter((f) => !isSuggested(f));

  async function reviewFlow(f: TestFlow, review: "approve" | "reject") {
    setMsg(null);
    if (review === "approve") setFlows((xs) => xs.map((x) => (x.id === f.id ? { ...x, review_state: "approved", enabled: true } : x)));
    else setFlows((xs) => xs.filter((x) => x.id !== f.id));
    try {
      const r = await fetch("/api/preflight/flows", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: f.id, review }) });
      if (!r.ok) throw new Error("review_failed");
    } catch {
      setFlows(initialOrRestore(f, review));
      setMsg({ kind: "err", text: `Could not ${review} that flow. It was restored.` });
    }
  }
  // Restore helper: on failure, put the suggested flow back as it was.
  function initialOrRestore(f: TestFlow, review: "approve" | "reject"): TestFlow[] {
    return review === "approve"
      ? flows.map((x) => (x.id === f.id ? { ...x, review_state: "suggested", enabled: f.enabled } : x))
      : flows.some((x) => x.id === f.id) ? flows : [...flows, f];
  }

  async function approveAllFlows() {
    if (busyReview || suggestedFlows.length === 0) return;
    setBusyReview(true); setMsg(null);
    const ids = suggestedFlows.map((s) => s.id);
    setFlows((xs) => xs.map((x) => (ids.includes(x.id) ? { ...x, review_state: "approved", enabled: true } : x)));
    const results = await Promise.all(ids.map((id) => fetch("/api/preflight/flows", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, review: "approve" }) }).then((r) => r.ok).catch(() => false)));
    const failed = ids.filter((_, i) => !results[i]);
    if (failed.length) { setFlows((xs) => xs.map((x) => (failed.includes(x.id) ? { ...x, review_state: "suggested" } : x))); setMsg({ kind: "err", text: `Approved ${ids.length - failed.length} of ${ids.length} flows. Some could not be saved.` }); }
    else setMsg({ kind: "ok", text: `Approved ${ids.length} suggested flow${ids.length === 1 ? "" : "s"}.` });
    setBusyReview(false);
  }

  function upsert(f: TestFlow) {
    setFlows((xs) => (xs.some((x) => x.id === f.id) ? xs.map((x) => (x.id === f.id ? f : x)) : [...xs, f]));
    setEditing(null);
    setMsg({ kind: "ok", text: "Flow saved." });
  }

  async function toggleEnabled(f: TestFlow) {
    const next = !f.enabled;
    setMsg(null);
    setFlows((xs) => xs.map((x) => (x.id === f.id ? { ...x, enabled: next } : x)));
    try {
      const r = await fetch("/api/preflight/flows", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: f.id, enabled: next }) });
      if (!r.ok) throw new Error("patch_failed");
    } catch {
      setFlows((xs) => xs.map((x) => (x.id === f.id ? { ...x, enabled: f.enabled } : x)));
      setMsg({ kind: "err", text: "Could not update that flow. Your change was reverted." });
    }
  }

  async function remove(f: TestFlow) {
    const snapshot = flows;
    setMsg(null);
    setFlows((xs) => xs.filter((x) => x.id !== f.id));
    try {
      const r = await fetch(`/api/preflight/flows?id=${encodeURIComponent(f.id)}`, { method: "DELETE" });
      if (!r.ok) throw new Error("delete_failed");
    } catch {
      setFlows(snapshot);
      setMsg({ kind: "err", text: "Could not delete that flow. It was restored." });
    }
  }

  return (
    <div className="card" style={{ padding: "clamp(16px, 2.2vw, 22px)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <div style={catHead}>Test flows</div>
          <p style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.5, margin: 0, maxWidth: 520 }}>
            The journeys Vraelis runs in a real browser to prove this app keeps its promises. A flow can sign in by role, act, and verify the result.
          </p>
        </div>
        {editing === null ? (
          <button type="button" className="btn" onClick={() => { setMsg(null); setEditing("new"); }} style={{ display: "inline-flex", alignItems: "center", gap: 7, flex: "none" }}>
            <Ic d={I.plus} size={13} sw={2.2} /> Add flow
          </button>
        ) : null}
      </div>

      {confirmedFlows.length === 0 && suggestedFlows.length === 0 && editing === null ? (
        <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55, margin: "6px 0 0" }}>
          No flows yet. Add one to describe a journey Vraelis should test before you launch.
        </p>
      ) : null}

      {/* SUGGESTED flows (from discovery) — review block above the confirmed list */}
      {suggestedFlows.length > 0 ? (
        <div style={{ border: "1px solid var(--acc-line)", borderRadius: "var(--r-md)", background: "var(--acc-soft)", padding: "14px 16px", margin: "4px 0 14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 650, fontSize: 13.5, color: "var(--fg-1)" }}>Vraelis suggested {suggestedFlows.length} flow{suggestedFlows.length === 1 ? "" : "s"} to test</div>
            <button type="button" className="btn" onClick={approveAllFlows} disabled={busyReview} style={{ flex: "none", padding: "6px 12px", fontSize: 12.5, opacity: busyReview ? 0.6 : 1 }}>{busyReview ? "Approving…" : "Approve all"}</button>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {suggestedFlows.map((f, idx) => (
              <li key={f.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 0", borderTop: idx > 0 ? "1px solid var(--acc-line)" : "none" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                    <span className="pill" style={{ color: "var(--acc-deep)", borderColor: "var(--acc-line)", background: "var(--bg-1)", fontSize: 10.5, fontFamily: "var(--font-mono)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Suggested</span>
                    <RoleChip flow={f} />
                    <span style={{ fontSize: 11.5, color: "var(--fg-4)" }}>{stepCount(f)} step{stepCount(f) === 1 ? "" : "s"}</span>
                  </div>
                  <div style={{ fontSize: 14, color: "var(--fg-1)", lineHeight: 1.5, wordBreak: "break-word" }}>{f.name}</div>
                  {f.goal ? <div style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.5, marginTop: 2 }}>{f.goal}</div> : null}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "none" }}>
                  <button type="button" className="btn btn--ghost" onClick={() => reviewFlow(f, "approve")} aria-label={`Approve flow: ${f.name}`} style={{ padding: "6px 12px", fontSize: 12.5 }}>Keep</button>
                  <button type="button" onClick={() => reviewFlow(f, "reject")} aria-label={`Reject flow: ${f.name}`} style={{ padding: "6px 10px", fontSize: 12.5, background: "none", border: "none", color: "var(--fg-4)", cursor: "pointer" }}>Reject</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {confirmedFlows.length > 0 ? (
        <ul style={{ listStyle: "none", margin: "0 0 4px", padding: 0 }}>
          {confirmedFlows.map((f, idx) => (
            <li key={f.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 0", borderTop: idx > 0 ? "1px solid var(--line-1)" : "none" }}>
              <input
                type="checkbox"
                checked={f.enabled}
                onChange={() => toggleEnabled(f)}
                aria-label={`${f.enabled ? "Disable" : "Enable"} flow: ${f.name}`}
                style={{ marginTop: 3, width: 16, height: 16, accentColor: "var(--acc)", flex: "none", cursor: "pointer" }}
              />
              <div style={{ flex: 1, minWidth: 0, opacity: f.enabled ? 1 : 0.5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                  <RoleChip flow={f} />
                  <span style={{ fontSize: 11.5, color: "var(--fg-4)" }}>{SEV_LABEL[(f.priority as Severity) ?? "important"]}</span>
                  <span style={{ fontSize: 11.5, color: "var(--fg-4)" }}>{stepCount(f)} step{stepCount(f) === 1 ? "" : "s"}</span>
                  {!f.enabled ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-5)" }}>Disabled</span> : null}
                </div>
                <div style={{ fontSize: 14, color: "var(--fg-1)", lineHeight: 1.5, wordBreak: "break-word" }}>{f.name}</div>
                {f.goal ? <div style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.5, marginTop: 2 }}>{f.goal}</div> : null}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
                <button type="button" onClick={() => { setMsg(null); setEditing(f); }} aria-label={`Edit flow: ${f.name}`} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-4)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ic d={I.pencil} size={13} sw={1.9} /></button>
                <button type="button" onClick={() => remove(f)} aria-label={`Delete flow: ${f.name}`} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-4)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ic d={I.trash} size={13} sw={1.9} /></button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {editing !== null ? (
        <div style={{ marginTop: flows.length > 0 ? 14 : 6 }}>
          <FlowEditor
            contractId={contractId}
            flow={editing === "new" ? null : editing}
            roles={roles}
            onSaved={upsert}
            onCancel={() => { setEditing(null); setMsg(null); }}
          />
        </div>
      ) : null}

      {msg ? (
        <p role="status" aria-live="polite" style={{ fontSize: 13, color: msg.kind === "err" ? "var(--err)" : "var(--acc-deep)", margin: "12px 0 0" }}>{msg.text}</p>
      ) : null}
    </div>
  );
}
