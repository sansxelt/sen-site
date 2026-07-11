"use client";

import { useMemo, useState } from "react";
import type { ContractRequirement, Severity } from "@/lib/v-applications";

// Client editor for a Production Contract's requirements. Optimistic local state: every toggle / severity
// change / delete updates the UI immediately and persists in the background; a failed write reverts the
// change and surfaces a small inline message. Adds go through the server first, then prepend the returned
// row. Approval requires at least one enabled requirement and locks the definition in. No browser
// execution or discovery here — this is the manual, Phase-1 editing surface.

const SEVERITIES: Severity[] = ["critical", "important", "informational"];
const SEV_LABEL: Record<Severity, string> = { critical: "Critical", important: "Important", informational: "Informational" };
// critical = red, important = amber literal, informational = grey (matches the app's status palette).
const SEV_COLOR: Record<Severity, string> = { critical: "var(--err)", important: "#c2831a", informational: "var(--fg-4)" };

const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 13px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14, fontFamily: "var(--font-sans)", outline: "none", boxSizing: "border-box" };
const selectStyle: React.CSSProperties = { padding: "7px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-2)", fontSize: 12.5, fontFamily: "var(--font-sans)", outline: "none", cursor: "pointer" };
const deleteBtnStyle: React.CSSProperties = { width: 26, height: 26, borderRadius: 6, border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-4)", cursor: "pointer", fontSize: 15, lineHeight: 1, flex: "none" };
const lab: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", display: "block", marginBottom: 6 };
const catHead: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 6 };

function catLabel(c: string): string { return c ? c.charAt(0).toUpperCase() + c.slice(1) : "General"; }

function SevPill({ severity }: { severity: Severity }) {
  return (
    <span className="pill" style={{ color: SEV_COLOR[severity], borderColor: "var(--line-2)", background: "var(--bg-2)", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11 }}>
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: SEV_COLOR[severity], flex: "none" }} />
      {SEV_LABEL[severity]}
    </span>
  );
}

