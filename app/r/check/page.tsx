import Link from "next/link";
import { ogMeta } from "@/lib/og-meta";
import { CheckReport } from "@/app/rank/app/legacy/checks/[id]/check-report";
import { FreeCheckEntry } from "./free-check-entry";
import type { EvalResult } from "@/lib/v-evaluator";

// Public, static sample AI-check report, shareable without signing in. It renders the
// exact CheckReport component the real product uses, so it can't drift from the live
// report, with illustrative data on a made-up support reply. Everything here is an
// example: no real evaluation ran, and it says so plainly at the top and bottom.
// Retired AI-output checker sample. noindex so it is not advertised to search / prospects; the current
// product is the Production Pass (/free-report, /how-it-works).
export const metadata = ogMeta({
  title: "Sample AI output check",
  description: "A sample AI output check with the real report structure and illustrative data.",
  path: "/r/check",
  index: false,
});

// Two illustrative versions of a support reply to a double-charged customer. Version A
// minimizes and overpromises; Version B is specific and honest about the timeline. Every
// flag span below is a verbatim substring of its version's text (the report highlights
// them inline by exact match).
const A_TEXT =
  "Hi, thanks for reaching out! Don't worry, this is totally fine and happens all the time. I've gone ahead and fixed everything on our end, so you'll definitely see the refund back instantly. Is there anything else I can help you with today?";
const B_TEXT =
  "Hi Priya, thanks for flagging this, and I'm sorry for the scare of seeing two charges. I can see the duplicate charge from July 1 on your account, and I've submitted the refund for it now. Refunds usually land back on your card in 5 to 10 business days depending on your bank. I'll email you the moment it's confirmed on our side, and if it hasn't shown up by the 13th, reply here and I'll escalate it directly.";

const SAMPLE: EvalResult = {
  outputType: "support_reply",
  model: "claude-sonnet-4-6",
  assessment: "ai",
  recommendedIndex: 1,
  recommendedLabel: "B",
  margin: 33,
  recommendation:
    "Ship Version B. It names the exact charge, gives a real refund timeline, and commits to a follow-up, where Version A minimizes the problem and promises an instant refund it can't deliver.",
  candidates: [
    {
      index: 0,
      label: "A",
      text: A_TEXT,
      overall: 55,
      summary:
        "Friendly, but it minimizes a billing scare and makes a promise (instant refund) it can't keep, which sets up a second, angrier ticket.",
      scores: [
        { criterion: "empathy", label: "Empathy", score: 44, note: "Minimizes the concern instead of acknowledging it." },
        { criterion: "resolution", label: "Resolution", score: 60, note: "Claims a fix but gives no specifics or next step." },
        { criterion: "tone", label: "Tone", score: 68, note: "Warm, but glib for a money problem." },
        { criterion: "accuracy", label: "Accuracy & safety", score: 40, note: "'Instantly' is false for card refunds." },
      ],
    },
    {
      index: 1,
      label: "B",
      text: B_TEXT,
      overall: 88,
      summary:
        "Acknowledges the scare, names the exact duplicate charge, states a realistic timeline, and gives a clear fallback if it doesn't land. Honest and resolving.",
      scores: [
        { criterion: "empathy", label: "Empathy", score: 90, note: "Names the scare and apologizes for it." },
        { criterion: "resolution", label: "Resolution", score: 88, note: "Concrete action plus a dated fallback." },
        { criterion: "tone", label: "Tone", score: 89, note: "Warm and specific, not scripted." },
        { criterion: "accuracy", label: "Accuracy & safety", score: 86, note: "Realistic 5 to 10 day timeline; no false promise." },
      ],
    },
  ],
  flags: [
    {
      candidateIndex: 0,
      candidateLabel: "A",
      span: "this is totally fine and happens all the time",
      issue: "dismissive",
      severity: "medium",
      why: "Telling a double-charged customer it 'happens all the time' minimizes a real money worry and reads as dismissive.",
      fix: "Acknowledge the specific problem and apologize before reassuring: 'I'm sorry for the scare of seeing two charges.'",
    },
    {
      candidateIndex: 0,
      candidateLabel: "A",
      span: "you'll definitely see the refund back instantly",
      issue: "overpromise",
      severity: "high",
      why: "Card refunds don't post instantly; they take days. Promising 'instantly' guarantees a broken expectation and a follow-up complaint.",
      fix: "State the real timeline and commit to confirming: 'Refunds usually take 5 to 10 business days, and I'll email you when it clears.'",
    },
    {
      candidateIndex: 0,
      candidateLabel: "A",
      span: "I've gone ahead and fixed everything on our end",
      issue: "confusing",
      severity: "medium",
      why: "'Fixed everything' is vague and unverifiable, so the customer can't tell what actually happened to their money.",
      fix: "Name the exact action: 'I've submitted the refund for the July 1 duplicate charge.'",
    },
    {
      candidateIndex: 1,
      candidateLabel: "B",
      span: "the scare of seeing two charges",
      issue: "tone",
      severity: "low",
      why: "'Scare' is slightly informal. It fits most support voices, but a more formal brand might soften it.",
      fix: "Optional: 'I'm sorry to see the duplicate charge on your account' if your voice is more buttoned-up.",
    },
  ],
};

