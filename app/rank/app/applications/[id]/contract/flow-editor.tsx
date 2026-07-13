"use client";

import { useState } from "react";
import type { TestFlow, Severity } from "@/lib/v-applications";
import { FLOW_ACTIONS, ACTION_LABELS, AUTH_FLOW_ACTIONS, type FlowAction, type FlowStep } from "@/lib/preflight/flow-steps";
import { Ic, I } from "@/app/rank/_components/icons";

// The MINIMUM real flow editor (S8A): name, optional goal, a role select (the app's test-account roles plus
// an "Unauthenticated (no role)" default), and a STEP BUILDER that adds actions from FLOW_ACTIONS through a
// friendly picker. For sign_in_as / switch_role the target is a ROLE dropdown — there is NEVER a password
// field. For navigate/click/fill/assert the target is a plain field, plus a value for fill and expected
// text for assert_text. Steps reorder up/down and remove. Save POST/PATCHes /api/preflight/flows; the
// server re-validates every step against the app's real roles and rejects any credential-shaped value.
// S8B adds duplication, per-flow viewport/env, estimated cost, drag-reorder, and coverage display.

const NO_ROLE = "__none__"; // sentinel for the unauthenticated default in the role <select>

const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 13.5, fontFamily: "var(--font-sans)", outline: "none", boxSizing: "border-box" };
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };
const lab: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", display: "block", marginBottom: 6 };
const iconBtn: React.CSSProperties = { width: 26, height: 26, borderRadius: 6, border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-4)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" };

const SEVERITIES: Severity[] = ["critical", "important", "informational"];
const SEV_LABEL: Record<Severity, string> = { critical: "Critical", important: "Important", informational: "Informational" };

// Which extra fields an action needs in the builder, so the picker shows only the relevant inputs.
function needsRole(a: FlowAction): boolean { return a === "sign_in_as" || a === "switch_role"; }
function needsTarget(a: FlowAction): boolean { return a === "navigate" || a === "click" || a === "fill" || a === "assert_visible" || a === "assert_text"; }
function needsValue(a: FlowAction): boolean { return a === "fill"; }
function needsExpect(a: FlowAction): boolean { return a === "assert_text"; }

// A per-action placeholder for the target field, so the owner knows what to type.
function targetPlaceholder(a: FlowAction): string {
  if (a === "navigate") return "/dashboard (a path on this app, or blank for the home page)";
  if (a === "click") return "Create project (a button or link label)";
  if (a === "fill") return "Project name (the field's label or placeholder)";
  if (a === "assert_visible") return "Your projects (a heading, label, or text you expect to see)";
  if (a === "assert_text") return "Status banner (where to check the text)";
  return "";
}

type DraftStep = { action: FlowAction; target: string; value: string; expect: string };
const emptyStep = (): DraftStep => ({ action: "navigate", target: "", value: "", expect: "" });

function toDraftSteps(flow: TestFlow | null): DraftStep[] {
  if (!flow || !Array.isArray(flow.steps)) return [];
  return (flow.steps as unknown[]).map((s) => {
    const st = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
    const action = (typeof st.action === "string" ? st.action : "navigate") as FlowAction;
    return { action, target: typeof st.target === "string" ? st.target : "", value: typeof st.value === "string" ? st.value : "", expect: typeof st.expect === "string" ? st.expect : "" };
  });
}

// Strip a draft step down to the fields its action actually uses, for the POST/PATCH payload.
function packStep(s: DraftStep): FlowStep {
  const out: FlowStep = { action: s.action };
  if (needsRole(s.action)) out.target = s.target;
  else if (needsTarget(s.action) && s.target.trim()) out.target = s.target;
  if (needsValue(s.action) && s.value.trim()) out.value = s.value;
  if (needsExpect(s.action) && s.expect.trim()) out.expect = s.expect;
  return out;
}

