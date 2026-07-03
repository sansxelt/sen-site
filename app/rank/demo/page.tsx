import Link from "next/link";
import type { VOption, VReport } from "@/lib/v-db";
import { ogMeta } from "@/lib/og-meta";
import { ReportBody } from "@/app/rank/app/tests/[id]/report-body";

export const metadata = ogMeta({
  title: "Sample Decision Package",
  description: "An example Vraelis Decision Package, a human preference judgment between two model responses: which is more helpful, accurate, and safe, with confidence and signal quality. Built from demo data.",
  path: "/demo",
});

// Seeded sample. NOT real users; clearly labeled as demo data throughout. No DB,
// no auth, no billing: a static render of the real ReportBody so a first-time
// visitor sees the exact Decision Package a real evaluation produces. Pairwise
// model-output preference: the canonical AI-eval shape.
const CANDIDATES: { id: string; label: string; blurb: string }[] = [
  { id: "a", label: "Response A", blurb: "A direct answer, but states an unsupported claim as fact." },
  { id: "b", label: "Response B", blurb: "Answers the question, flags its uncertainty, and adds a safety caveat." },
];

const options: VOption[] = CANDIDATES.map((c, i) => ({ id: c.id, test_id: "demo", position: i, asset_url: null, label: c.label }));

const results: VReport["results"] = {
  total: 209,
  filtered: 31,
  winner_option_id: "b",
  ranked: [
    { id: "b", position: 1, label: "Response B", votes: 128, pct: 61 },
    { id: "a", position: 0, label: "Response A", votes: 81, pct: 39 },
  ],
  comments: [
    { option_id: "b", reason: "B was more accurate: A stated something that isn't actually true." },
    { option_id: "b", reason: "B flagged what it wasn't sure about instead of guessing." },
    { option_id: "b", reason: "Safer. B added the caveat a real user would need." },
    { option_id: "b", reason: "Both were clear, but B didn't overstate its confidence." },
    { option_id: "b", reason: "A sounded better but was subtly wrong on the key fact." },
    { option_id: "a", reason: "A was more direct and easier to read quickly." },
    { option_id: "a", reason: "A got to the point, though it skipped the caveat." },
  ],
  recommendation: "Response B",
};

