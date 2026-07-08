"use client";

import { useEffect, useState } from "react";

type Q = { id: string; question: string; options: string[]; qualifying_options: string[] | null; is_required: boolean };
const inputStyle = { padding: "9px 12px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14, outline: "none", boxSizing: "border-box" as const };

export function ScreeningManager({ testId }: { testId: string }) {
  const [qs, setQs] = useState<Q[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [opts, setOpts] = useState<string[]>(["Yes", "No"]);
  const [qual, setQual] = useState<string[]>([]);
  const [required, setRequired] = useState(true);
  const [busy, setBusy] = useState("");

  async function load() { const r = await fetch(`/api/v/screening-questions?testId=${encodeURIComponent(testId)}`); if (r.ok) setQs((await r.json()).questions || []); setLoaded(true); }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function create() {
    const options = opts.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || options.length < 2 || busy) return;
    setBusy("create");
    try { await fetch("/api/v/screening-questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testId, question, options, qualifying: qual.filter((q) => options.includes(q)), isRequired: required }) }); } catch { /* ignore */ }
    setBusy(""); setOpen(false); setQuestion(""); setOpts(["Yes", "No"]); setQual([]); setRequired(true); load();
  }
  async function del(id: string) { setBusy(id); try { await fetch(`/api/v/screening-questions/${id}`, { method: "DELETE" }); } catch { /* ignore */ } setBusy(""); load(); }
  function setOpt(i: number, v: string) { setOpts((a) => a.map((x, j) => (j === i ? v : x))); }
  function toggleQual(o: string) { setQual((q) => (q.includes(o) ? q.filter((x) => x !== o) : [...q, o])); }

  const head = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--fg-4)" };

  return (
    <div className="card" style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <div style={head}>Audience screening</div>
        {!open && qs.length < 3 && <button onClick={() => setOpen(true)} className="btn btn--ghost" style={{ fontSize: 12.5, padding: "6px 12px" }}>Add question</button>}
      </div>

      {loaded && qs.length === 0 && !open && (
        <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: 0, lineHeight: 1.55 }}>Add screening questions to understand whether your signal matches the audience you care about. Disqualified responses never affect the report or your credits.</p>
      )}

      {qs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: open ? 16 : 0 }}>
          {qs.map((q) => (
            <div key={q.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderTop: "1px solid var(--line-1)" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg-1)" }}>{q.question}{q.is_required ? "" : <span style={{ color: "var(--fg-5)", fontWeight: 400 }}> | optional</span>}</div>
                <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 3 }}>{q.options.map((o) => (q.qualifying_options && q.qualifying_options.includes(o) ? `✓ ${o}` : o)).join("  |  ")}</div>
              </div>
              <button onClick={() => del(q.id)} disabled={busy === q.id} className="btn btn--ghost" style={{ fontSize: 12, padding: "5px 10px", color: "var(--fg-4)", flex: "none" }}>Remove</button>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 14, borderTop: qs.length ? "1px solid var(--line-1)" : "none" }}>
          <input style={inputStyle} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Question, e.g. Do you play Roblox?" maxLength={160} autoFocus />
          <div style={{ fontSize: 11.5, color: "var(--fg-4)" }}>Options (check the ones that qualify):</div>
          {opts.map((o, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input style={{ ...inputStyle, flex: 1 }} value={o} onChange={(e) => setOpt(i, e.target.value)} placeholder={`Option ${i + 1}`} maxLength={80} />
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--fg-3)" }}><input type="checkbox" checked={qual.includes(o)} onChange={() => toggleQual(o)} /> qualifies</label>
              {opts.length > 2 && <button onClick={() => setOpts((a) => a.filter((_, j) => j !== i))} className="btn btn--ghost" style={{ padding: "4px 10px" }}>×</button>}
            </div>
          ))}
          {opts.length < 6 && <button onClick={() => setOpts((a) => [...a, ""])} className="btn btn--ghost" style={{ alignSelf: "flex-start", fontSize: 12.5, padding: "5px 10px" }}>+ Add option</button>}
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--fg-2)" }}><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Required to continue</label>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={create} disabled={!question.trim() || opts.filter((o) => o.trim()).length < 2 || busy === "create"} className="btn" style={{ opacity: question.trim() && opts.filter((o) => o.trim()).length >= 2 ? 1 : 0.55 }}>{busy === "create" ? "Adding…" : "Add question"}</button>
            <button onClick={() => setOpen(false)} className="btn btn--ghost">Cancel</button>
          </div>
        </div>
      )}
      {qs.length > 0 && <p style={{ fontSize: 11, color: "var(--fg-5)", marginTop: 12, marginBottom: 0 }}>Participants answer these before judging. Those who don&apos;t qualify are counted but never affect your result.</p>}
    </div>
  );
}