export function FlowEditor({
  contractId, flow, roles, onSaved, onCancel,
}: {
  contractId: string;
  flow: TestFlow | null;          // null = a new flow
  roles: string[];                // the app's test-account role labels
  onSaved: (flow: TestFlow) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(flow?.name ?? "");
  const [goal, setGoal] = useState(flow?.goal ?? "");
  const [role, setRole] = useState<string>(flow?.role && roles.includes(flow.role) ? flow.role : (flow?.role || NO_ROLE));
  const [priority, setPriority] = useState<Severity>((flow?.priority as Severity) ?? "important");
  const [steps, setSteps] = useState<DraftStep[]>(toDraftSteps(flow));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isEdit = !!flow;
  const hasRoles = roles.length > 0;

  function addStep() { setSteps((xs) => [...xs, emptyStep()]); }
  function removeStep(i: number) { setSteps((xs) => xs.filter((_, j) => j !== i)); }
  function patchStep(i: number, patch: Partial<DraftStep>) { setSteps((xs) => xs.map((s, j) => (j === i ? { ...s, ...patch } : s))); }
  function move(i: number, dir: -1 | 1) {
    setSteps((xs) => {
      const j = i + dir;
      if (j < 0 || j >= xs.length) return xs;
      const next = xs.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function save() {
    if (busy) return;
    const trimmedName = name.trim();
    if (!trimmedName) { setErr("Give the flow a name."); return; }
    if (steps.length === 0) { setErr("Add at least one step."); return; }
    setBusy(true); setErr(null);
    const packed = steps.map(packStep);
    // Derive the flow's role from its sign-in steps, else the explicit role select (or none). The launch
    // auth-readiness gate reads this role, so an authenticated flow always carries the role it signs into.
    const authTargets = packed.filter((s) => s.action === "sign_in_as" || s.action === "switch_role").map((s) => s.target).filter(Boolean) as string[];
    const resolvedRole = authTargets[0] ?? (role === NO_ROLE ? null : role);
    const payload = { name: trimmedName, goal: goal.trim() || null, role: resolvedRole, priority, steps: packed };
    try {
      const res = isEdit
        ? await fetch("/api/preflight/flows", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: flow!.id, ...payload }) })
        : await fetch("/api/preflight/flows", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contract_id: contractId, ...payload }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(typeof j?.message === "string" ? j.message : "Could not save the flow. Check the steps and try again."); setBusy(false); return; }
      // On edit the PATCH returns { ok }, so reconstruct the saved row locally for the parent list.
      const saved: TestFlow = isEdit
        ? { ...(flow as TestFlow), name: trimmedName, goal: goal.trim() || null, role: resolvedRole, priority, steps: packed as unknown[] }
        : (j.flow as TestFlow);
      onSaved(saved);
    } catch {
      setErr("Network error. The flow was not saved.");
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: "clamp(16px, 2.2vw, 22px)", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)" }}>
        {isEdit ? "Edit flow" : "New flow"}
      </div>

      {/* name + priority */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <label style={lab} htmlFor="flow-name">Flow name</label>
          <input id="flow-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={140} placeholder="e.g. Sign in and create a project" style={inputStyle} />
        </div>
        <div>
          <label style={lab} htmlFor="flow-priority">Priority</label>
          <select id="flow-priority" value={priority} onChange={(e) => setPriority(e.target.value as Severity)} style={{ ...selectStyle, width: "auto" }}>
            {SEVERITIES.map((s) => <option key={s} value={s}>{SEV_LABEL[s]}</option>)}
          </select>
        </div>
      </div>

      {/* goal */}
      <div>
        <label style={lab} htmlFor="flow-goal">Goal (optional)</label>
        <input id="flow-goal" value={goal ?? ""} onChange={(e) => setGoal(e.target.value)} maxLength={400} placeholder="What this journey proves the app can do" style={inputStyle} />
      </div>

      {/* default role */}
      <div>
        <label style={lab} htmlFor="flow-role">Runs as</label>
        <select id="flow-role" value={role} onChange={(e) => setRole(e.target.value)} style={{ ...selectStyle, maxWidth: 340 }}>
          <option value={NO_ROLE}>Unauthenticated (no role)</option>
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <p style={{ fontSize: 12, color: "var(--fg-4)", lineHeight: 1.5, margin: "6px 0 0" }}>
          {hasRoles
            ? "A sign-in step sets the role Vraelis authenticates as. Add test accounts under Connections to add roles."
            : "No test accounts are connected yet. Add one under Connections to author a signed-in flow."}
        </p>
      </div>

      {/* step builder */}
      <div>
        <label style={lab}>Steps</label>
        {steps.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55, margin: "0 0 10px" }}>
            No steps yet. Add the actions Vraelis should perform, in order.
          </p>
        ) : (
          <ol style={{ listStyle: "none", margin: "0 0 10px", padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {steps.map((s, i) => {
              const isAuth = AUTH_FLOW_ACTIONS.has(s.action);
              return (
                <li key={i} style={{ border: "1px solid var(--line-1)", borderRadius: "var(--r-sm)", padding: "12px 12px 12px 14px", background: "var(--bg-2)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-5)", width: 22, flex: "none" }}>{i + 1}</span>
                    <select
                      aria-label={`Step ${i + 1} action`}
                      value={s.action}
                      onChange={(e) => patchStep(i, { action: e.target.value as FlowAction, target: "", value: "", expect: "" })}
                      style={{ ...selectStyle, width: "auto", flex: "1 1 200px", minWidth: 0 }}
                    >
                      {FLOW_ACTIONS.map((a) => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
                    </select>
                    <div style={{ display: "flex", gap: 6, flex: "none", marginLeft: "auto" }}>
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move step ${i + 1} up`} style={{ ...iconBtn, opacity: i === 0 ? 0.4 : 1 }}><Ic d={I.chevron} size={13} sw={2} style={{ transform: "rotate(180deg)" }} /></button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label={`Move step ${i + 1} down`} style={{ ...iconBtn, opacity: i === steps.length - 1 ? 0.4 : 1 }}><Ic d={I.chevron} size={13} sw={2} /></button>
                      <button type="button" onClick={() => removeStep(i)} aria-label={`Remove step ${i + 1}`} style={iconBtn}><Ic d={I.trash} size={13} sw={1.9} /></button>
                    </div>
                  </div>

                  {/* per-action fields — a ROLE dropdown for sign_in_as/switch_role (NO password field ever) */}
                  {(needsRole(s.action) || needsTarget(s.action)) ? (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10, paddingLeft: 32 }}>
                      {needsRole(s.action) ? (
                        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                          <label style={lab} htmlFor={`step-role-${i}`}>Role</label>
                          <select id={`step-role-${i}`} value={s.target} onChange={(e) => patchStep(i, { target: e.target.value })} style={selectStyle}>
                            <option value="">Choose a role…</option>
                            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                      ) : null}
                      {needsTarget(s.action) ? (
                        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                          <label style={lab} htmlFor={`step-target-${i}`}>{s.action === "navigate" ? "Path" : s.action === "fill" ? "Field" : s.action === "assert_text" ? "Where" : "Target"}</label>
                          <input id={`step-target-${i}`} value={s.target} onChange={(e) => patchStep(i, { target: e.target.value })} maxLength={400} placeholder={targetPlaceholder(s.action)} style={inputStyle} />
                        </div>
                      ) : null}
                      {needsValue(s.action) ? (
                        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                          <label style={lab} htmlFor={`step-value-${i}`}>Value to type</label>
                          <input id={`step-value-${i}`} value={s.value} onChange={(e) => patchStep(i, { value: e.target.value })} maxLength={400} placeholder="The text to enter (never a password)" style={inputStyle} />
                        </div>
                      ) : null}
                      {needsExpect(s.action) ? (
                        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                          <label style={lab} htmlFor={`step-expect-${i}`}>Expected text</label>
                          <input id={`step-expect-${i}`} value={s.expect} onChange={(e) => patchStep(i, { expect: e.target.value })} maxLength={400} placeholder="The text you expect to see" style={inputStyle} />
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p style={{ fontSize: 12, color: "var(--fg-4)", margin: "8px 0 0", paddingLeft: 32 }}>
                      {isAuth ? "No details needed. Vraelis verifies the session using the sealed test account." : "No details needed."}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        <button type="button" onClick={addStep} className="btn" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <Ic d={I.plus} size={13} sw={2.2} /> Add step
        </button>
      </div>

      {err ? <p role="alert" style={{ fontSize: 13, color: "var(--err)", margin: 0 }}>{err}</p> : null}

      <div style={{ display: "flex", gap: 10, alignItems: "center", borderTop: "1px solid var(--line-1)", paddingTop: 14 }}>
        <button type="button" className="btn btn--lg" onClick={save} disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>
          {busy ? "Saving…" : isEdit ? "Save flow" : "Add flow"}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={busy} style={{ background: "var(--bg-1)" }}>Cancel</button>
      </div>
    </div>
  );
}
