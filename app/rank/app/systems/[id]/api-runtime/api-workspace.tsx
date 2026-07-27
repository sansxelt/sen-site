"use client";

import { useCallback, useEffect, useState } from "react";

// The complete customer API verification workspace. Customer vocabulary only — no internal step/decision
// names, no fixture/canary terms. Talks only to the gated /api/preflight/apps/[id]/... routes.

type Cred = { id: string; label: string; secretMask: string; scheme: string };
type FlowStepUI = { action: string; credentialLabel?: string; method?: string; path?: string; body?: string; name?: string; value?: string; field?: string; into?: string; status?: number };
type Flow = { id: string; name: string; priority: string; enabled: boolean; steps: FlowStepUI[] };
type Target = { id: string; label: string; environment: string | null } | null;
type Build = { baseUrl: string | null; version: string | null } | null;

type Initial = { target: Target; build: Build; flows: Flow[]; credentials: Cred[] };

// The customer-facing action menu (labels only; ids map to the server vocabulary).
const ACTIONS: { id: string; label: string }[] = [
  { id: "sign_in", label: "Sign in with a saved credential" },
  { id: "call", label: "Call an endpoint" },
  { id: "expect_status", label: "Check the response status" },
  { id: "expect_field", label: "Check a response value" },
  { id: "expect_fields_exist", label: "Confirm response structure" },
  { id: "save_value", label: "Save a value from the response" },
  { id: "confirm_saved", label: "Confirm it was saved" },
  { id: "add_header", label: "Add a request header" },
];
const actionLabel = (id: string) => ACTIONS.find((a) => a.id === id)?.label ?? id;

const card: React.CSSProperties = { border: "1px solid var(--line-2)", borderRadius: 14, padding: 18, background: "var(--bg-1)", marginBottom: 16 };
const btn: React.CSSProperties = { padding: "8px 14px", borderRadius: 9, border: "1px solid var(--line-2)", background: "var(--bg-2)", color: "var(--fg-1)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" };
const btnPrimary: React.CSSProperties = { ...btn, background: "var(--acc)", color: "var(--fg-on-accent)", border: "1px solid var(--acc)" };
const input: React.CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line-2)", background: "var(--bg-2)", color: "var(--fg-1)", fontSize: 13.5, width: "100%" };
const h2: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: "var(--fg-1)", margin: "0 0 10px" };
const label: React.CSSProperties = { fontSize: 12, color: "var(--fg-3)", display: "block", marginBottom: 4, fontWeight: 600 };

function verdictTone(v: string): React.CSSProperties {
  const map: Record<string, string> = { READY: "var(--ok)", "REPAIR VERIFIED": "var(--acc)", BLOCKED: "var(--err)", "NEEDS REVIEW": "var(--warn)" };
  return { color: map[v] ?? "var(--fg-3)", fontWeight: 700 };
}

// Display-layer translation of the /api-runs payload verdict (a stable internal API contract) into the
// public decision vocabulary. Payload BLOCKED is the internal confirmed-failure decision -> "FAILED";
// payload NEEDS REVIEW (no reliable conclusion) -> public "BLOCKED". Unknown/already-public strings
// (NOT VERIFIED, COULD NOT COMPLETE) pass through unchanged. Keep in lockstep with verdictTone above.
const PUBLIC_VERDICT: Record<string, string> = {
  READY: "VERIFIED", "REPAIR VERIFIED": "VERIFIED", "NEEDS REVIEW": "BLOCKED", BLOCKED: "FAILED",
};
const publicVerdict = (v: string) => PUBLIC_VERDICT[v] ?? v;