const box = { border: "1px solid var(--line-1)", borderRadius: "var(--r-lg)", background: "var(--bg-1)" } as const;
const kicker = { fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" } as const;

// Illustrative calibration teaser. No fabricated match number: it describes what a real
// check lets you do (send the same versions to real people) rather than asserting a stat.
function CalibrationTeaser() {
  return (
    <div style={{ ...box, background: "var(--bg-2)", padding: "clamp(16px, 2.4vw, 22px)", marginBottom: 18 }}>
      <div style={{ ...kicker, color: "var(--acc-deep)", marginBottom: 4 }}>Calibration layer</div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17, color: "var(--fg-1)" }}>Validate this on real people</div>
      <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.6, margin: "6px 0 12px" }}>
        In a real check, one click sends these same versions to real people. You get their preference and, over time,
        how often they agreed with the AI, so you know when the instant read is enough and when to get humans in the loop.
      </p>
      <Link href="/how-it-works" className="btn btn--ghost">How calibration works <span aria-hidden>→</span></Link>
    </div>
  );
}

export default function SampleCheck() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-2)" }}>
      <div className="wrap" style={{ maxWidth: 800, paddingTop: "clamp(34px, 5vw, 64px)", paddingBottom: 88 }}>
        {/* top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 30 }}>
          <Link href="/" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 21, color: "var(--fg-1)", textDecoration: "none", letterSpacing: "-0.02em" }}>Vraelis</Link>
          <span className="pill" style={{ fontSize: 11, color: "var(--fg-4)" }}>Sample check | illustrative data</span>
        </div>

        <FreeCheckEntry />

        <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "18px 0 28px" }}>
          <div style={{ height: 1, flex: 1, background: "var(--line-1)" }} />
          <span style={{ fontFamily: "var(--font-code)", fontSize: 11, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--fg-4)" }}>Or see a sample first</span>
          <div style={{ height: 1, flex: 1, background: "var(--line-1)" }} />
        </div>

        <p style={{ fontSize: 14.5, color: "var(--fg-4)", lineHeight: 1.65, margin: "0 0 26px" }}>
          A sample check on an example support reply, to show exactly what you get back on your own output.
        </p>

        <CheckReport result={SAMPLE} title="Reply to a double-charged customer" calibrationSlot={<CalibrationTeaser />} />

        {/* CTA */}
        <div style={{ textAlign: "center", marginTop: 48 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(20px, 2.6vw, 24px)", letterSpacing: "-0.02em", color: "var(--fg-1)", marginBottom: 16 }}>Run this on your own output</div>
          <Link href="/app/checks/new" className="btn btn--lg">Check your AI output <span aria-hidden>→</span></Link>
        </div>
      </div>
    </div>
  );
}
