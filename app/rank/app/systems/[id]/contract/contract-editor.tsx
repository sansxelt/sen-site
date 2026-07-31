"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ContractRequirement, Severity, TestFlow } from "@/lib/v-applications";
import { categoryLabel, SEVERITY_LABELS as SEV_LABEL, SEVERITY_COLORS as SEV_COLOR } from "./labels";
import { ProvenanceChip } from "./provenance-chip";
import { FlowsSection } from "./flows-section";
import { Ic, I } from "@/app/rank/_components/icons";

// Client editor for a Production Contract's requirements. Optimistic local state: every toggle / severity
// change / delete updates the UI immediately and persists in the background; a failed write reverts the
// change and surfaces a small inline message. Adds go through the server first, then prepend the returned
// row. Approval requires at least one enabled requirement and locks the definition in. No browser
// execution or discovery here — this is the manual, Phase-1 editing surface.

const SEVERITIES: Severity[] = ["critical", "important", "informational"];

const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 13px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14, fontFamily: "var(--font-sans)", outline: "none", boxSizing: "border-box" };
const selectStyle: React.CSSProperties = { padding: "7px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-2)", fontSize: 12.5, fontFamily: "var(--font-sans)", outline: "none", cursor: "pointer" };
const deleteBtnStyle: React.CSSProperties = { width: 26, height: 26, borderRadius: 6, border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-4)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" };
const lab: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", display: "block", marginBottom: 6 };
const catHead: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 6 };

function SevPill({ severity }: { severity: Severity }) {
  return (
    <span className="pill" style={{ color: SEV_COLOR[severity], borderColor: "var(--line-2)", background: "var(--bg-2)", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11 }}>
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: SEV_COLOR[severity], flex: "none" }} />
      {SEV_LABEL[severity]}
    </span>
  );
}

