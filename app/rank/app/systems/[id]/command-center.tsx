import Link from "next/link";
import { Ic, I } from "@/app/rank/_components/icons";
import type { NextAction, RibbonFact } from "@/lib/preflight/command-center";
import type { Tone as VerdictTone, Verdict as VerdictValue } from "@/lib/preflight/home-verdict";
import { LaunchPassButton } from "./launch-button";

// The Application Command Center: one decision strip that answers, in five seconds, what state this
// release is in and the ONE thing to do next. Not a dashboard — the verdict in its decision tone, a single
// dominant next action, and a ribbon of only-true state facts (absent facts don't render, so the ribbon's
// length itself reads as health). Every value is passed in from real application state; nothing is invented.

// THE HERO'S TONE IS DERIVED FROM THE VERDICT NOW, NOT HANDED IN BESIDE IT.
//
// This used to take a `tone` prop, built by the overview page from four private Tone constants. That table
// painted the VERIFIED hero with --acc-deep on --acc-soft, and on this surface --acc-deep resolves to
// #FAFAFA, the headline white: the product's one positive conclusion was the only settled state with no
// colour, at the largest size it is ever rendered. --go-ink exists precisely for it, and the census in
// authenticated.css moved 39 other real verdicts onto the go triad; this one was missed because its colour
// lived in a page rather than next to the verdict it described.
//
// It stays a table rather than becoming <Verdict> because this is a tinted PANEL at 3rem, not a badge: it
// needs the ink, the wash and the line separately, for a border, a ground, two kickers and a rule. It reads
// the SAME tokens <Verdict> reads and is keyed on the same Tone union, so a tone cannot be added to the
// vocabulary without the compiler stopping here too.
type Tone = { fg: string; bg: string; line: string };
const HERO_TONE: Record<VerdictTone, Tone> = {
  verified: { fg: "var(--go-ink)", bg: "var(--go-wash)", line: "var(--go-line)" },
  failed: { fg: "var(--stop-ink)", bg: "var(--stop-wash)", line: "var(--stop-line)" },
  blocked: { fg: "var(--wait-ink)", bg: "var(--wait-wash)", line: "var(--wait-line)" },
  progress: { fg: "var(--fg-3)", bg: "var(--bg-2)", line: "var(--line-2)" },
  unproven: { fg: "var(--fg-3)", bg: "var(--bg-2)", line: "var(--line-2)" },
};

const RIBBON_COLOR: Record<RibbonFact["tone"], string> = {
  good: "var(--go-ink)",
  warn: "var(--wait-ink)",
  bad: "var(--stop-ink)",
  muted: "var(--fg-4)",
};

export function CommandCenter({
  appId, verdict, subline, action, ribbon, launchFlowIds, canLaunch, canEditContract,
}: {
  appId: string;
  /** The run's public conclusion, from runVerdict(). A string used to be passed here, which is how this
   *  surface came to say "NOT TESTED" for the state four other pages each named differently. */
  verdict: VerdictValue;
  subline: string | null;     // the one honest supporting line for the verdict
  action: NextAction;
  ribbon: RibbonFact[];
  launchFlowIds: string[];    // the flow ids a LAUNCH action queues (already resolved eligible|critical)
  canLaunch: boolean;         // EDITOR+ : may run/rerun a pass (mirrors the /runs server min-role)
  canEditContract: boolean;   // EDITOR+ : may author/approve the contract (mirrors the contract server min-role)
}) {
  const tone = HERO_TONE[verdict.tone];
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
          {/* Uppercased in CSS rather than in the string, so the accessible name stays the vocabulary's own
              "Verified" / "Not yet verified" while the hero still reads in caps. */}
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(2rem, 4.2vw, 3rem)", lineHeight: 1.04, letterSpacing: "-0.01em", textTransform: "uppercase", color: tone.fg, marginTop: 8 }}>{verdict.label}</div>
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
