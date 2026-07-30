import Link from "next/link";
import { Ic, I } from "@/app/rank/_components/icons";
import type { NextAction, RibbonFact } from "@/lib/preflight/command-center";
import { LaunchPassButton } from "./launch-button";

// The Application Command Center: one decision strip that answers, in five seconds, what state this
// release is in and the ONE thing to do next. Not a dashboard — the verdict in its decision tone, a single
// dominant next action, and a ribbon of only-true state facts (absent facts don't render, so the ribbon's
// length itself reads as health). Every value is passed in from real application state; nothing is invented.

type Tone = { fg: string; bg: string; line: string };

const RIBBON_COLOR: Record<RibbonFact["tone"], string> = {
  good: "var(--go-ink)",
  warn: "var(--wait-ink)",
  bad: "var(--stop-ink)",
  muted: "var(--fg-4)",
};

export function CommandCenter({
  appId, verdict, subline, tone, action, ribbon, launchFlowIds, canLaunch, canEditContract,
}: {
  appId: string;
  verdict: string;            // VERIFIED / FAILED / BLOCKED / IN PROGRESS / NOT TESTED
  subline: string | null;     // the one honest supporting line for the verdict
  tone: Tone;
  action: NextAction;
  ribbon: RibbonFact[];
  launchFlowIds: string[];    // the flow ids a LAUNCH action queues (already resolved eligible|critical)
  canLaunch: boolean;         // EDITOR+ : may run/rerun a pass (mirrors the /runs server min-role)
  canEditContract: boolean;   // EDITOR+ : may author/approve the contract (mirrors the contract server min-role)
}) {
  const isQuiet = action.tone === "quiet";
  // A launch action renders the REAL launch control (posts /runs) — never a link to a page that can't run.
  const isLaunch = !!action.launch && launchFlowIds.length > 0;
  // An author-CTA is a NAVIGATE action into the contract editor (author/review/add-flows). A read-only
  // member can't use that editor, so we degrade it to an honest note instead of linking them into it.
  const isAuthorCTA = !action.launch && action.href.endsWith("/contract");
  // A read-only member gets NO mutating affordance: launches are hidden, author-CTAs degrade to a note.
  // View/inspect/review NAVIGATE actions (to a report or running pass) stay for everyone.
  const showReadOnlyNote = (isLaunch && !canLaunch) || (isAuthorCTA && !canEditContract);
  return (
    <section
      aria-label="Decision and next action"
      style={{ border: `1px solid ${tone.line}`, background: tone.bg, borderRadius: "var(--r-lg, 16px)", padding: "clamp(20px, 3vw, 30px)", marginTop: 6 }}
    >
      <div style={{ display: "flex", gap: "clamp(16px, 3vw, 32px)", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
        {/* Verdict — the thesis of the strip, in the decision tone at hero scale. */}
        <div style={{ minWidth: 0, flex: "1 1 320px" }}>
          <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.09em", textTransform: "uppercase", color: tone.fg, opacity: 0.85 }}>Decision</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(2rem, 4.2vw, 3rem)", lineHeight: 1.04, letterSpacing: "-0.01em", color: tone.fg, marginTop: 8 }}>{verdict}</div>
          {subline ? <p style={{ fontSize: 14.5, color: "var(--fg-1)", lineHeight: 1.5, margin: "10px 0 0", maxWidth: "52ch" }}>{subline}</p> : null}
        </div>

        {/* The ONE dominant next action. A quiet (healthy) state uses a ghost button so it doesn't shout.
            A read-only member sees an honest view-only note in this column instead of a control they
            can't use — the verdict + ribbon still read exactly the same. */}
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, maxWidth: 320 }}>
          <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.09em", textTransform: "uppercase", color: tone.fg, opacity: 0.7 }}>Next</div>
          {showReadOnlyNote ? (
            <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.5, margin: "2px 0 0" }}>
              View-only access. Ask an editor to {isLaunch ? "run a verification" : "update the contract"}.
            </p>
          ) : (
            <>
              {isLaunch ? (
                <LaunchPassButton appId={appId} flowIds={launchFlowIds} label={action.label} ghost={isQuiet} />
              ) : (
                <Link
                  href={action.href}
                  className={isQuiet ? "btn btn--ghost" : "btn btn--lg"}
                  style={{ display: "inline-flex", alignItems: "center", gap: 9, whiteSpace: "nowrap" }}
                >
                  {action.label}
                  <span aria-hidden style={{ display: "inline-flex" }}><Ic d={I.back} size={15} sw={2.2} style={{ transform: "scaleX(-1)" }} /></span>
                </Link>
              )}
              <p style={{ fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.45, margin: "2px 0 0" }}>{action.why}</p>
            </>
          )}
        </div>
      </div>

      {/* State ribbon: only-true facts, instrument-style. A short ribbon means a healthy app. */}
      {/* SPACING SEPARATES THESE, NOT PUNCTUATION. The facts were joined by middle dots, which read as
          content in a row of uppercase mono and add nothing a gap does not. Column gap only, so a wrapped
          ribbon never starts a line with an orphaned separator either. */}
      {ribbon.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 26px", marginTop: 18, paddingTop: 14, borderTop: `1px solid ${tone.line}` }}>
          {ribbon.map((f) => (
            <span key={f.key} style={{ fontFamily: "var(--font-code)", fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase", color: RIBBON_COLOR[f.tone] }}>{f.text}</span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