export function ContractEditor({ contractId, appId, initial, status, flows, roles, discoveryState }: { contractId: string; appId: string; initial: ContractRequirement[]; status: "draft" | "approved"; flows: TestFlow[]; roles: string[]; discoveryState?: string | null }) {
  const router = useRouter();
  const [reqs, setReqs] = useState<ContractRequirement[]>(initial);
  const [contractStatus, setContractStatus] = useState<"draft" | "approved">(status);
  const [draft, setDraft] = useState<{ requirement: string; category: string; severity: Severity }>({ requirement: "", category: "", severity: "important" });
  const [busyAdd, setBusyAdd] = useState(false);
  const [busyApprove, setBusyApprove] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // THREE COUNTS, BECAUSE "ENABLED" WAS NEVER THE SAME QUESTION AS "APPROVABLE".
  //
  // A requirement is inserted enabled=true, review_state='suggested' — by discovery and by the Add form
  // alike. This counted only `enabled`, so the bar said "2 requirements will be tested", the button was
  // active, and the server then refused every click: contractApprovalReadiness rejects any ENABLED row whose
  // review_state is not 'approved'. The refusal rendered as "Enable at least one requirement before
  // approving", pointing at rows that were already enabled, and the suggestion block offers only Keep and
  // Reject — so there was no control anywhere that could carry out the instruction. First-run dead end.
  //
  // readyCount is what will actually be tested; unreviewedCount is what stands in the way, and naming it is
  // what lets the bar say the one thing that clears it.
  const enabledCount = reqs.filter((r) => r.enabled).length;
  const readyCount = reqs.filter((r) => r.enabled && (r.review_state ?? "approved") === "approved").length;
  const unreviewedCount = reqs.filter((r) => r.enabled && (r.review_state ?? "approved") !== "approved").length;
  const canApprove = readyCount > 0 && unreviewedCount === 0;

  // Group the CONFIRMED requirements by category (suggestions render in their own review section above).
  // A newly added row is prepended to `reqs`, so its category floats to the top.
  const grouped = useMemo(() => {
    const m = new Map<string, ContractRequirement[]>();
    for (const r of reqs) {
      if ((r.review_state ?? "approved") === "suggested") continue;
      const k = r.category || "general";
      const arr = m.get(k);
      if (arr) arr.push(r); else m.set(k, [r]);
    }
    return [...m.entries()];
  }, [reqs]);
  const confirmedCount = reqs.filter((r) => (r.review_state ?? "approved") !== "suggested").length;

  function patchLocal(id: string, patch: Partial<ContractRequirement>) {
    setReqs((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function sendPatch(body: { id: string; enabled?: boolean; severity?: Severity; requirement?: string; review?: "approve" | "reject" }): Promise<boolean> {
    try {
      const r = await fetch("/api/preflight/requirements", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      return r.ok;
    } catch { return false; }
  }

  // Discovery suggestions: rows Vraelis proposed from crawling the app (review_state 'suggested'). They sit in
  // a review section above the confirmed requirements — Approve folds one into the contract, Reject drops it
  // (sticky: a future re-run won't resurface it). "Approve all" accepts every suggestion at once.
  const isSuggested = (r: ContractRequirement) => (r.review_state ?? "approved") === "suggested";
  const suggestions = reqs.filter(isSuggested);
  const [busyReview, setBusyReview] = useState(false);

  async function approveSuggestion(r: ContractRequirement) {
    setMsg(null);
    patchLocal(r.id, { review_state: "approved", enabled: true }); // optimistic: moves it into confirmed
    const ok = await sendPatch({ id: r.id, review: "approve" });
    if (!ok) { patchLocal(r.id, { review_state: "suggested", enabled: r.enabled }); setMsg({ kind: "err", text: "Could not approve that suggestion. Try again." }); }
  }

  async function rejectSuggestion(r: ContractRequirement) {
    const snapshot = reqs;
    setMsg(null);
    setReqs((xs) => xs.filter((x) => x.id !== r.id)); // optimistic: drop from view
    const ok = await sendPatch({ id: r.id, review: "reject" });
    if (!ok) { setReqs(snapshot); setMsg({ kind: "err", text: "Could not reject that suggestion. It was restored." }); }
  }

  async function approveAllSuggestions() {
    if (busyReview || suggestions.length === 0) return;
    setBusyReview(true); setMsg(null);
    const ids = suggestions.map((s) => s.id);
    setReqs((xs) => xs.map((x) => (ids.includes(x.id) ? { ...x, review_state: "approved", enabled: true } : x))); // optimistic
    const results = await Promise.all(ids.map((id) => sendPatch({ id, review: "approve" })));
    const failed = ids.filter((_, i) => !results[i]);
    if (failed.length) { setReqs((xs) => xs.map((x) => (failed.includes(x.id) ? { ...x, review_state: "suggested" } : x))); setMsg({ kind: "err", text: `Approved ${ids.length - failed.length} of ${ids.length}. Some could not be saved, try again.` }); }
    else setMsg({ kind: "ok", text: `Approved ${ids.length} suggested requirement${ids.length === 1 ? "" : "s"}. Review the flows below, then approve the contract.` });
    setBusyReview(false);
  }

  // Inline text edit (HF3): the requirement wording is editable on a DRAFT contract. The PATCH route +
  // updateRequirement already accept `requirement`; this wires the UI. Optimistic with revert-on-failure.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  function beginEdit(r: ContractRequirement) { setMsg(null); setEditingId(r.id); setEditText(r.requirement); }
  function cancelEdit() { setEditingId(null); setEditText(""); }
  async function saveEdit(r: ContractRequirement) {
    const next = editText.trim();
    if (!next || next === r.requirement) { cancelEdit(); return; }
    const prev = r.requirement;
    patchLocal(r.id, { requirement: next }); // optimistic
    setEditingId(null);
    const ok = await sendPatch({ id: r.id, requirement: next });
    if (!ok) { patchLocal(r.id, { requirement: prev }); setMsg({ kind: "err", text: "Could not save that edit. Your change was reverted." }); }
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

  // Manual re-run of discovery (crawl the app again + re-synthesize). The route returns 202 immediately and
  // runs in the background (~up to 2 min); we poll the status endpoint until it finishes, then refresh so
  // the new suggestions render. busyDiscover stays true for the whole poll so the button reads "Analyzing…".
  const [busyDiscover, setBusyDiscover] = useState(false);
  const [discoverNote, setDiscoverNote] = useState<string | null>(null);
  const TERMINAL_DISCOVERY = ["completed", "partial", "failed", "cancelled", "none"];
  async function pollDiscovery() {
    // Poll status every 3s for up to 2 min; refresh on terminal (or timeout so late suggestions still land).
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await fetch(`/api/preflight/apps/${encodeURIComponent(appId)}/discovery`, { cache: "no-store" });
        if (!res.ok) continue;
        const j = await res.json().catch(() => ({}));
        if (typeof j?.state === "string" && TERMINAL_DISCOVERY.includes(j.state)) {
          setDiscoverNote(j.state === "failed" ? "Discovery could not read your app this time. You can try again or add requirements manually." : null);
          router.refresh();
          return;
        }
      } catch { /* transient poll error, keep trying */ }
    }
    router.refresh(); // timed out waiting; refresh anyway in case suggestions landed
  }
  async function rerunDiscovery() {
    if (busyDiscover) return;
    setBusyDiscover(true); setDiscoverNote(null); setMsg(null);
    try {
      const key = `rerun-${contractId}-${Date.now()}`;
      const res = await fetch(`/api/preflight/apps/${encodeURIComponent(appId)}/discover`, {
        method: "POST", headers: { "content-type": "application/json", "Idempotency-Key": key }, body: JSON.stringify({ submission_id: key }),
      });
      if (res.status === 202 || res.ok || res.status === 409) {
        // 409 = a discovery is already running for this app; poll it either way.
        setDiscoverNote("Analyzing your app… suggestions will appear here as they land.");
        await pollDiscovery();
      } else {
        setDiscoverNote(res.status === 429 ? "Discovery is rate-limited. Try again in a bit." : "Could not start discovery.");
      }
    } catch { setDiscoverNote("Network error. Discovery was not started."); }
    finally { setBusyDiscover(false); }
  }

  async function approve() {
    if (busyApprove || !canApprove || contractStatus === "approved") return;
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
        // The server page renders an approved contract read-only; refresh so this editor is replaced by it.
        router.refresh();
      } else {
        setMsg({ kind: "err", text: typeof j?.message === "string" ? j.message : "Could not approve the contract. Enable at least one requirement and try again." });
      }
    } catch {
      setMsg({ kind: "err", text: "Network error. The contract was not approved." });
    } finally {
      setBusyApprove(false);
    }
  }

  const discoveryRunning = !!discoveryState && !["completed", "partial", "failed", "cancelled", "none"].includes(discoveryState);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ANALYZING banner: discovery is crawling the app + proposing requirements right now. */}
      {discoveryRunning ? (
        <div className="card" style={{ padding: "clamp(16px, 2.2vw, 22px)", borderColor: "var(--acc-line)", background: "var(--acc-soft)", display: "flex", alignItems: "center", gap: 12 }}>
          <span aria-hidden className="skel" style={{ width: 18, height: 18, borderRadius: "50%", flex: "none" }} />
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14.5, color: "var(--fg-1)" }}>Analyzing your app…</div>
            <p style={{ fontSize: 13, color: "var(--fg-3)", margin: "2px 0 0", lineHeight: 1.5 }}>Vraelis is reading your app and proposing the requirements and flows it should verify. This takes a moment. Refresh to see them appear.</p>
          </div>
          <button type="button" className="btn btn--ghost" onClick={() => router.refresh()} style={{ marginLeft: "auto", flex: "none", padding: "7px 14px", fontSize: 13 }}>Refresh</button>
        </div>
      ) : null}

      {/* SUGGESTIONS review: discovery-proposed requirements awaiting the user's decision. */}
      {suggestions.length > 0 ? (
        <div className="card" style={{ padding: "clamp(16px, 2.2vw, 22px)", borderColor: "var(--acc-line)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 650, fontSize: 15, color: "var(--fg-1)" }}>Vraelis suggested {suggestions.length} requirement{suggestions.length === 1 ? "" : "s"}</div>
              <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: "2px 0 0", lineHeight: 1.5 }}>Proposed from your app. Approve the ones that matter, reject the rest. Rejected ones won&apos;t come back.</p>
            </div>
            <button type="button" className="btn" onClick={approveAllSuggestions} disabled={busyReview} style={{ flex: "none", opacity: busyReview ? 0.6 : 1 }}>{busyReview ? "Approving…" : "Approve all"}</button>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {suggestions.map((r, idx) => (
              <li key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "13px 0", borderTop: idx > 0 ? "1px solid var(--line-1)" : "none" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <span className="pill" style={{ color: "var(--acc-deep)", borderColor: "var(--acc-line)", background: "var(--acc-soft)", fontSize: 10.5, fontFamily: "var(--font-mono)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Suggested</span>
                    <SevPill severity={r.severity} />
                    <ProvenanceChip source={r.source} origin={r.origin} />
                  </div>
                  <div style={{ fontSize: 14, color: "var(--fg-1)", lineHeight: 1.5, wordBreak: "break-word" }}>{r.requirement}</div>
                  {r.reasoning_summary ? <div style={{ fontSize: 12, color: "var(--fg-4)", lineHeight: 1.5, marginTop: 4 }}>{r.reasoning_summary}</div> : null}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "none" }}>
                  <button type="button" className="btn btn--ghost" onClick={() => approveSuggestion(r)} aria-label={`Approve: ${r.requirement}`} style={{ padding: "6px 12px", fontSize: 12.5 }}>Keep</button>
                  <button type="button" onClick={() => rejectSuggestion(r)} aria-label={`Reject: ${r.requirement}`} style={{ padding: "6px 10px", fontSize: 12.5, background: "none", border: "none", color: "var(--fg-4)", cursor: "pointer" }}>Reject</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* CONFIRMED requirement groups, or the empty state (only when nothing suggested + not analyzing) */}
      {confirmedCount === 0 && suggestions.length === 0 ? (
        <div className="card" style={{ padding: "clamp(18px, 2.6vw, 26px)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15.5, color: "var(--fg-1)", marginBottom: 4 }}>{discoveryRunning ? "Suggestions on the way." : "No requirements yet."}</div>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55, margin: "0 0 12px" }}>
            {discoveryRunning
              ? "Vraelis is analyzing your app and will suggest requirements to review here."
              : "Add the promises this app must keep, or re-run discovery to have Vraelis suggest them from your app."}
          </p>
          {!discoveryRunning ? (
            <button type="button" className="btn btn--ghost" onClick={rerunDiscovery} disabled={busyDiscover}>{busyDiscover ? "Starting…" : "Suggest requirements from my app"}</button>
          ) : null}
          {discoverNote ? <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "10px 0 0", lineHeight: 1.5 }}>{discoverNote}</p> : null}
        </div>
      ) : (
        grouped.map(([cat, items]) => (
          <div key={cat} className="card" style={{ padding: "clamp(16px, 2.2vw, 22px)" }}>
            <div style={catHead}>{categoryLabel(cat)}</div>
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
                      <ProvenanceChip source={r.source} origin={r.origin} />
                      {!r.enabled ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-5)" }}>Disabled</span> : null}
                    </div>
                    {editingId === r.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          aria-label={`Edit requirement text`}
                          rows={2}
                          maxLength={2000}
                          autoFocus
                          onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }}
                          style={{ width: "100%", padding: "8px 10px", fontSize: 14, color: "var(--fg-1)", background: "var(--bg-1)", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", outline: "none", resize: "vertical", fontFamily: "var(--font-sans)" }}
                        />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button type="button" className="btn" onClick={() => saveEdit(r)} style={{ padding: "6px 12px", fontSize: 12.5 }}>Save</button>
                          <button type="button" className="btn btn--ghost" onClick={cancelEdit} style={{ padding: "6px 12px", fontSize: 12.5 }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 14, color: "var(--fg-1)", lineHeight: 1.5, wordBreak: "break-word" }}>{r.requirement}</div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
                    <button type="button" onClick={() => beginEdit(r)} aria-label={`Edit requirement: ${r.requirement}`} disabled={editingId === r.id} style={{ ...deleteBtnStyle, opacity: editingId === r.id ? 0.4 : 1 }}><Ic d={I.pencil} size={13} sw={1.9} /></button>
                    <select value={r.severity} onChange={(e) => changeSeverity(r, e.target.value as Severity)} aria-label={`Severity for: ${r.requirement}`} style={selectStyle}>
                      {SEVERITIES.map((s) => <option key={s} value={s}>{SEV_LABEL[s]}</option>)}
                    </select>
                    <button type="button" onClick={() => remove(r)} aria-label={`Delete requirement: ${r.requirement}`} style={deleteBtnStyle}><Ic d={I.trash} size={13} sw={1.9} /></button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      {/* add a requirement */}
      <div className="card" style={{ padding: "clamp(16px, 2.2vw, 22px)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 2 }}>
          <div style={catHead}>Add a requirement</div>
          {!discoveryRunning ? (
            <button type="button" className="btn btn--ghost" onClick={rerunDiscovery} disabled={busyDiscover} style={{ padding: "6px 12px", fontSize: 12.5 }}>{busyDiscover ? "Analyzing…" : "Suggest from my app"}</button>
          ) : null}
        </div>
        {discoverNote ? <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "0 0 10px", lineHeight: 1.5 }}>{discoverNote}</p> : null}
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

      {/* Test flows — authored on the draft; frozen once the contract is approved (S8A). */}
      <FlowsSection contractId={contractId} initial={flows} roles={roles} />

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
              : unreviewedCount > 0
                ? `${unreviewedCount} suggested requirement${unreviewedCount === 1 ? "" : "s"} still need${unreviewedCount === 1 ? "s" : ""} a decision. Press Keep on each one you want tested, or Reject to drop it.`
                : `${readyCount} requirement${readyCount === 1 ? "" : "s"} will be tested. Approving locks in this definition.`}
        </div>
        {contractStatus === "approved" ? (
          <span className="pill" style={{ color: "var(--acc-deep)", borderColor: "var(--acc-line)", background: "var(--acc-soft)", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, padding: "6px 14px" }}>
            <Ic d={I.check} size={13} sw={2.4} /> Approved
          </span>
        ) : (
          <button type="button" className="btn btn--lg" onClick={approve} disabled={busyApprove || !canApprove} style={{ opacity: busyApprove || !canApprove ? 0.6 : 1 }}>
            {busyApprove ? "Approving…" : "Approve contract"}
          </button>
        )}
      </div>
    </div>
  );
}
