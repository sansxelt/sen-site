"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { takeFreeCheckDraft } from "@/lib/free-check-draft";

// In-app AI Output Check form. Any signed-in user with credits can run one; it costs
// 1 credit and opens the report at /app/checks/<id>. Posts to /api/v/check (session).

const OUTPUT_TYPES: [string, string, string][] = [
  ["support_reply", "Support reply", "empathy, resolution, tone, accuracy"],
  ["onboarding", "Onboarding", "clarity, next step, reassurance, tone"],
  ["marketing_copy", "Marketing copy", "clarity, persuasion, overpromise, brand tone"],
  ["agent_action", "Agent action", "correctness, safety, completeness, reversibility"],
  ["other", "Other", "clarity, tone, risk, effectiveness"],
];
const MAX_CANDIDATES = 8;

const lab = { fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "var(--fg-4)", display: "block", marginBottom: 8 };
const inputStyle = { width: "100%", padding: "11px 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14.5, fontFamily: "var(--font-sans)", outline: "none", boxSizing: "border-box" as const };

export default function NewCheckPage() {
  const router = useRouter();
  const [outputType, setOutputType] = useState("support_reply");
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("");
  const [candidates, setCandidates] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const [published, setPublished] = useState(false);

  // Free-check handoff: a visitor who pasted their output on /r/check and signed up lands
  // here with ?draft=1. Consume the stashed draft once and fill the form so their first
  // action is a single "Run check" click. Best-effort; absent/stale drafts are ignored.
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("draft") !== "1") return;
      const d = takeFreeCheckDraft();
      if (!d) return;
      // Consuming a one-time client-only value (localStorage) on mount and syncing it into
      // form state is a legitimate external-system read; the react-compiler rule is
      // conservative here, and doing it in a lazy initializer would double-consume under
      // Strict Mode / SSR hydration.
      /* eslint-disable react-hooks/set-state-in-effect */
      if (OUTPUT_TYPES.some(([k]) => k === d.outputType)) setOutputType(d.outputType);
      if (d.candidates.length) setCandidates(d.candidates);
      if (d.title) setTitle(d.title);
      setPrefilled(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch { /* no storage / bad draft, fall through to the empty form */ }
  }, []);

  function setCandidate(i: number, v: string) { setCandidates((c) => c.map((x, j) => (j === i ? v : x))); }
  function addCandidate() { setCandidates((c) => (c.length >= MAX_CANDIDATES ? c : [...c, ""])); }
  function removeCandidate(i: number) { setCandidates((c) => (c.length <= 1 ? c : c.filter((_, j) => j !== i))); }

  const filled = candidates.map((t) => t.trim()).filter(Boolean);

  async function submit() {
    setErr(null);
    if (filled.length < 1) { setErr("Add at least one version to check."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/v/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          output_type: outputType,
          title: title.trim() || undefined,
          audience: audience.trim() || undefined,
          goal: goal.trim() || undefined,
          context: published ? "published" : undefined,
          candidates: filled.map((text) => ({ text })),
        }),
      });
      if (res.status === 401) { signIn(undefined, { callbackUrl: "/app/checks/new" }); return; }
      if (res.status === 402) { setErr("You're out of credits. A check costs 1 credit."); setBusy(false); return; }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j?.error === "evaluator_unavailable"
          ? "The evaluator is busy right now, and you were not charged. Try again in a moment."
          : "Something went wrong, and you were not charged. Try again.");
        setBusy(false);
        return;
      }
      const j = await res.json();
      // The check now runs in the background; land on the activity list where it shows
      // as "running" and flips to complete on its own.
      if (j?.id) router.push("/app/checks");
      else { setErr("Could not start the check. Try again."); setBusy(false); }
    } catch {
      setErr("Network error. Try again.");
      setBusy(false);
    }
  }

  const active = OUTPUT_TYPES.find(([k]) => k === outputType);

  return (
    <div className="wrap" style={{ maxWidth: 760, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <p className="eyebrow">AI output check</p>
      <h1 className="display" style={{ fontSize: "clamp(1.8rem, 3.4vw, 2.6rem)", margin: "6px 0 8px" }}>Check your AI output</h1>
      <p style={{ fontSize: 14.5, color: "var(--fg-3)", lineHeight: 1.6, marginBottom: 26, maxWidth: 560 }}>
        Paste one or more versions of an AI-generated output. You get an instant assessment: per-criterion scores, a recommended version, and the exact lines to fix. Costs 1 credit.
      </p>

      {prefilled ? (
        <div className="card" style={{ marginBottom: 22, borderColor: "var(--acc-line)", background: "var(--acc-soft)", padding: "12px 16px" }}>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--acc-deep)", lineHeight: 1.55 }}>
            Your output is loaded below. Hit <strong>Run check</strong> to see your results, your first checks are on us.
          </p>
        </div>
      ) : null}

      {/* output type */}
      <div style={{ marginBottom: 22 }}>
        <span style={lab}>Output type</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {OUTPUT_TYPES.map(([k, label]) => (
            <button key={k} type="button" onClick={() => setOutputType(k)}
              style={{ padding: "8px 14px", borderRadius: 999, fontSize: 13, cursor: "pointer",
                border: `1px solid ${outputType === k ? "var(--acc-line)" : "var(--line-2)"}`,
                background: outputType === k ? "var(--acc-soft)" : "var(--bg-1)",
                color: outputType === k ? "var(--acc-deep)" : "var(--fg-3)",
                fontWeight: outputType === k ? 600 : 400 }}>
              {label}
            </button>
          ))}
        </div>
        {active ? <p style={{ fontSize: 12, color: "var(--fg-4)", margin: "8px 0 0" }}>Judged on: {active[2]}.</p> : null}
      </div>

      {/* context */}
      <div style={{ display: "grid", gap: 16, marginBottom: 22 }}>
        <div>
          <label style={lab} htmlFor="ck-title">Title <span style={{ textTransform: "none", color: "var(--fg-5)" }}>(optional)</span></label>
          <input id="ck-title" style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cancellation reply, v3" maxLength={140} />
        </div>
        <div>
          <label style={lab} htmlFor="ck-aud">Audience <span style={{ textTransform: "none", color: "var(--fg-5)" }}>(optional)</span></label>
          <input id="ck-aud" style={inputStyle} value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. frustrated customer asking for a refund" maxLength={200} />
        </div>
        <div>
          <label style={lab} htmlFor="ck-goal">What &ldquo;good&rdquo; means here <span style={{ textTransform: "none", color: "var(--fg-5)" }}>(optional)</span></label>
          <input id="ck-goal" style={inputStyle} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. resolve the issue without overpromising a refund" maxLength={400} />
        </div>
        <label htmlFor="ck-published" style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
          <input id="ck-published" type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} style={{ marginTop: 3, accentColor: "var(--acc)", width: 16, height: 16, flex: "none" }} />
          <span style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.5 }}>This is already published (live). Get the single highest-impact change instead of a ship / no-ship verdict.</span>
        </label>
      </div>

      {/* candidates */}
      <div style={{ marginBottom: 22 }}>
        <span style={lab}>Versions to check</span>
        <div style={{ display: "grid", gap: 12 }}>
          {candidates.map((c, i) => (
            <div key={i} style={{ position: "relative" }}>
              <div style={{ position: "absolute", top: 10, left: 12, fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)" }}>{String.fromCharCode(65 + i)}</div>
              <textarea
                value={c}
                onChange={(e) => setCandidate(i, e.target.value)}
                placeholder={i === 0 ? "Paste the first version here…" : "Another version…"}
                rows={4}
                maxLength={50000}
                style={{ ...inputStyle, paddingLeft: 30, paddingTop: 10, resize: "vertical", fontFamily: "var(--font-sans)", lineHeight: 1.55 }}
              />
              {candidates.length > 1 ? (
                <button type="button" onClick={() => removeCandidate(i)} aria-label={`Remove version ${String.fromCharCode(65 + i)}`}
                  style={{ position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: 6, border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-4)", cursor: "pointer", fontSize: 13, lineHeight: 1 }}>×</button>
              ) : null}
            </div>
          ))}
        </div>
        {candidates.length < MAX_CANDIDATES ? (
          <button type="button" onClick={addCandidate} style={{ marginTop: 10, padding: "8px 14px", borderRadius: "var(--r-sm)", border: "1px dashed var(--line-2)", background: "transparent", color: "var(--fg-3)", cursor: "pointer", fontSize: 13 }}>
            + Add another version
          </button>
        ) : null}
      </div>

      {err ? <p style={{ fontSize: 13.5, color: "var(--err)", marginBottom: 14 }}>{err}</p> : null}

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <button type="button" className="btn btn--lg" onClick={submit} disabled={busy || filled.length < 1} style={{ opacity: busy || filled.length < 1 ? 0.6 : 1 }}>
          {busy ? "Starting…" : "Run check"} {!busy ? <span aria-hidden>→</span> : null}
        </button>
        <span style={{ fontSize: 12.5, color: "var(--fg-4)" }}>1 credit | you&apos;re not charged if it fails</span>
      </div>
    </div>
  );
}