export function ContractEditor({ contractId, initial, status }: { contractId: string; initial: ContractRequirement[]; status: "draft" | "approved" }) {
  const [reqs, setReqs] = useState<ContractRequirement[]>(initial);
  const [contractStatus, setContractStatus] = useState<"draft" | "approved">(status);
  const [draft, setDraft] = useState<{ requirement: string; category: string; severity: Severity }>({ requirement: "", category: "", severity: "important" });
  const [busyAdd, setBusyAdd] = useState(false);
  const [busyApprove, setBusyApprove] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const enabledCount = reqs.filter((r) => r.enabled).length;

  // Group by category, preserving first-seen order. A newly added row is prepended to `reqs`, so its
  // category floats to the top and the new requirement sits first within it.
  const grouped = useMemo(() => {
    const m = new Map<string, ContractRequirement[]>();
    for (const r of reqs) {
      const k = r.category || "general";
      const arr = m.get(k);
      if (arr) arr.push(r); else m.set(k, [r]);
    }
    return [...m.entries()];
  }, [reqs]);

  function patchLocal(id: string, patch: Partial<ContractRequirement>) {
    setReqs((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function sendPatch(body: { id: string; enabled?: boolean; severity?: Severity }): Promise<boolean> {
    try {
      const r = await fetch("/api/preflight/requirements", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      return r.ok;
    } catch { return false; }
  }

  async function toggleEnabled(r: ContractRequirement) {
    const next = !r.enabled;
    setMsg(null);
    patchLocal(r.id, { enabled: next }); // optimistic
    const ok = await sendPatch({ id: r.id, enabled: next });
    if (!ok) { patchLocal(r.id, { enabled: r.enabled }); setMsg({ kind: "err", text: "Could not update that requirement. Your change was reverted." }); }
  }

  async function changeSeverity(r: ContractRequirement, severity: Severity) {
    if (severity === r.severity) return;
    const prev = r.severity;
    setMsg(null);
    patchLocal(r.id, { severity }); // optimistic
    const ok = await sendPatch({ id: r.id, severity });
    if (!ok) { patchLocal(r.id, { severity: prev }); setMsg({ kind: "err", text: "Could not change the severity. Your change was reverted." }); }
  }

  async function remove(r: ContractRequirement) {
    const snapshot = reqs;
    setMsg(null);
    setReqs((xs) => xs.filter((x) => x.id !== r.id)); // optimistic
    try {
      const res = await fetch(`/api/preflight/requirements?id=${encodeURIComponent(r.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete_failed");
    } catch {
      setReqs(snapshot);
      setMsg({ kind: "err", text: "Could not delete that requirement. It was restored." });
    }
  }

  async function add() {
    const requirement = draft.requirement.trim();
    if (!requirement || busyAdd) return;
    setBusyAdd(true); setMsg(null);
    try {
      const res = await fetch("/api/preflight/requirements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contract_id: contractId, requirement, category: draft.category.trim() || undefined, severity: draft.severity }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j?.requirement) {
        setReqs((xs) => [j.requirement as ContractRequirement, ...xs]);
        setDraft({ requirement: "", category: "", severity: "important" });
      } else {
        setMsg({ kind: "err", text: "Could not add the requirement. Try again." });
      }
    } catch {
      setMsg({ kind: "err", text: "Network error. The requirement was not added." });
    } finally {
      setBusyAdd(false);
    }
  }

  async function approve() {
    if (busyApprove || enabledCount === 0 || contractStatus === "approved") return;
    setBusyApprove(true); setMsg(null);
    try {
      const res = await fetch("/api/preflight/requirements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contract_id: contractId, approve: true }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j?.ok) {
        setContractStatus("approved");
        setMsg({ kind: "ok", text: "Contract approved. Vraelis will test these requirements before you launch." });
      } else {
        setMsg({ kind: "err", text: typeof j?.message === "string" ? j.message : "Could not approve the contract. Enable at least one requirement and try again." });
      }
    } catch {
      setMsg({ kind: "err", text: "Network error. The contract was not approved." });
    } finally {
      setBusyApprove(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* requirement groups, or the empty state */}
      {reqs.length === 0 ? (
        <div className="card" style={{ padding: "clamp(18px, 2.6vw, 26px)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15.5, color: "var(--fg-1)", marginBottom: 4 }}>No requirements yet.</div>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55, margin: 0 }}>
            Add the promises this app must keep, or discovery will suggest them in a later release.
          </p>
        </div>
      ) : (
        grouped.map(([cat, items]) => (
          <div key={cat} className="card" style={{ padding: "clamp(16px, 2.2vw, 22px)" }}>
            <div style={catHead}>{catLabel(cat)}</div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {items.map((r, idx) => (
                <li key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 0", borderTop: idx > 0 ? "1px solid var(--line-1)" : "none" }}>
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={() => toggleEnabled(r)}
                    aria-label={`${r.enabled ? "Disable" : "Enable"} requirement: ${r.requirement}`}
                    style={{ marginTop: 3, width: 16, height: 16, accentColor: "var(--acc)", flex: "none", cursor: "pointer" }}
                  />
                  <div style={{ flex: 1, minWidth: 0, opacity: r.enabled ? 1 : 0.5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <SevPill severity={r.severity} />
                      {!r.enabled ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-5)" }}>Disabled</span> : null}
                    </div>
                    <div style={{ fontSize: 14, color: "var(--fg-1)", lineHeight: 1.5, wordBreak: "break-word" }}>{r.requirement}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
                    <select value={r.severity} onChange={(e) => changeSeverity(r, e.target.value as Severity)} aria-label={`Severity for: ${r.requirement}`} style={selectStyle}>
                      {SEVERITIES.map((s) => <option key={s} value={s}>{SEV_LABEL[s]}</option>)}
                    </select>
                    <button type="button" onClick={() => remove(r)} aria-label={`Delete requirement: ${r.requirement}`} style={deleteBtnStyle}>×</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      {/* add a requirement */}
      <div className="card" style={{ padding: "clamp(16px, 2.2vw, 22px)" }}>
        <div style={catHead}>Add a requirement</div>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label style={lab} htmlFor="req-text">Requirement</label>
            <input
              id="req-text"
              value={draft.requirement}
              onChange={(e) => setDraft((d) => ({ ...d, requirement: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
              placeholder="e.g. A valid sign-in lands the user on their dashboard"
              maxLength={400}
              style={inputStyle}
            />
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <label style={lab} htmlFor="req-cat">Category</label>
              <input
                id="req-cat"
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                placeholder="e.g. Authentication"
                maxLength={60}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={lab} htmlFor="req-sev">Severity</label>
              <select id="req-sev" value={draft.severity} onChange={(e) => setDraft((d) => ({ ...d, severity: e.target.value as Severity }))} style={{ ...inputStyle, width: "auto", cursor: "pointer" }}>
                {SEVERITIES.map((s) => <option key={s} value={s}>{SEV_LABEL[s]}</option>)}
              </select>
            </div>
            <button type="button" onClick={add} disabled={busyAdd || !draft.requirement.trim()} className="btn" style={{ opacity: busyAdd || !draft.requirement.trim() ? 0.6 : 1 }}>
              {busyAdd ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      </div>

      {msg ? (
        <p role="status" aria-live="polite" style={{ fontSize: 13, color: msg.kind === "err" ? "var(--err)" : "var(--acc-deep)", margin: 0 }}>{msg.text}</p>
      ) : null}

      {/* approve bar (sticks to the bottom of the viewport while scrolling) */}
      <div style={{ position: "sticky", bottom: 0, background: "var(--bg-1)", borderTop: "1px solid var(--line-1)", padding: "16px 0", marginTop: 4, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.5, maxWidth: 440 }}>
          {contractStatus === "approved"
            ? "This contract is approved. Vraelis will test these requirements before you launch."
            : enabledCount === 0
              ? "Enable at least one requirement to approve this contract."
              : `${enabledCount} requirement${enabledCount === 1 ? "" : "s"} will be tested. Approving locks in this definition.`}
        </div>
        {contractStatus === "approved" ? (
          <span className="pill" style={{ color: "var(--acc-deep)", borderColor: "var(--acc-line)", background: "var(--acc-soft)", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, padding: "6px 14px" }}>
            <span aria-hidden>✓</span> Approved
          </span>
        ) : (
          <button type="button" className="btn btn--lg" onClick={approve} disabled={busyApprove || enabledCount === 0} style={{ opacity: busyApprove || enabledCount === 0 ? 0.6 : 1 }}>
            {busyApprove ? "Approving…" : "Approve contract"}
          </button>
        )}
      </div>
    </div>
  );
}
