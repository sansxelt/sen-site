"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { takeFreeCheckDraft } from "@/lib/free-check-draft";

// In-app AI Output Check form. Any signed-in user with credits can run one; it costs
// 1 credit and opens the report at /app/checks/<id>. Posts to /api/v/check (session).
// Laid out as a single-page review workspace: sectioned form + a sticky check summary.

type OutputOption = { key: string; label: string; criteria: string; hint: string };
// key must match a RUBRICS/OUTPUT_TYPES key in lib/v-evaluator.ts; criteria mirrors that rubric.
const OUTPUT_OPTIONS: OutputOption[] = [
  { key: "support_reply", label: "Customer support", criteria: "empathy, resolution, accuracy, tone, policy compliance", hint: "A message to a customer: support, success, or an account reply." },
  { key: "marketing_copy", label: "Marketing", criteria: "clarity, persuasion, differentiation, credibility, CTA strength", hint: "Copy meant to persuade: a landing hero, ad, email, or product page." },
  { key: "product_ux", label: "Product & UX", criteria: "clarity, usability, hierarchy, user intent, friction", hint: "In-product text or a screen: onboarding, empty states, tooltips, flows." },
  { key: "long_form", label: "Long-form content", criteria: "structure, coherence, completeness, accuracy, readability", hint: "A longer piece: an article, doc, guide, or report." },
  { key: "agent_action", label: "Agent action", criteria: "task completion, correctness, safety, tool use, unintended effects", hint: "What an AI agent did: a tool call, action, or task result." },
  { key: "other", label: "Custom", criteria: "clarity, instruction fit, effectiveness, risk", hint: "Anything else. Judged on general quality and instruction fit." },
];
const MAX_CANDIDATES = 8;

const lab = { fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "var(--fg-4)", display: "block", marginBottom: 8 };
const help = { fontSize: 12, color: "var(--fg-4)", margin: "6px 0 0", lineHeight: 1.5 };
const inputStyle = { width: "100%", padding: "11px 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14.5, fontFamily: "var(--font-sans)", outline: "none", boxSizing: "border-box" as const };

function SectionHead({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 11, marginBottom: 14 }}>
      <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--acc-soft)", color: "var(--acc-deep)", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12.5, flex: "none", marginTop: 1 }}>{n}</span>
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16.5, color: "var(--fg-1)", lineHeight: 1.2 }}>{title}</div>
        {hint ? <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 3, lineHeight: 1.5 }}>{hint}</div> : null}
      </div>
    </div>
  );
}