export default function DemoReport() {
  return (
    <div className="wrap" style={{ maxWidth: 820, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      {/* demo banner: honest labeling, repeated where it matters */}
      <div className="card" style={{ marginBottom: 22, display: "flex", gap: 14, alignItems: "flex-start", background: "var(--bg-2)", borderColor: "var(--line-2)" }}>
        <span aria-hidden style={{ flex: "none", width: 34, height: 34, borderRadius: 9, background: "var(--bg-1)", border: "1px solid var(--line-2)", color: "var(--fg-3)", display: "grid", placeItems: "center", fontSize: 16 }}>◴</span>
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
            <span className="pill" style={{ background: "var(--acc-soft)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>Sample evaluation</span>
            <span className="pill" style={{ color: "var(--fg-4)" }}>Demo data</span>
          </div>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: 0, lineHeight: 1.55 }}>This is an <strong style={{ color: "var(--fg-1)" }}>example Decision Package</strong> built from demo data, not judged by real users. Run your own evaluation to get a real one.</p>
        </div>
      </div>

      <p className="eyebrow">Example Decision Package · model-output evaluation</p>
      <h1 className="display" style={{ fontSize: "clamp(1.8rem, 3.2vw, 2.5rem)", marginBottom: 8 }}>Which model response is more helpful, accurate, and safe?</h1>
      <p style={{ fontSize: 14.5, color: "var(--fg-3)", marginBottom: 14, lineHeight: 1.55 }}>A sample pairwise preference judgment between two model responses to the same prompt. Vraelis collects human preferences and filters low-quality responses (too fast, spam, IP velocity, per-device caps, low reputation) before building the Decision Package. Below, <strong style={{ color: "var(--fg-2)" }}>209 qualified judgments</strong> are shown alongside <strong style={{ color: "var(--fg-2)" }}>31 filtered responses</strong>; only the clean signal is used to recommend a preferred output, score confidence, and assess readiness. <strong style={{ color: "var(--fg-2)" }}>All figures below are illustrative demo data, not real judgments.</strong></p>
      <p style={{ fontSize: 14.5, color: "var(--fg-1)", marginBottom: 24, lineHeight: 1.55, fontWeight: 600 }}>This is the kind of Decision Package Vraelis returns after an evaluation: quality-filtered human preference data, not a poll result.</p>

      {/* Recommendation + why: the at-a-glance Decision Package summary */}
      <div className="card card--acc" style={{ marginBottom: 22, display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.1fr)", gap: "clamp(16px, 3vw, 28px)", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 6 }}>Recommendation</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(1.4rem, 3vw, 1.9rem)", letterSpacing: "-0.02em", marginBottom: 8 }}>Response B preferred</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[["Confidence", "High"], ["Readiness", "Strong"], ["Margin", "+22 pts"], ["Signal", "High"]].map(([k, v]) => (
              <span key={k} style={{ fontSize: 11, padding: "4px 9px", borderRadius: 999, background: "var(--bg-1)", border: "1px solid var(--acc-line)", color: "var(--fg-2)" }}><span style={{ color: "var(--fg-4)" }}>{k}:</span> <strong style={{ color: "var(--fg-1)" }}>{v}</strong></span>
            ))}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)", marginTop: 10 }}>209 qualified judgments · 31 filtered</div>
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 8 }}>Why people preferred B</div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 7 }}>
            {["More accurate: A stated an unsupported claim as fact", "Flagged its uncertainty instead of guessing", "Safer wording, with the caveat a real user needs", "Less overconfident on the key detail"].map((x) => (
              <li key={x} style={{ display: "flex", gap: 9, fontSize: 13, color: "var(--fg-2)", lineHeight: 1.45 }}><span style={{ color: "var(--acc-deep)", flex: "none" }}>✓</span>{x}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* the candidates being evaluated */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>The responses being judged</div>
      <div className="tile-grid cols-2" style={{ marginBottom: 26 }}>
        {CANDIDATES.map((c, i) => (
          <div key={c.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: "none", width: 30, height: 30, borderRadius: 8, background: "var(--acc-soft)", color: "var(--acc-deep)", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14 }}>{String.fromCharCode(65 + i)}</span>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)" }}>{c.label}</span>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: 0, lineHeight: 1.5 }}>{c.blurb}</p>
          </div>
        ))}
      </div>

      <ReportBody results={results} options={options} votesTarget={250} judgePool={{ uniqueJudges: 209, established: 96, cleanRecord: 90, cleanPct: 94 }} />

      {/* This is more than a result */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", margin: "30px 0 12px" }}>This is more than a result</div>
      <div className="tile-grid cols-3" style={{ marginBottom: 30 }}>
        {[
          ["Recommendation", "The preferred response, not a raw tally."],
          ["Confidence & signal quality", "Preference margin, directional confidence, and how clean the human signal was."],
          ["Decision readiness", "Whether the result is ready to act on, or needs more signal."],
          ["Confirmation round", "If it's close or noisy, run a follow-up round to confirm the call before you commit."],
          ["Audit-ready record", "The evaluation is logged to your workspace and organization activity trail."],
          ["Governed & API-ready", "Pull it by API or export; private controls, costs, and participant data never leak."],
        ].map(([t, d]) => (
          <div key={t} className="card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)" }}>{t}</div>
            <div style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55 }}>{d}</div>
          </div>
        ))}
      </div>

      {/* share / export / API-ready framing */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", margin: "8px 0 12px" }}>On a real report, you can</div>
      <div className="tile-grid cols-3" style={{ marginBottom: 30 }}>
        {[
          ["Share", "Publish a read-only public link anyone can open; no account needed."],
          ["Export", "Download the full result as JSON or CSV, with the decision summary included."],
          ["Use the API", "Pull the recommendation and intelligence into your own tools via the Vraelis API."],
        ].map(([t, d]) => (
          <div key={t} className="card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)" }}>{t}</div>
            <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: 0, lineHeight: 1.5 }}>{d}</p>
          </div>
        ))}
      </div>

      {/* What the demo represents */}
      <div className="card" style={{ background: "var(--bg-2)", marginBottom: 30 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, marginBottom: 6 }}>What the demo represents</div>
        <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: 0, lineHeight: 1.7 }}>This is a simplified example of one evaluation. In production, teams use Vraelis to evaluate model outputs, preference pairs, prompts, and product or creative directions, with automatic quality filtering, readiness checks, confirmation rounds, audit events, organization governance, and structured Decision Packages by API or export. The result above is quality-filtered human signal, not a poll.</p>
      </div>

      {/* Why responses get filtered: concrete quality proof */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", margin: "30px 0 12px" }}>Why responses get filtered</div>
      <div className="tile-grid cols-3" style={{ marginBottom: 30 }}>
        {[
          ["Too fast", "Responses submitted faster than a real consideration: not enough time for genuine judgment."],
          ["Spam or gibberish", "Comments that are nonsense, long character runs, or obvious spam."],
          ["IP velocity", "Too many responses from one source in a short window: flags vote-stuffing across runs."],
          ["Per-device cap", "Embedded collection limits responses per device per day."],
          ["Low reputation", "Evaluators rejected across most of their judgments over time are gated out."],
          ["What it means", "Filtered responses don't count toward your target and aren't charged. Only qualified signal ships."],
        ].map(([t, d]) => (
          <div key={t} className="card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)" }}>{t}</div>
            <div style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55 }}>{d}</div>
          </div>
        ))}
      </div>

      {/* Try this with your outputs */}
      <div className="card" style={{ background: "var(--bg-2)", marginBottom: 22, padding: "clamp(20px, 3vw, 28px)" }}>
        <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 10 }}>Try this with your outputs</div>
        <p style={{ fontSize: 15, color: "var(--fg-1)", marginBottom: 10, lineHeight: 1.55, fontWeight: 600 }}>Bring two model responses, prompt variants, or agent outputs. Vraelis will collect quality-filtered human judgment and return a Decision Package.</p>
        <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: 0, lineHeight: 1.6 }}>You get the preferred output, preference margin, directional confidence, signal-quality breakdown, decision readiness, and reasoning signals (via API, signed webhook, JSON/CSV export, or a shareable link). Participant data stays private, and you&apos;re not charged for filtered responses.</p>
      </div>

      {/* CTA */}
      <div className="card" style={{ textAlign: "center", borderColor: "var(--acc-line)", background: "var(--acc-soft)", padding: "clamp(24px, 4vw, 36px)" }}>
        <div className="display" style={{ fontSize: "clamp(1.4rem, 2.6vw, 1.9rem)", marginBottom: 8 }}>Start your first evaluation run.</div>
        <p style={{ fontSize: 14.5, color: "var(--fg-2)", maxWidth: 460, margin: "0 auto 20px", lineHeight: 1.55 }}>Get 25 free judgments on signup. No card required.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/app/new" className="btn btn--lg">Start an evaluation run →</Link>
          <Link href="/pricing" className="btn btn--ghost btn--lg">View pricing</Link>
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-5)", marginTop: 16, marginBottom: 0 }}>Building an AI product? Read the <Link href="/developers" style={{ color: "var(--acc-deep)" }}>API docs</Link>.</p>
      </div>
    </div>
  );
}
