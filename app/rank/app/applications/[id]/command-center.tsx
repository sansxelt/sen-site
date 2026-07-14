import Link from "next/link";
import { Ic, I } from "@/app/rank/_components/icons";
import type { NextAction, RibbonFact } from "@/lib/preflight/command-center";

// The Application Command Center: one decision strip that answers, in five seconds, what state this
// release is in and the ONE thing to do next. Not a dashboard — the verdict in its decision tone, a single
// dominant next action, and a ribbon of only-true state facts (absent facts don't render, so the ribbon's
// length itself reads as health). Every value is passed in from real application state; nothing is invented.

type Tone = { fg: string; bg: string; line: string };

const RIBBON_COLOR: Record<RibbonFact["tone"], string> = {
  good: "var(--acc-deep, #0A7B54)",
  warn: "#B45309",
  bad: "#C0392B",
  muted: "var(--fg-4)",
};

export function CommandCenter({
  verdict, subline, tone, action, ribbon,
}: {
  verdict: string;            // READY / BLOCKED / NEEDS REVIEW / REPAIR VERIFIED / IN PROGRESS / NOT TESTED
  subline: string | null;     // the one honest supporting line for the verdict
  tone: Tone;
  action: NextAction;
  ribbon: RibbonFact[];
}) {
  const isQuiet = action.tone === "quiet";
  return (
    <section
      aria-label="Launch decision and next action"
      style={{ border: `1px solid ${tone.line}`, background: tone.bg, borderRadius: "var(--r-lg, 16px)", padding: "clamp(20px, 3vw, 30px)", marginTop: 6 }}
    >
      <div style={{ display: "flex", gap: "clamp(16px, 3vw, 32px)", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
        {/* Verdict — the thesis of the strip, in the decision tone at hero scale. */}
        <div style={{ minWidth: 0, flex: "1 1 320px" }}>
          <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.09em", textTransform: "uppercase", color: tone.fg, opacity: 0.85 }}>Launch decision</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(2rem, 4.2vw, 3rem)", lineHeight: 1.04, letterSpacing: "-0.01em", color: tone.fg, marginTop: 8 }}>{verdict}</div>
          {subline ? <p style={{ fontSize: 14.5, color: "var(--fg-1)", lineHeight: 1.5, margin: "10px 0 0", maxWidth: "52ch" }}>{subline}</p> : null}
        </div>

        {/* The ONE dominant next action. A quiet (healthy) state uses a ghost button so it doesn't shout. */}
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, maxWidth: 320 }}>
          <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.09em", textTransform: "uppercase", color: tone.fg, opacity: 0.7 }}>Next</div>
          <Link
            href={action.href}
            className={isQuiet ? "btn btn--ghost" : "btn btn--lg"}
            style={{ display: "inline-flex", alignItems: "center", gap: 9, whiteSpace: "nowrap" }}
          >
            {action.label}
            <span aria-hidden style={{ display: "inline-flex" }}><Ic d={I.back} size={15} sw={2.2} style={{ transform: "scaleX(-1)" }} /></span>
          </Link>
          <p style={{ fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.45, margin: "2px 0 0" }}>{action.why}</p>
        </div>
      </div>

      {/* State ribbon: only-true facts, instrument-style. A short ribbon means a healthy app. */}
      {ribbon.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 0", marginTop: 18, paddingTop: 14, borderTop: `1px solid ${tone.line}` }}>
          {ribbon.map((f, i) => (
            <span key={f.key} style={{ display: "inline-flex", alignItems: "center" }}>
              {i > 0 ? <span aria-hidden style={{ color: "var(--fg-5)", margin: "0 10px" }}>·</span> : null}
              <span style={{ fontFamily: "var(--font-code)", fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase", color: RIBBON_COLOR[f.tone] }}>{f.text}</span>
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
