"use client";

import { useEffect, useState } from "react";

type Theme = { label: string; read: string; option: string | null; quotes: string[] };

// Themes are summarization only. They never affect the recommendation or any
// number; the label below the panel says so. Lazily generated on first view (owner)
// and cached; a public/read-only report only shows what's already cached.
export function ThemesPanel({ testId, initial, readOnly }: { testId: string; initial: Theme[] | null; readOnly?: boolean }) {
  const [themes, setThemes] = useState<Theme[] | null>(initial);
  const [state, setState] = useState<"ready" | "loading" | "error">(initial ? "ready" : readOnly ? "ready" : "loading");

  async function load() {
    setState("loading");
    try {
      const r = await fetch(`/api/v/report-themes?id=${encodeURIComponent(testId)}`);
      const j = await r.json().catch(() => ({}));
      if (Array.isArray(j.themes)) { setThemes(j.themes); setState("ready"); }
      else setState("error");
    } catch { setState("error"); }
  }

  useEffect(() => { if (!initial && !readOnly) load(); /* eslint-disable-next-line */ }, []);

  // Nothing to show: read-only with no cached themes, or a completed generation that
  // found no grounded themes. Render nothing rather than an empty box.
  if ((readOnly && !themes) || (state === "ready" && (!themes || themes.length === 0))) return null;

  const head = { fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--acc-deep)", marginBottom: 12 };

  return (
    <div className="card" style={{ marginBottom: 22, borderColor: "var(--acc-line)" }}>
      <div style={head}>✦ Why people judged</div>

      {state === "loading" && (
        <div style={{ padding: "4px 0" }}>
          <div className="typing" style={{ marginBottom: 12 }}><i /><i /><i /></div>
          <div style={{ fontSize: 14, color: "var(--fg-2)", marginBottom: 14 }}>Summarizing the themes from real reasons…</div>
          {[78, 90, 62].map((w, i) => <div key={i} style={{ height: 11, width: `${w}%`, borderRadius: 6, background: "var(--bg-2)", marginBottom: 9 }} />)}
        </div>
      )}

      {state === "error" && (
        <div style={{ padding: "4px 0" }}>
          <p style={{ fontSize: 14, color: "var(--fg-2)", marginBottom: 12 }}>The theme summary didn&apos;t generate this time. The raw reasoning signals below are unaffected.</p>
          <button onClick={load} className="btn btn--ghost">Retry</button>
        </div>
      )}

      {state === "ready" && themes && themes.length > 0 && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {themes.map((t, i) => (
              <div key={i}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)" }}>{t.label}</span>
                  {t.option && <span className="pill" style={{ fontSize: 9.5, color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>Option {t.option}</span>}
                </div>
                <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: "3px 0 7px", lineHeight: 1.5 }}>{t.read}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {t.quotes.map((q, j) => (
                    <p key={j} style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.5, margin: 0, paddingLeft: 12, borderLeft: "2px solid var(--acc-line-2)" }}>&ldquo;{q}&rdquo;</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-5)", marginTop: 16, marginBottom: 0, lineHeight: 1.6 }}>Themes summarized by AI from real human reasoning. Quotes are verbatim from real judgments. The recommendation and every number come from the human judgments, not the summary.</p>
        </>
      )}
    </div>
  );
}
