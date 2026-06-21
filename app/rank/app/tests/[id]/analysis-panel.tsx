"use client";

import { useEffect, useState } from "react";

type Analysis = { summary: string; why_winner: string; weaknesses: string[]; suggestions: string[]; confidence: string };

const headStyle = { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 } as const;

export function AnalysisPanel({ testId, initial, readOnly }: { testId: string; initial: Analysis | null; readOnly?: boolean }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(initial);
  const [state, setState] = useState<"ready" | "loading" | "error">(initial ? "ready" : readOnly ? "ready" : "loading");

  async function load() {
    setState("loading");
    try {
      const r = await fetch(`/api/v/report-analysis?id=${encodeURIComponent(testId)}`);
      const j = await r.json().catch(() => ({}));
      if (j.analysis) { setAnalysis(j.analysis); setState("ready"); }
      else setState("error");
    } catch { setState("error"); }
  }

  useEffect(() => { if (!initial && !readOnly) load(); /* eslint-disable-next-line */ }, []);

  // Public/read-only report with no cached analysis → render nothing.
  if (readOnly && !analysis) return null;

  return (
    <div className="card" style={{ marginBottom: 22, borderColor: "var(--acc-line)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)" }}>✦ Vraelis analysis</span>
        {analysis && <span className="pill" style={{ color: "var(--fg-4)" }}>confidence: {analysis.confidence}</span>}
      </div>

      {state === "loading" && (
        <div style={{ padding: "8px 0" }}>
          <div className="typing" style={{ marginBottom: 12 }}><i /><i /><i /></div>
          <div style={{ fontSize: 14, color: "var(--fg-2)", marginBottom: 14 }}>Analyzing the feedback and writing your report…</div>
          {[80, 92, 64].map((w, i) => <div key={i} style={{ height: 11, width: `${w}%`, borderRadius: 6, background: "var(--bg-2)", marginBottom: 9 }} />)}
        </div>
      )}

      {state === "error" && (
        <div style={{ padding: "6px 0" }}>
          <p style={{ fontSize: 14, color: "var(--fg-2)", marginBottom: 12 }}>The AI analysis didn&apos;t generate this time. Your votes and breakdown below are unaffected.</p>
          <button onClick={load} className="btn btn--ghost">Retry analysis</button>
        </div>
      )}

      {state === "ready" && analysis && (
        <>
          <p style={{ fontSize: 15.5, color: "var(--fg-1)", lineHeight: 1.55, marginBottom: 18, fontWeight: 500 }}>{analysis.summary}</p>
          <div className="cols-2" style={{ display: "grid", gap: 18 }}>
            <div>
              <div style={{ ...headStyle, color: "var(--acc-deep)" }}>Why it won</div>
              <p style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.55 }}>{analysis.why_winner}</p>
            </div>
            {analysis.weaknesses.length > 0 && (
              <div>
                <div style={{ ...headStyle, color: "var(--money)" }}>What held the others back</div>
                <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                  {analysis.weaknesses.map((w, i) => <li key={i} style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.5 }}>{w}</li>)}
                </ul>
              </div>
            )}
          </div>
          {analysis.suggestions.length > 0 && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line-1)" }}>
              <div style={{ ...headStyle, color: "var(--fg-4)" }}>What to improve next</div>
              <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                {analysis.suggestions.map((s, i) => <li key={i} style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.5 }}>{s}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
