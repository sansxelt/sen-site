"use client";

import { useState } from "react";
import { stashFreeCheckDraft } from "@/lib/free-check-draft";

// Public, logged-out entry to the free check. The visitor pastes their own AI output here;
// we stash it and route through signup, then the in-app form (/app/checks/new?draft=1)
// picks the draft back up and runs it, paid by the 25 free signup credits. Routing via
// /signin means a visitor who is ALREADY signed in passes straight through to the form.

const OUTPUT_TYPES: [string, string][] = [
  ["support_reply", "Support reply"],
  ["onboarding", "Onboarding"],
  ["marketing_copy", "Marketing copy"],
  ["agent_action", "Agent action"],
  ["other", "Other"],
];

const chip = (on: boolean) => ({
  padding: "10px 18px", borderRadius: 999, fontSize: 14, cursor: "pointer",
  border: `1px solid ${on ? "var(--acc-line)" : "var(--line-2)"}`,
  background: on ? "var(--acc-soft)" : "var(--bg-1)",
  color: on ? "var(--acc-deep)" : "var(--fg-3)",
  fontWeight: on ? 600 : 400,
} as const);

export function FreeCheckEntry() {
  const [outputType, setOutputType] = useState("support_reply");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  function go() {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    stashFreeCheckDraft({ outputType, candidates: [trimmed] });
    window.location.href = `/signin?mode=signup&callbackUrl=${encodeURIComponent("/app/checks/new?draft=1")}`;
  }

  return (
    <div style={{ border: "1px solid var(--line-1)", borderRadius: "var(--r-lg)", background: "var(--bg-1)", padding: "clamp(24px, 3.4vw, 38px)", marginBottom: 34, boxShadow: "var(--shadow-card)" }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(22px, 3vw, 28px)", letterSpacing: "-0.02em", color: "var(--fg-1)", marginBottom: 10 }}>Check your own AI output, free</div>
      <p style={{ fontSize: 16, color: "var(--fg-3)", lineHeight: 1.65, margin: "0 0 22px", maxWidth: 560 }}>
        Paste an AI-generated reply, email, or message. You get per-criterion scores, the version to ship, and the exact lines to fix in about 20 seconds.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginBottom: 16 }}>
        {OUTPUT_TYPES.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setOutputType(k)} style={chip(outputType === k)}>{label}</button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your AI output here…"
        rows={6}
        maxLength={8000}
        style={{ width: "100%", padding: "15px 17px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-2)", color: "var(--fg-1)", fontSize: 16, lineHeight: 1.6, resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "var(--font-sans)" }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginTop: 18 }}>
        <button type="button" className="btn btn--lg" onClick={go} disabled={busy || !text.trim()} style={{ opacity: busy || !text.trim() ? 0.6 : 1 }}>
          {busy ? "Taking you in…" : "Get my free check"} {!busy ? <span aria-hidden>→</span> : null}
        </button>
        <span style={{ fontSize: 13.5, color: "var(--fg-4)" }}>Free | ~20 seconds | no card</span>
      </div>
    </div>
  );
}