export function ApiWorkspace({ appId, initial, canEdit, canLaunch }: { appId: string; initial: Initial; canEdit: boolean; canLaunch: boolean }) {
  const base = `/api/preflight/apps/${appId}`;
  const [target, setTarget] = useState<Target>(initial.target);
  const [build, setBuild] = useState<Build>(initial.build);
  const [flows, setFlows] = useState<Flow[]>(initial.flows);
  const [creds, setCreds] = useState<Cred[]>(initial.credentials);
  const [selected, setSelected] = useState<string[]>(initial.flows.filter((f) => f.enabled).map((f) => f.id));
  const [preview, setPreview] = useState<{ price: { label: string } | null; readiness: { launchable: boolean; blockers: string[]; selectedCount: number }; capabilities: string[] } | null>(null);
  const [run, setRun] = useState<{ runId: string; verdict: string; state: string; flows: { name: string; state: string; steps: { action: string; ok: boolean; detail: string; ms: number; requests: { method?: string; path?: string; status?: string }[] }[] }[] } | null>(null);
  const [history, setHistory] = useState<{ runId: string; verdict: string; createdAt: string | null }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const r = await fetch(`${base}${path}`, { ...init, headers: { "content-type": "application/json", ...(init?.headers || {}) } });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, body: j as Record<string, unknown> };
  }, [base]);

  const refreshPreview = useCallback(async (rerun = false) => {
    if (selected.length === 0) { setPreview(null); return; }
    const q = `?flowIds=${selected.join(",")}${rerun ? "&rerun=1" : ""}`;
    const { ok, body } = await api(`/api-preview${q}`);
    if (ok) setPreview(body as never);
  }, [api, selected]);

  const refreshHistory = useCallback(async () => {
    const { ok, body } = await api("/api-runs/list");
    if (ok) setHistory((body.runs as never) ?? []);
  }, [api]);

  useEffect(() => { void refreshPreview(); }, [refreshPreview]);
  useEffect(() => { void refreshHistory(); }, [refreshHistory]);

  // ── target + build ──
  const [envInput, setEnvInput] = useState(target?.environment ?? "production");
  const [baseUrlInput, setBaseUrlInput] = useState(build?.baseUrl ?? "");
  const [versionInput, setVersionInput] = useState(build?.version ?? "");
  const saveTarget = async () => {
    setBusy("target"); setMsg(null);
    const { ok, body } = await api("/runtime-targets", { method: "POST", body: JSON.stringify({ environment: envInput, baseUrl: baseUrlInput || undefined, version: versionInput || undefined }) });
    setBusy(null);
    if (!ok) { setMsg(String(body.message ?? "Could not save.")); return; }
    setTarget(body.target as Target); setBuild(body.build as Build); setMsg("Saved.");
  };

  // ── credential ──
  const [credLabel, setCredLabel] = useState(""); const [credSecret, setCredSecret] = useState(""); const [credScheme, setCredScheme] = useState("bearer");
  const addCred = async () => {
    setBusy("cred"); setMsg(null);
    const { ok, body } = await api("/api-credentials", { method: "POST", body: JSON.stringify({ label: credLabel, secret: credSecret, scheme: credScheme }) });
    setBusy(null);
    if (!ok) { setMsg(String(body.message ?? "Could not save credential.")); return; }
    setCreds([...creds, { id: String(body.id), label: credLabel, secretMask: String(body.secretMask), scheme: credScheme }]);
    setCredLabel(""); setCredSecret(""); setMsg("Credential saved.");
  };
  const removeCred = async (id: string) => {
    await api(`/api-credentials?id=${id}`, { method: "DELETE" });
    setCreds(creds.filter((c) => c.id !== id));
  };

  // ── flows ──
  const reloadFlows = async () => { const { ok, body } = await api("/api-flows"); if (ok) setFlows((body.flows as never) ?? []); };
  const addFlow = async (name: string, steps: FlowStepUI[], priority: string) => {
    setBusy("flow"); setMsg(null);
    const { ok, body } = await api("/api-flows", { method: "POST", body: JSON.stringify({ name, steps, priority }) });
    setBusy(null);
    if (!ok) { setMsg(String(body.message ?? "Could not save flow.")); return false; }
    await reloadFlows(); return true;
  };
  const deleteFlow = async (id: string) => { await api(`/api-flows?id=${id}`, { method: "DELETE" }); await reloadFlows(); setSelected((s) => s.filter((x) => x !== id)); };

  // ── launch / rerun ──
  const launch = async (rerun: boolean) => {
    setBusy("launch"); setMsg(null); setRun(null);
    const { ok, body } = await api("/api-runs", { method: "POST", body: JSON.stringify({ flowIds: selected, rerun, idempotencyKey: `${rerun ? "rerun" : "run"}-${selected.slice().sort().join(",")}` }) });
    if (!ok) { setBusy(null); setMsg(String((body.blockers as string[])?.join(" ") ?? body.message ?? "Could not launch.")); return; }
    const runId = String(body.runId);
    const rep = await api(`/api-runs/${runId}`);
    setBusy(null);
    if (rep.ok) setRun(rep.body as never);
    await refreshHistory();
  };

  return (
    <div>
      {msg && <div style={{ ...card, borderColor: "var(--acc-line)", background: "var(--acc-soft)", color: "var(--fg-2)", fontSize: 13.5 }}>{msg}</div>}

      {/* 1. Target + build identity */}
      <section style={card}>
        <h2 style={h2}>API target</h2>
        <p style={{ color: "var(--fg-3)", fontSize: 13, marginTop: 0 }}>The API you want Vraelis to check.</p>
        {canEdit ? (
          <>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
              <div><label style={label}>Environment</label>
                <select value={envInput} onChange={(e) => setEnvInput(e.target.value)} style={input}>
                  <option value="production">Production</option><option value="staging">Staging</option><option value="preview">Preview</option>
                </select>
              </div>
              <div><label style={label}>Version (optional)</label><input style={input} value={versionInput} onChange={(e) => setVersionInput(e.target.value)} placeholder="v2.3.1 or a commit" /></div>
              <div style={{ gridColumn: "1 / -1" }}><label style={label}>API base URL</label><input style={input} value={baseUrlInput} onChange={(e) => setBaseUrlInput(e.target.value)} placeholder="https://api.yourapp.com" /></div>
            </div>
            <div style={{ marginTop: 12 }}><button style={btnPrimary} disabled={busy === "target"} onClick={saveTarget}>{target ? "Update target" : "Create API target"}</button></div>
          </>
        ) : target ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13.5, color: "var(--fg-2)" }}>
            <div><span style={{ color: "var(--fg-4)" }}>Target:</span> <strong>{target.label}</strong></div>
            <div><span style={{ color: "var(--fg-4)" }}>Environment:</span> {target.environment ?? "—"}</div>
            <div><span style={{ color: "var(--fg-4)" }}>Base URL:</span> {build?.baseUrl ?? "—"}</div>
            <div><span style={{ color: "var(--fg-4)" }}>Version:</span> {build?.version ?? "—"}</div>
          </div>
        ) : (
          <p style={{ color: "var(--fg-4)", fontSize: 13 }}>No API target has been configured yet.</p>
        )}
      </section>

      {/* 2. Credentials */}
      <section style={card}>
        <h2 style={h2}>Credentials</h2>
        <p style={{ color: "var(--fg-3)", fontSize: 13, marginTop: 0 }}>Saved securely. You reference a credential by name in a flow and never see its value again.</p>
        {creds.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {creds.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", border: "1px solid var(--line-1)", borderRadius: 8 }}>
                <span style={{ fontSize: 13.5 }}><strong>{c.label}</strong> <span style={{ color: "var(--fg-4)" }}>· {c.scheme} · {c.secretMask}</span></span>
                {canEdit && <button style={{ ...btn, padding: "4px 10px", fontSize: 12 }} onClick={() => removeCred(c.id)}>Remove</button>}
              </div>
            ))}
          </div>
        ) : !canEdit && (
          <p style={{ color: "var(--fg-4)", fontSize: 13, marginBottom: 0 }}>No credentials have been saved.</p>
        )}
        {canEdit && (
          <>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 140px" }}>
              <input style={input} value={credLabel} onChange={(e) => setCredLabel(e.target.value)} placeholder="Name (e.g. API token)" />
              <input style={input} type="password" value={credSecret} onChange={(e) => setCredSecret(e.target.value)} placeholder="Value (hidden)" />
              <select value={credScheme} onChange={(e) => setCredScheme(e.target.value)} style={input}><option value="bearer">Bearer token</option><option value="api_key">API key</option><option value="basic">Basic</option></select>
            </div>
            <div style={{ marginTop: 10 }}><button style={btn} disabled={busy === "cred" || !credLabel || !credSecret} onClick={addCred}>Save credential</button></div>
          </>
        )}
      </section>

      {/* 3. Flows */}
      <section style={card}>
        <h2 style={h2}>Flows</h2>
        <p style={{ color: "var(--fg-3)", fontSize: 13, marginTop: 0 }}>Each flow is a short sequence of checks against your API.</p>
        {flows.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {flows.map((f) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--line-1)", borderRadius: 8 }}>
                {canLaunch && <input type="checkbox" checked={selected.includes(f.id)} onChange={(e) => setSelected((s) => e.target.checked ? [...s, f.id] : s.filter((x) => x !== f.id))} />}
                <span style={{ fontSize: 13.5, flex: 1 }}><strong>{f.name}</strong> <span style={{ color: "var(--fg-4)" }}>· {f.priority} · {f.steps.length} steps</span></span>
                {canEdit && <button style={{ ...btn, padding: "4px 10px", fontSize: 12 }} onClick={() => deleteFlow(f.id)}>Delete</button>}
              </div>
            ))}
          </div>
        ) : !canEdit && (
          <p style={{ color: "var(--fg-4)", fontSize: 13, marginBottom: 0 }}>No flows have been defined.</p>
        )}
        {canEdit && <FlowBuilder creds={creds} actions={ACTIONS} onSave={addFlow} busy={busy === "flow"} />}
      </section>

      {/* 4. Preview + launch */}
      <section style={card}>
        <h2 style={h2}>Launch</h2>
        {!canLaunch ? (
          <p style={{ color: "var(--fg-4)", fontSize: 13 }}>You have view-only access. Ask an editor or the owner to run verification.</p>
        ) : preview ? (
          <div>
            <div style={{ fontSize: 13.5, color: "var(--fg-2)", marginBottom: 8 }}>
              <div>Target: {target?.label ?? "—"} · {target?.environment ?? "—"}{build?.version ? ` · ${build.version}` : ""}</div>
              <div>Selected flows: {preview.readiness.selectedCount}</div>
              <div>Price: <strong>{preview.price?.label ?? "—"}</strong></div>
            </div>
            {preview.readiness.blockers.length > 0 && (
              <ul style={{ margin: "8px 0", paddingLeft: 18, color: "var(--warn)", fontSize: 13 }}>
                {preview.readiness.blockers.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button style={btnPrimary} disabled={!preview.readiness.launchable || busy === "launch"} onClick={() => launch(false)}>{busy === "launch" ? "Running…" : "Run verification"}</button>
              <button style={btn} disabled={!preview.readiness.launchable || busy === "launch"} onClick={() => launch(true)} title="Re-check only the selected flows against a newer build">Re-run selected</button>
            </div>
          </div>
        ) : <p style={{ color: "var(--fg-3)", fontSize: 13 }}>Select at least one flow to see the price and launch.</p>}
      </section>

      {/* 5. Latest report (evidence-first) */}
      {run && (
        <section style={card}>
          <h2 style={h2}>Result</h2>
          {/* Beta chip sits ON the verdict, not in a footnote. API checking works and passes our own tests,
              but no outside customer has run their API through it, so it must not read at the same
              confidence as the browser verdict on the same screen. */}
          <div style={{ fontSize: 20, ...verdictTone(run.verdict), marginBottom: 4, display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            {publicVerdict(run.verdict)}
            <span className="pill" style={{ fontSize: 9.5, background: "var(--bg-2)", color: "var(--fg-4)", borderColor: "var(--line-2)", fontFamily: "var(--font-code)", letterSpacing: "0.06em" }}>BETA</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-4)", marginBottom: 12, lineHeight: 1.5 }}>
            API checking is new. Treat this as a signal to look at, not a gate to release on.
          </div>
          {run.flows.map((f, fi) => (
            <div key={fi} style={{ borderTop: "1px solid var(--line-1)", paddingTop: 10, marginTop: 10 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: f.state === "passed" ? "var(--ok)" : f.state === "failed" ? "var(--err)" : "var(--fg-3)" }}>{f.name}: {f.state}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                {f.steps.map((s, si) => (
                  <div key={si} style={{ fontSize: 12.5, color: "var(--fg-3)", display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span style={{ color: s.ok ? "var(--ok)" : "var(--err)" }}>{s.ok ? "✓" : "✗"}</span>
                    <span style={{ color: "var(--fg-2)" }}>{s.action}</span>
                    <span>{s.detail}</span>
                    {s.requests.map((t, ti) => <span key={ti} style={{ color: "var(--fg-4)" }}>{t.method} {t.path} → {t.status}</span>)}
                    <span style={{ color: "var(--fg-5)", marginLeft: "auto" }}>{s.ms}ms</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* 6. History / lineage */}
      {history.length > 0 && (
        <section style={card}>
          <h2 style={h2}>History</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {history.map((h) => (
              <button key={h.runId} onClick={async () => { const rep = await api(`/api-runs/${h.runId}`); if (rep.ok) setRun(rep.body as never); }}
                style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", border: "1px solid var(--line-1)", borderRadius: 8, background: "transparent", cursor: "pointer", textAlign: "left" }}>
                <span style={{ fontSize: 13, ...verdictTone(h.verdict) }}>{publicVerdict(h.verdict)}</span>
                <span style={{ fontSize: 12, color: "var(--fg-4)" }}>{h.createdAt ? new Date(h.createdAt).toLocaleString() : ""}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// The semantic flow builder — plain-language actions only.
function FlowBuilder({ creds, actions, onSave, busy }: { creds: Cred[]; actions: { id: string; label: string }[]; onSave: (name: string, steps: FlowStepUI[], priority: string) => Promise<boolean>; busy: boolean }) {
  const [name, setName] = useState(""); const [priority, setPriority] = useState("critical"); const [steps, setSteps] = useState<FlowStepUI[]>([]);
  const [open, setOpen] = useState(false);
  const addStep = (action: string) => setSteps((s) => [...s, { action }]);
  const setStep = (i: number, patch: Partial<FlowStepUI>) => setSteps((s) => s.map((st, j) => j === i ? { ...st, ...patch } : st));
  const save = async () => { if (await onSave(name, steps, priority)) { setName(""); setSteps([]); setOpen(false); } };

  if (!open) return <button style={btn} onClick={() => setOpen(true)}>+ New flow</button>;
  return (
    <div style={{ border: "1px dashed var(--line-2)", borderRadius: 10, padding: 14 }}>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 160px", marginBottom: 10 }}>
        <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Flow name (e.g. Projects persist)" />
        <select value={priority} onChange={(e) => setPriority(e.target.value)} style={input}><option value="critical">Critical</option><option value="important">Important</option><option value="informational">Informational</option></select>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ padding: 8, border: "1px solid var(--line-1)", borderRadius: 8 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>{i + 1}. {actionLabel(s.action)}</div>
            {s.action === "sign_in" && <select style={input} value={s.credentialLabel ?? ""} onChange={(e) => setStep(i, { credentialLabel: e.target.value })}><option value="">Choose a credential…</option>{creds.map((c) => <option key={c.id} value={c.label}>{c.label}</option>)}</select>}
            {s.action === "call" && <div style={{ display: "grid", gap: 6, gridTemplateColumns: "110px 1fr" }}><select style={input} value={s.method ?? "GET"} onChange={(e) => setStep(i, { method: e.target.value })}>{["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => <option key={m}>{m}</option>)}</select><input style={input} value={s.path ?? ""} onChange={(e) => setStep(i, { path: e.target.value })} placeholder="/path (e.g. /users)" /><textarea style={{ ...input, gridColumn: "1 / -1", minHeight: 44 }} value={s.body ?? ""} onChange={(e) => setStep(i, { body: e.target.value })} placeholder='Optional JSON body: {"name":"x"}' /></div>}
            {s.action === "expect_status" && <input style={input} type="number" value={s.status ?? ""} onChange={(e) => setStep(i, { status: Number(e.target.value) })} placeholder="200" />}
            {s.action === "expect_field" && <div style={{ display: "grid", gap: 6, gridTemplateColumns: "1fr 1fr" }}><input style={input} value={s.field ?? ""} onChange={(e) => setStep(i, { field: e.target.value })} placeholder="Field (e.g. id or data.name)" /><input style={input} value={s.value ?? ""} onChange={(e) => setStep(i, { value: e.target.value })} placeholder="Expected value (optional)" /></div>}
            {s.action === "expect_fields_exist" && <input style={input} value={s.value ?? ""} onChange={(e) => setStep(i, { value: e.target.value })} placeholder="Required fields, comma-separated" />}
            {s.action === "save_value" && <div style={{ display: "grid", gap: 6, gridTemplateColumns: "1fr 1fr" }}><input style={input} value={s.field ?? ""} onChange={(e) => setStep(i, { field: e.target.value })} placeholder="Field to save (e.g. id)" /><input style={input} value={s.into ?? ""} onChange={(e) => setStep(i, { into: e.target.value })} placeholder="Name it (e.g. PID)" /></div>}
            {s.action === "confirm_saved" && <div style={{ display: "grid", gap: 6, gridTemplateColumns: "1fr 1fr" }}><input style={input} value={s.path ?? ""} onChange={(e) => setStep(i, { path: e.target.value })} placeholder="/path to re-read" /><input style={input} value={s.field ?? ""} onChange={(e) => setStep(i, { field: e.target.value })} placeholder="Field that confirms it (e.g. persisted)" /></div>}
            {s.action === "add_header" && <div style={{ display: "grid", gap: 6, gridTemplateColumns: "1fr 1fr" }}><input style={input} value={s.name ?? ""} onChange={(e) => setStep(i, { name: e.target.value })} placeholder="Header name" /><input style={input} value={s.value ?? ""} onChange={(e) => setStep(i, { value: e.target.value })} placeholder="Header value" /></div>}
          </div>
        ))}
      </div>
      {steps.length > 0 && (
        <p style={{ fontSize: 11.5, color: "var(--fg-4)", margin: "0 0 8px" }}>
          Tip: reuse a value you saved by writing <code style={{ background: "var(--bg-2)", padding: "1px 4px", borderRadius: 4 }}>{"{{name}}"}</code> in a later path, header, or body — e.g. save the response <code style={{ background: "var(--bg-2)", padding: "1px 4px", borderRadius: 4 }}>token</code>, then use <code style={{ background: "var(--bg-2)", padding: "1px 4px", borderRadius: 4 }}>{"Bearer {{token}}"}</code> in an Authorization header.
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {actions.map((a) => <button key={a.id} style={{ ...btn, padding: "5px 9px", fontSize: 12 }} onClick={() => addStep(a.id)}>+ {a.label}</button>)}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={btnPrimary} disabled={busy || !name || steps.length === 0} onClick={save}>Save flow</button>
        <button style={btn} onClick={() => { setOpen(false); setSteps([]); setName(""); }}>Cancel</button>
      </div>
    </div>
  );
}