export default function NewCheckPage() {
  const router = useRouter();
  const [outputType, setOutputType] = useState("support_reply");
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("");
  const [candidates, setCandidates] = useState<string[]>([""]); // start with one; add more to compare
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const [published, setPublished] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [originalRequest, setOriginalRequest] = useState("");
  const [showDetails, setShowDetails] = useState(false); // Audience + success criteria stay collapsed by default

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
      if (OUTPUT_OPTIONS.some((o) => o.key === d.outputType)) setOutputType(d.outputType);
      if (d.candidates.length) setCandidates(d.candidates);
      if (d.title) setTitle(d.title);
      setPrefilled(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch { /* no storage / bad draft, fall through to the empty form */ }
  }, []);

  // Show the signed-in credit balance so the cost is never a surprise, and refresh it after a run.
  useEffect(() => {
    fetch("/api/credits/balance").then((r) => (r.ok ? r.json() : null)).then((j) => { if (typeof j?.balance === "number") setBalance(j.balance); }).catch(() => {});
  }, []);

  async function pasteRequest() {
    try { const t = await navigator.clipboard.readText(); if (t) setOriginalRequest(t.slice(0, 20000)); } catch { /* clipboard blocked; user can paste manually */ }
  }

  function setCandidate(i: number, v: string) { setCandidates((c) => c.map((x, j) => (j === i ? v : x))); }
  function addCandidate() { setCandidates((c) => (c.length >= MAX_CANDIDATES ? c : [...c, ""])); }
  function removeCandidate(i: number) { setCandidates((c) => (c.length <= 1 ? c : c.filter((_, j) => j !== i))); }

  const filled = candidates.map((t) => t.trim()).filter(Boolean);
  const shownVersions = filled.length || 1;

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
          original_request: originalRequest.trim() || undefined,
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

  const active = OUTPUT_OPTIONS.find((o) => o.key === outputType);
  const hasTask = originalRequest.trim().length > 0;
  const ctaText = busy ? "Starting…"
    : published ? "Find the highest-impact fix"
    : hasTask ? (filled.length > 1 ? "Compare instruction fit" : "Check instruction fit")
    : filled.length > 1 ? `Compare ${filled.length} versions` : "Run check";

  const summary: [string, string][] = [
    ["Review type", active?.label ?? "Custom"],
    ["Versions", `${shownVersions}`],
    ["Instruction fit", hasTask ? "On" : "Off"],
    ["Live output", published ? "On" : "Off"],
    ...(balance != null ? [["Your balance", balance.toLocaleString()] as [string, string]] : []),
    ["Cost", "1 credit"],
  ];

  return (
    <div className="wrap" style={{ maxWidth: 1000, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <p className="eyebrow" style={{ marginBottom: 0 }}>AI output check</p>
        {balance != null ? (
          <a href="/app/credits" style={{ textDecoration: "none", fontFamily: "var(--font-mono)", fontSize: 12, color: balance === 0 ? "var(--err)" : "var(--fg-3)", border: `1px solid ${balance === 0 ? "var(--err)" : "var(--line-2)"}`, borderRadius: 999, padding: "4px 12px", whiteSpace: "nowrap" }}>
            {balance.toLocaleString()} credit{balance === 1 ? "" : "s"}{balance === 0 ? " · buy more" : ""}
          </a>
        ) : null}
      </div>
      <h1 className="display" style={{ fontSize: "clamp(1.8rem, 3.4vw, 2.6rem)", margin: "6px 0 8px" }}>Check your AI output</h1>
      <p style={{ fontSize: 14.5, color: "var(--fg-3)", lineHeight: 1.6, marginBottom: 24, maxWidth: 620 }}>
        Submit one or more versions your AI produced. Vraelis returns a per-criterion assessment: how well each version did the task, the version to ship, and the exact lines to fix. One credit per check.
      </p>

      {prefilled ? (
        <div className="card" style={{ marginBottom: 22, borderColor: "var(--acc-line)", background: "var(--acc-soft)", padding: "12px 16px" }}>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--acc-deep)", lineHeight: 1.55 }}>
            Your output is loaded below. Hit <strong>Run check</strong> to see your results. Your first checks are on us.
          </p>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: "clamp(20px, 3vw, 40px)", alignItems: "start" }} className="cols-stack">
        {/* ── main form column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>

          {/* 1 · what are you checking */}
          <section>
            <SectionHead n={1} title="What are you checking?" hint="Pick the closest type. It sets the criteria each version is scored on." />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {OUTPUT_OPTIONS.map((o) => (
                <button key={o.key} type="button" onClick={() => setOutputType(o.key)}
                  style={{ padding: "8px 14px", borderRadius: 999, fontSize: 13, cursor: "pointer",
                    border: `1px solid ${outputType === o.key ? "var(--acc-line)" : "var(--line-2)"}`,
                    background: outputType === o.key ? "var(--acc-soft)" : "var(--bg-1)",
                    color: outputType === o.key ? "var(--acc-deep)" : "var(--fg-3)",
                    fontWeight: outputType === o.key ? 600 : 400 }}>
                  {o.label}
                </button>
              ))}
            </div>
            {active ? (
              <div style={{ marginTop: 12, padding: "11px 13px", background: "var(--bg-2)", border: "1px solid var(--line-1)", borderRadius: "var(--r-sm)" }}>
                <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: 0, lineHeight: 1.5 }}>{active.hint}</p>
                <p style={{ fontSize: 12, color: "var(--fg-4)", margin: "5px 0 0" }}>Scored on {active.criteria}.</p>
              </div>
            ) : null}
          </section>

          {/* 2 · what was the AI asked to do (original request → instruction fit) */}
          <section>
            <SectionHead n={2} title="What was the AI asked to do?" hint="Optional. Add it and the check also grades instruction fit, not just whether the output reads well." />
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
              <button type="button" onClick={pasteRequest} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11.5, color: "var(--acc-deep)", padding: 0, fontFamily: "inherit" }}>Paste from clipboard</button>
            </div>
            <textarea
              value={originalRequest}
              onChange={(e) => setOriginalRequest(e.target.value)}
              onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = `${Math.min(t.scrollHeight, 360)}px`; }}
              placeholder="Paste the prompt or task the AI was originally given."
              maxLength={20000}
              style={{ ...inputStyle, minHeight: 70, resize: "none", overflow: "auto", fontFamily: "var(--font-sans)", lineHeight: 1.55 }}
            />
            {originalRequest.length > 18000 ? <p style={{ fontSize: 11.5, color: "var(--fg-4)", margin: "6px 0 0", textAlign: "right" }}>{originalRequest.length.toLocaleString()} / 20,000</p> : null}
          </section>

          {/* 3 · add outputs (moved high, so the actual inputs come before the optional context) */}
          <section>
            <SectionHead n={3} title="Add your outputs" hint="Paste one version, or several to compare side by side. Up to 8." />
            <div style={{ display: "grid", gap: 12 }}>
              {candidates.map((c, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <div style={{ position: "absolute", top: 10, left: 12, fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)" }}>{String.fromCharCode(65 + i)}</div>
                  <textarea
                    value={c}
                    onChange={(e) => setCandidate(i, e.target.value)}
                    placeholder={i === 0 ? "Paste the first version here" : "Paste another version to compare"}
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
          </section>

          {/* 4 · evaluation details (check name always shown; audience + criteria collapsed by default) */}
          <section>
            <SectionHead n={4} title="Evaluation details" hint="Optional context that sharpens the scoring. Skip it for a fast check." />
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={lab} htmlFor="ck-title">Check name <span style={{ textTransform: "none", color: "var(--fg-5)" }}>(optional)</span></label>
                <input id="ck-title" style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cancellation reply, v3" maxLength={140} />
                <p style={help}>An optional name for this check.</p>
              </div>

              <div>
                <button type="button" onClick={() => setShowDetails((v) => !v)} aria-expanded={showDetails}
                  style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--acc-deep)", fontSize: 13, fontFamily: "inherit" }}>
                  <span aria-hidden style={{ fontFamily: "var(--font-mono)", fontSize: 15, lineHeight: 1 }}>{showDetails ? "−" : "+"}</span>
                  {showDetails ? "Hide audience and success criteria" : "Add audience and success criteria"}
                </button>
                {showDetails ? (
                  <div style={{ display: "grid", gap: 16, marginTop: 14 }}>
                    <div>
                      <label style={lab} htmlFor="ck-aud">Who is this for? <span style={{ textTransform: "none", color: "var(--fg-5)" }}>(optional)</span></label>
                      <input id="ck-aud" style={inputStyle} value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. A long-time customer, frustrated and asking to cancel" maxLength={200} />
                      <p style={help}>Describe the person expected to read or use the output.</p>
                    </div>
                    <div>
                      <label style={lab} htmlFor="ck-goal">Success criteria <span style={{ textTransform: "none", color: "var(--fg-5)" }}>(optional)</span></label>
                      <input id="ck-goal" style={inputStyle} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. De-escalates and gives a clear next step, without overpromising" maxLength={400} />
                      <p style={help}>What should a strong result accomplish?</p>
                    </div>
                  </div>
                ) : null}
              </div>

              <label htmlFor="ck-published" style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input id="ck-published" type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} style={{ marginTop: 3, accentColor: "var(--acc)", width: 16, height: 16, flex: "none" }} />
                <span style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.5 }}>This output is already published and live. Return the single highest-impact change to make, not a ship or no-ship verdict.</span>
              </label>
            </div>
          </section>

          {err ? <p style={{ fontSize: 13.5, color: "var(--err)", margin: 0 }}>{err}</p> : null}
        </div>

        {/* ── sticky check summary (desktop); stacks to the bottom on mobile ── */}
        <div className="sticky-side">
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" }}>Check summary</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {summary.map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                  <span style={{ color: "var(--fg-4)" }}>{k}</span>
                  <span style={{ color: "var(--fg-1)", fontFamily: "var(--font-mono)", fontWeight: 600, textAlign: "right" }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop: "1px solid var(--line-1)", paddingTop: 14 }}>
              <button type="button" className="btn btn--lg" onClick={submit} disabled={busy || filled.length < 1}
                style={{ width: "100%", justifyContent: "center", height: 48, fontSize: 15, fontWeight: 600, opacity: busy || filled.length < 1 ? 0.6 : 1 }}>
                {ctaText} {!busy ? <span aria-hidden>→</span> : null}
              </button>
              <p style={{ fontSize: 11.5, color: "var(--fg-4)", textAlign: "center", margin: "10px 0 0", lineHeight: 1.5 }}>
                You&apos;re only charged after a successful check.{balance === 0 ? <> Out of credits? <a href="/app/credits" style={{ color: "var(--acc-deep)" }}>Buy more</a>.</> : null}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
