import { ogMeta } from "@/lib/og-meta";
import { FREE_REPORT_URL } from "@/lib/links";

export const metadata = {
  ...ogMeta({
    title: "Human QA for AI output",
    description: "Human QA for AI output. Send the versions your app generates, real people judge which one wins, and you get a clear report on what to ship, and why. You pay only for responses that pass quality checks.",
    path: "/",
  }),
  title: { absolute: "Vraelis" },
};

// Minimal line icons: geometric, single-stroke, on-brand.
function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
const ICONS = {
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2",
  layers: "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5",
  flag: "M4 21V4M4 4h13l-2 4 2 4H4",
  film: "M3 4h18v16H3zM3 9h18M3 15h18M8 4v16M16 4v16",
  upload: "M12 16V4M8 8l4-4 4 4M4 20h16",
  users: "M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 20v-2a4 4 0 0 0-3-3.87M16 2.13A4 4 0 0 1 16 10",
  report: "M9 17v-6M12 17v-3M15 17v-9M4 4h16v16H4z",
  revenue: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
};

const AUDIENCE = [
  { t: "AI app builders shipping user-facing output", d: "Test the responses, messages, and content your app puts in front of users on real people, then ship the version they'll trust, backed by evidence instead of a guess.", i: ICONS.layers },
];

const STEPS = [
  { k: "01", t: "Submit candidates", d: "Model outputs, prompts, completions, or any artifact, 2 to 3 at a time. Via API, SDK, or the console.", i: ICONS.upload },
  { k: "02", t: "Define the judgment", d: "Pairwise preference, a rubric, or open reasoning. Add screening to qualify who judges before they answer.", i: ICONS.layers },
  { k: "03", t: "Collect qualified human signal", d: "Vraelis routes your evaluation to real people who judge and say why: the signal your automated metrics can't give you.", i: ICONS.users },
  { k: "04", t: "Filter low-quality responses", d: "Rushed, duplicate, gamed, and low-reputation responses are rejected automatically. Only qualified judgments count, and you're never charged for the rest.", i: ICONS.flag },
  { k: "05", t: "Review signal & readiness", d: "The Decision Package reads back the recommendation, preference margin, confidence, signal quality, and whether the result is ready to act on.", i: ICONS.spark },
  { k: "06", t: "Run a confirmation round if needed", d: "When a result is close or noisy, launch a follow-up round to confirm the call before you commit. Lineage tracked end to end.", i: ICONS.report },
  { k: "07", t: "Receive the Decision Package", d: "Pull the structured Decision Package by API or JSON / CSV, fire a signed webhook, and keep an audit record of every run.", i: ICONS.revenue },
];

const TESTABLE = ["Model output preference", "RLHF / reward signal", "Prompt & completion quality", "Safety & harm judgment", "Generated creative", "Product concepts", "Landing & copy", "Content variations"];

// Evaluation workflows AI and product teams actually run: what's compared, and the signal you get back.
const USE_CASES: { t: string; c: string; g: string }[] = [
  { t: "Model output evaluation", c: "Competing responses from your model or pipeline", g: "Which output people prefer, with confidence and a signal-quality read, as preference data." },
  { t: "RLHF & reward signal", c: "Response pairs for preference labeling", g: "Quality-filtered human preference judgments, exportable into your training pipeline." },
  { t: "Safety & helpfulness review", c: "Outputs your automated evals can't score", g: "Human judgment on helpfulness, accuracy, and harm, with an audit trail." },
  { t: "Prompt & system comparison", c: "Outputs from two prompts, models, or versions", g: "Which variant produces better responses, backed by qualified human signal." },
  { t: "Creative & product research", c: "Concepts, directions, or candidates", g: "Which direction people prefer, and the audience fit behind it." },
  { t: "Client & stakeholder approval", c: "The options you're choosing between", g: "A client-ready decision record that backs your recommendation." },
];

const IS_THINGS = ["Human QA for AI output: real-person judgment on what you generate, quality-filtered, via API", "Structured results returned as a typed Decision Package", "An automated quality gate that rejects rushed, duplicate, and gamed responses"];
const IS_NOT_THINGS = ["A cheap survey, poll, or microtask panel", "A raw vote count you have to interpret yourself", "Unfiltered crowdsourced responses you have to clean yourself"];

const REPORT_PARTS = [
  "The preferred output + full breakdown",
  "Preference margin and directional confidence",
  "Reasoning signals: why people judged it",
  "Signal-quality read: how clean the data is",
  "Valid-vs-filtered response counts",
  "A structured, exportable Decision Package",
];

const SUPPORTS: [string, string][] = [
  ["Quality-filtered signal", "Rushed, duplicate & gamed responses rejected automatically."],
  ["Pay only for valid", "Filtered responses don't count and aren't charged."],
  ["Human evaluation API", "Submit candidates, get a structured Decision Package."],
  ["Audience screening", "Qualify who judges before they answer."],
  ["Signed webhooks", "Get notified the moment an evaluation completes."],
  ["Schema-versioned exports", "Pull structured results as JSON or CSV."],
  ["Sandbox", "Exercise the whole flow at 0 credits / 0 quota."],
  ["Reputation gating", "Evaluators who get mostly rejected are gated out."],
];

// The value proposition: what an evaluation gives you, and what noisy signal costs.
const WHAT_YOU_GET: [string, string][] = [
  ["Preferred output", "the response people judged best"],
  ["Preference margin", "how clear the result was"],
  ["Directional confidence", "how strong the signal is"],
  ["Signal quality", "how clean the human data is"],
  ["Reasoning signals", "why people judged the way they did"],
  ["Valid vs. filtered", "what passed quality, and what didn't"],
  ["Structured Decision Package", "typed, schema-backed, exportable"],
  ["API + webhook + export", "for eval pipelines and internal tools"],
];
const COST_OF_WRONG: [string, string][] = [
  ["Noisy eval data", "ships a model change that humans actually rate worse."],
  ["Unfiltered crowdsourced responses", "bury real signal under rushed and gamed answers."],
  ["Running your own panel", "costs eng time to recruit, screen, and police quality."],
  ["Automated metrics alone", "miss helpfulness, tone, and harm that only people catch."],
  ["A model call with no human signal", "turns 'is this better?' into a guess."],
];

const API_RESPONSE = `{
  "id": "eval_9f2a3c",
  "status": "complete",
  "votes_valid": 122,
  "votes_filtered": 14,
  "winner": { "option": "B", "pct": 61 },
  "ranked": [
    { "option": "B", "pct": 61 },
    { "option": "A", "pct": 39 }
  ]
}`;

// the signature device: a verdict bar
function Verdict({ rows }: { rows: [string, number, boolean][] }) {
  return (
    <div className="verdict">
      {rows.map(([k, p, win]) => (
        <div className="vrow" key={k}>
          <span className="vrow__k">{k}</span>
          <span className="vrow__track"><span className={`vrow__fill${win ? " win" : ""}`} style={{ width: `${p}%` }} /></span>
          <span className="vrow__p">{p}%</span>
        </div>
      ))}
    </div>
  );
}

export default function RankLanding() {
  return (
    <>
      {/* ── Hero ── */}
      <section style={{ position: "relative" }}>
        <div className="glow glow--bleed" />
        <div className="grid-faint" />
        <div className="wrap" style={{ position: "relative", zIndex: 1, paddingTop: "clamp(48px, 7vw, 96px)", paddingBottom: "clamp(40px, 5vw, 68px)", textAlign: "center" }}>
          <p className="eyebrow rise" data-d="1" style={{ justifyContent: "center" }}>Human QA for AI output</p>
          <h1 className="display rise" data-d="2" style={{ fontSize: "clamp(2.5rem, 5.6vw, 4.4rem)", margin: "0 auto 22px", maxWidth: 920 }}>
            Test your AI app&apos;s output on <span className="em">real people</span>.
          </h1>
          <p className="rise" data-d="3" style={{ fontSize: "clamp(1.08rem, 1.45vw, 1.3rem)", color: "var(--fg-2)", maxWidth: 700, margin: "0 auto 30px", lineHeight: 1.55 }}>
            Know which version to ship, before your users see it. Submit the content your app generates (responses, images, copy), and real people judge which one wins. Vraelis filters rushed and gamed responses automatically and returns a structured Decision Package by API, webhook, or export. You pay only for responses that pass quality checks.
          </p>
          <div className="rise" data-d="4" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href={FREE_REPORT_URL} className="btn btn--lg">Get a free QA report <span aria-hidden>→</span></a>
            <a href="/r/sample" className="btn btn--ghost btn--lg">See a real report</a>
          </div>

          {/* Product preview: the verdict, right up front */}
          <div className="rise" data-d="5" style={{ position: "relative", maxWidth: 860, margin: "clamp(34px, 4vw, 52px) auto 0" }}>
            <div className="win" style={{ textAlign: "left", boxShadow: "var(--shadow-lg)" }}>
              <div className="win__bar"><span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, color: "var(--fg-2)" }}>Evaluation run</span><span className="pill" style={{ marginLeft: "auto", background: "var(--acc-soft)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>Complete</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.05fr)", gap: 0 }} className="cols-stack">
                {/* LEFT: the run, prompt, candidate responses, judgment criteria */}
                <div style={{ padding: "clamp(18px,2.4vw,26px)", borderRight: "1px solid var(--line-1)" }}>
                  <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 8 }}>Prompt</div>
                  <div style={{ fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.55, marginBottom: 14, padding: 11, background: "var(--bg-2)", borderRadius: 10, border: "1px solid var(--line-1)" }}>Which response is more helpful, accurate, and safe?</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                    {[["A", "Direct answer, but states one claim as fact without a caveat.", false], ["B", "Answers, flags its uncertainty, and adds a safety note.", true]].map(([l, d, win]) => (
                      <div key={l as string}>
                        <div style={{ fontFamily: "var(--font-code)", fontSize: 9, letterSpacing: "0.07em", textTransform: "uppercase", color: win ? "var(--acc-deep)" : "var(--fg-4)", marginBottom: 6 }}>Response {l}</div>
                        <div style={{ fontSize: 11.5, color: "var(--fg-3)", lineHeight: 1.5, padding: 10, background: "var(--bg-2)", borderRadius: 8, border: `1px solid ${win ? "var(--acc-line)" : "var(--line-2)"}`, minHeight: 60 }}>{d}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontFamily: "var(--font-code)", fontSize: 9.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 7 }}>Judgment criteria</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {["Helpful", "Accurate", "Safe"].map((c) => (
                      <span key={c} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, background: "var(--acc-soft)", border: "1px solid var(--acc-line)", color: "var(--acc-deep)" }}>{c}</span>
                    ))}
                  </div>
                </div>
                {/* RIGHT: the Decision Package output */}
                <div style={{ padding: "clamp(18px,2.4vw,26px)" }}>
                  <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 10 }}>Decision Package</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 11, background: "linear-gradient(135deg, var(--acc), var(--acc-deep))", flex: "none", display: "grid", placeItems: "center", color: "#fff", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18 }}>B</div>
                    <div>
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, color: "var(--fg-1)", letterSpacing: "-0.01em" }}>Response B preferred</div>
                      <span className="pill" style={{ marginTop: 4, background: "var(--acc-soft)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>High confidence</span>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 14 }}>
                    {[["Signal quality", "High"], ["Readiness", "Strong"], ["Filtered", "14 low-qual"], ["Delivery", "API + webhook"]].map(([l, v]) => (
                      <div key={l} style={{ padding: "9px 11px", borderRadius: 10, background: "var(--bg-2)", border: "1px solid var(--line-1)" }}>
                        <div style={{ fontFamily: "var(--font-code)", fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 3 }}>{l}</div>
                        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13.5, color: "var(--fg-1)" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontFamily: "var(--font-code)", fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-5)", marginBottom: 7 }}>Preference breakdown</div>
                  <Verdict rows={[["A", 39, false], ["B", 61, true]]} />
                  <div style={{ marginTop: 12, fontFamily: "var(--font-code)", fontSize: 10.5, color: "var(--fg-4)" }}>122 qualified judgments · 14 low-quality filtered</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why pay ── */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">Why Vraelis</p>
            <h2 className="display">You&apos;re not paying for raw responses. You&apos;re paying for <span className="em">signal you can trust</span>.</h2>
            <p>The hard part of human evals isn&apos;t collecting responses; it&apos;s trusting them. Vraelis filters the noise automatically, so what you get back is qualified human judgment, not raw responses you have to clean. Credits are the unit; trustworthy signal is the product.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.02fr) minmax(0,0.98fr)", gap: 16, alignItems: "stretch" }} className="cols-stack">
            <div className="card">
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 16 }}>What you get from an evaluation</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 11 }}>
                {WHAT_YOU_GET.map(([t, d]) => (
                  <li key={t} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                    <span style={{ width: 18, height: 18, flex: "none", marginTop: 2, borderRadius: "50%", background: "var(--acc-soft)", border: "1px solid var(--acc-line)", color: "var(--acc-deep)", display: "grid", placeItems: "center", fontSize: 11 }}>✓</span>
                    <span style={{ fontSize: 14.5, color: "var(--fg-2)" }}><strong style={{ color: "var(--fg-1)" }}>{t}</strong>: {d}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card" style={{ background: "var(--bg-2)" }}>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 16 }}>The cost of the wrong call</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 13 }}>
                {COST_OF_WRONG.map(([t, d]) => (
                  <li key={t} style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: 1.5 }}><strong style={{ color: "var(--fg-1)" }}>{t}</strong> {d}</li>
                ))}
              </ul>
              <p style={{ fontSize: 13.5, color: "var(--fg-2)", marginTop: 16, marginBottom: 0, fontWeight: 600 }}>Replace noisy, hand-cleaned eval data with qualified human judgment, on demand.</p>
            </div>
          </div>
          <div className="card card--acc" style={{ textAlign: "center", marginTop: 16, padding: "clamp(22px, 3vw, 30px)" }}>
            <div className="display" style={{ fontSize: "clamp(1.4rem, 2.8vw, 2rem)", marginBottom: 8 }}>Trust the signal, <span className="em">not the volume</span>.</div>
            <p style={{ fontSize: 13.5, color: "var(--fg-3)", maxWidth: 600, margin: "0 auto", lineHeight: 1.55 }}>Vraelis filters rushed, gamed, and low-reputation responses automatically, so you pay only for qualified judgments. The Decision Package tells you what passed quality, why people judged the way they did, and whether the signal is strong enough to act on. It informs your decisions; it is not a guarantee of model performance, sales, or outcomes.</p>
          </div>
        </div>
      </section>

      {/* ── Who uses Vraelis ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div className="sec-head sec-head--center">
            <p className="eyebrow">Who it's for</p>
            <h2 className="display">Built for teams shipping <span className="em">user-facing AI</span>.</h2>
            <p>Vraelis is human QA for AI output. Test the content your app generates on real people, learn which version your users will trust, and ship with evidence. Not a survey builder, polling tool, or crowdsourced panel: real people judge, automated gates filter the noise, and you get structured signal you can act on.</p>
          </div>
          <div className="tile-grid cols-1" style={{ maxWidth: 520, margin: "0 auto" }}>
            {AUDIENCE.map((a) => (
              <div key={a.t} className="acard">
                <div className="acard__icon"><Icon d={a.i} /></div>
                <div className="acard__t">{a.t}</div>
                <div className="acard__d">{a.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="section">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">The evaluation workflow</p>
            <h2 className="display">From candidates to <span className="em">trustworthy signal</span>.</h2>
            <p>A full evaluation lifecycle: submit, define the judgment, collect qualified signal, filter the noise, check readiness, and receive the Decision Package.</p>
          </div>
          <div className="tile-grid cols-2">
            {STEPS.map((s, i) => {
              // Odd count (7) leaves the last card orphaned in a 2-col grid; span + center it.
              const lastOdd = i === STEPS.length - 1 && STEPS.length % 2 === 1;
              return (
              <div key={s.k} className="acard" style={{ flexDirection: "row", gap: 18, alignItems: "flex-start", ...(lastOdd ? { gridColumn: "1 / -1", maxWidth: 620, marginInline: "auto", width: "100%" } : {}) }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, flex: "none" }}>
                  <div className="acard__icon" style={{ width: 42, height: 42 }}><Icon d={s.i} size={20} /></div>
                  <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-5)" }}>{s.k}</span>
                </div>
                <div>
                  <h3 style={{ fontSize: "clamp(1.1rem, 1.7vw, 1.35rem)", marginBottom: 7 }}>{s.t}</h3>
                  <p style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: 1.55 }}>{s.d}</p>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── The report ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,0.92fr) minmax(0,1.08fr)", gap: "clamp(28px, 4vw, 60px)", alignItems: "center" }} className="cols-stack">
            <div>
              <p className="eyebrow">The Decision Package</p>
              <h2 className="display" style={{ fontSize: "clamp(1.85rem, 3.3vw, 2.7rem)", marginBottom: 16 }}>Structured eval output, <span className="em">not a vote count</span>.</h2>
              <p className="lead-copy" style={{ marginBottom: 22 }}>Every run returns a typed Decision Package: the preferred output and confidence, signal-quality metrics, the valid-vs-filtered breakdown, and audit-ready data, delivered by API, webhook, or export, ready for your pipeline.</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
                {REPORT_PARTS.map((x) => (
                  <li key={x} style={{ display: "flex", gap: 11, fontSize: 14.5, color: "var(--fg-2)", alignItems: "flex-start" }}>
                    <span style={{ width: 18, height: 18, flex: "none", marginTop: 1, borderRadius: "50%", background: "var(--acc-soft)", border: "1px solid var(--acc-line)", color: "var(--acc-deep)", display: "grid", placeItems: "center", fontSize: 11 }}>✓</span>{x}
                  </li>
                ))}
              </ul>
              <div style={{ display: "flex", gap: 12, marginTop: 26, flexWrap: "wrap" }}>
                <a href="/app/new" className="btn">Start a decision</a>
                <a href="/pricing" style={{ alignSelf: "center", fontSize: 14, fontWeight: 500, color: "var(--acc-deep)", textDecoration: "none" }}>See what&apos;s included →</a>
              </div>
            </div>
            <div className="win" style={{ boxShadow: "var(--shadow-lg)" }}>
              <div className="win__bar"><span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, color: "var(--fg-2)" }}>Decision Package</span><span className="pill" style={{ marginLeft: "auto", background: "var(--acc-soft)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>Ready to act</span></div>
              <div style={{ padding: "clamp(18px,2.4vw,26px)" }}>
                <div className="card card--acc" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, boxShadow: "none", padding: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg, var(--acc), var(--acc-deep))", flex: "none", display: "grid", placeItems: "center", color: "#fff", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 20 }}>B</div>
                  <div>
                    <div style={{ fontFamily: "var(--font-code)", fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)" }}>Recommendation</div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 20, color: "var(--fg-1)" }}>Response B preferred</div>
                  </div>
                  <span className="pill" style={{ marginLeft: "auto", background: "var(--bg-1)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>High confidence</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                  {[["Signal quality", "High"], ["Readiness", "Strong"], ["Qualified", "122"], ["Filtered", "14"]].map(([l, v]) => (
                    <div key={l} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--bg-2)", border: "1px solid var(--line-1)" }}>
                      <div style={{ fontFamily: "var(--font-code)", fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-4)" }}>{l}</div>
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--fg-1)", marginTop: 2 }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: "var(--font-code)", fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-5)", marginBottom: 7 }}>Preference breakdown</div>
                <Verdict rows={[["A", 39, false], ["B", 61, true]]} />
                <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "var(--bg-2)", border: "1px solid var(--line-1)" }}>
                  <div style={{ fontFamily: "var(--font-code)", fontSize: 8.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 6 }}>Delivered via</div>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                    {["API", "Signed webhook", "JSON / CSV export"].map((m) => (
                      <span key={m} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--fg-3)" }}><span style={{ color: "var(--acc)", fontWeight: 600 }}>✓</span>{m}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── What teams test ── */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">What teams evaluate</p>
            <h2 className="display">Human QA, <span className="em">not a poll</span>.</h2>
            <p>Submit the candidates, collect qualified human judgment, get a Decision Package, and route the signal into your pipeline, your team, or your client, with the reasoning behind it.</p>
          </div>
          <div className="tile-grid cols-3" style={{ marginBottom: 22 }}>
            {USE_CASES.map((u) => (
              <div key={u.t} className="acard" style={{ gap: 8 }}>
                <div className="acard__t" style={{ fontSize: 15.5 }}>{u.t}</div>
                <div style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.55 }}><span style={{ color: "var(--fg-4)" }}>Compare:</span> {u.c}</div>
                <div style={{ fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.55 }}><span style={{ color: "var(--acc-deep)" }}>You get:</span> {u.g}</div>
              </div>
            ))}
          </div>
          <div className="chips" style={{ justifyContent: "center" }}>
            {TESTABLE.map((t) => <span key={t} className="chip">{t}</span>)}
          </div>

          {/* What Vraelis is / is not: own the category, not defensive */}
          <div className="card" style={{ marginTop: 26, background: "var(--bg-2)", borderRadius: "var(--r-xl)" }}>
            <div className="cols-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(18px, 3vw, 36px)" }}>
              <div>
                <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 10 }}>Vraelis is</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>{IS_THINGS.map((x) => <div key={x} style={{ display: "flex", gap: 9, fontSize: 13.5, color: "var(--fg-2)" }}><span style={{ color: "var(--acc)" }}>✓</span>{x}</div>)}</div>
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 10 }}>Vraelis is not</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>{IS_NOT_THINGS.map((x) => <div key={x} style={{ display: "flex", gap: 9, fontSize: 13.5, color: "var(--fg-4)" }}><span style={{ color: "var(--fg-5)" }}>✕</span>{x}</div>)}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── For AI apps: the external loop ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">For AI teams &amp; pipelines</p>
            <h2 className="display">Wire human evaluation into your stack.</h2>
            <p>Create evaluation runs by API, collect quality-filtered human signal, receive signed webhooks, and pull the structured Decision Package straight into your eval pipeline or product.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,0.92fr) minmax(0,1.08fr)", gap: 18, alignItems: "stretch", marginBottom: 16 }} className="cols-stack">
            {/* left: the loop, on cream */}
            <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 20 }}>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" }}>The external loop</div>
              <div style={{ display: "grid", gap: 14 }}>
                {[["Create run", "POST candidates via the API"], ["Human signal", "Real people choose and explain"], ["Webhook", "We notify you the moment it's done"], ["Export", "Pull the structured result"]].map(([s, d], i) => (
                  <div key={s as string} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ flex: "none", width: 28, height: 28, borderRadius: 9, background: "var(--acc-soft)", border: "1px solid var(--acc-line)", color: "var(--acc-deep)", display: "grid", placeItems: "center", fontFamily: "var(--font-code)", fontSize: 12.5, fontWeight: 600 }}>{i + 1}</span>
                    <div><div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14.5, color: "var(--fg-1)" }}>{s}</div><div style={{ fontSize: 12.5, color: "var(--fg-4)" }}>{d}</div></div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a href="/developers" className="btn">See the API</a>
                <a href="/developers#embed" className="btn btn--ghost">Embed in your site</a>
              </div>
            </div>
            {/* right: a real API response */}
            <div className="win" style={{ boxShadow: "var(--shadow-lg)" }}>
              <div className="win__bar" style={{ background: "#1C2733", borderBottom: "1px solid rgba(255,255,255,0.06)" }}><span style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "#94A1B2" }}>POST /api/v1/tests</span><span className="pill" style={{ marginLeft: "auto", background: "rgba(97,197,84,0.12)", color: "#8CE0B4", borderColor: "rgba(97,197,84,0.3)" }}>200 OK</span></div>
              <pre className="codeblock" style={{ borderRadius: 0, border: "none", boxShadow: "none", height: "100%" }}>{API_RESPONSE}</pre>
            </div>
          </div>
          <div className="tile-grid cols-3">
            {[["Plug in", "One API call", "Send candidates, get a structured Decision Package. Or embed it in your site."], ["Measure", "What people prefer", "Real preference signal on your generated outputs, quality filtered."], ["Use it", "Results in your app", "Pull the recommendation and structured data into your product."]].map(([k, t, d]) => (
              <div key={k} className="acard" style={{ gap: 6 }}>
                <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--acc-deep)" }}>{k}</div>
                <div className="acard__t">{t}</div>
                <div className="acard__d">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why the signal is cleaner: the real quality gates ── */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">Why the signal is cleaner</p>
            <h2 className="display">Real quality gates, <span className="em">not good faith</span>.</h2>
            <p>Vraelis runs automatic filters on every response. Rejected responses don&apos;t count toward your Decision Package, and you&apos;re never charged for them.</p>
          </div>
          <div className="tile-grid cols-3">
            {[
              ["Time-on-task floor", "Responses submitted faster than a real consideration are rejected as too fast to be genuine."],
              ["Gibberish & spam filtering", "Comments that are nonsense, repeated characters, or obvious spam are dropped automatically."],
              ["IP velocity limits", "Too many responses from one source in a short window are capped to stop vote-stuffing."],
              ["Per-device daily caps", "Embedded collection enforces a per-device daily limit on responses."],
              ["Reputation gating", "Evaluators whose responses are mostly rejected over time get gated out."],
              ["Pre-judgment screening", "Add screening questions to qualify who judges; disqualified participants never create a judgment."],
            ].map(([t, d]) => (
              <div key={t} className="acard" style={{ gap: 6 }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14.5, color: "var(--fg-1)" }}>{t}</div>
                <div style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5 }}>{d}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "18px 0 0", lineHeight: 1.6, textAlign: "center" }}>Every run reports valid-vs-filtered counts and filter reasons, so you can audit signal quality programmatically. A survey gives you responses; Vraelis gives you signal.</p>
        </div>
      </section>

      {/* ── Buyer objections: honest answers ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">For AI teams: honest answers</p>
            <h2 className="display">Questions we hear from <span className="em">builders</span>.</h2>
          </div>
          <div className="tile-grid cols-2">
            {[
              ["Why not just ask ChatGPT / an LLM to judge it?", "LLM-as-judge is useful, but it can't tell you what real people prefer, and judging your model's output with another model is circular: it carries its own training and self-preference bias, and it agrees with itself more than humans do. When the question is \"which will land with actual users\" (helpfulness, tone, trust, harm), you need human judgment. Vraelis gives you that as quality-filtered, structured data, alongside (not instead of) your automated evals."],
              ["Why not just use a cheap survey or panel?", "Panels ship you raw responses: you pay for volume, then hand-clean noise out of rushed and gamed answers. Vraelis filters automatically (time-on-task, IP velocity, reputation, screening) and you pay only for judgments that pass. A survey gives you responses; Vraelis gives you signal."],
              ["Who actually judges? Are they vetted experts?", "Real people completing evaluation tasks, not verified experts or a vetted specialist panel. Screening questions let you qualify who judges before they answer, and reputation gating removes evaluators who consistently produce rejected responses. For preference and eval data, that's real human preference, not expert opinion."],
              ["What happens to the responses you reject?", "Rejected responses are recorded for transparency but don't count toward your result, and you're not charged for them. You see valid-vs-filtered counts and filter reasons in every report and in the API response."],
              ["Can this plug into my eval pipeline?", "Yes: a REST API to create runs, signed webhooks on completion (no polling), and the typed Decision Package as JSON or CSV. Built to route preference and eval signal into RLHF, reward modeling, or your own scoring."],
              ["Is this lab-scale RLHF?", "Vraelis is built for quality-filtered human preference and eval signal via API, at the scale of your plan. Very large or highly custom human-data pipelines may need an enterprise setup; talk to us and we'll be straight about what fits."],
              ["Are you SOC 2 / SAML / SCIM?", "No SOC 2 today, and we won't claim it. OIDC SSO is live for verified domains; SAML configuration is in preview and SCIM is on the roadmap. Ask us and we'll be direct about timing and what's supported now."],
            ].map(([q, a], i, arr) => {
              // Odd count (7) leaves the last card orphaned in a 2-col grid; span it across
              // both columns and center it so the section ends balanced.
              const lastOdd = i === arr.length - 1 && arr.length % 2 === 1;
              return (
                <div key={q} className="card" style={lastOdd ? { gridColumn: "1 / -1", maxWidth: 560, marginInline: "auto", width: "100%" } : undefined}>
                  <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 12, lineHeight: 1.4 }}>{q}</div>
                  <p style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.6, margin: 0 }}>{a}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Pricing preview ── */}
      <section className="section">
        <div className="wrap">
          <div className="phead" style={{ marginBottom: "clamp(22px, 3vw, 34px)", alignItems: "flex-end" }}>
            <div className="sec-head" style={{ margin: 0, maxWidth: 560 }}>
              <p className="eyebrow">Pricing</p>
              <h2 className="display">Start with a free report.</h2>
            </div>
            <a href="/pricing" className="btn btn--ghost">See pricing →</a>
          </div>
          <div className="card card--acc" style={{ textAlign: "center", padding: "clamp(24px, 4vw, 40px)" }}>
            <div className="display" style={{ fontSize: "clamp(1.4rem, 2.8vw, 2rem)", marginBottom: 8 }}>Your first QA report is <span className="em">free</span>.</div>
            <p style={{ fontSize: 14, color: "var(--fg-3)", maxWidth: 560, margin: "0 auto 20px", lineHeight: 1.6 }}>Send us 2 to 3 versions of what your app generates. Real people judge which one to ship, and you get a clear report on the winner and why, quality-filtered, with the noise removed. $99 per report after your first.</p>
            <a href={FREE_REPORT_URL} className="btn btn--lg">Get a free QA report <span aria-hidden>→</span></a>
          </div>
        </div>
      </section>

      {/* ── Capability proof ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">What's live today</p>
            <h2 className="display">The quality controls are the <span className="em">product</span>.</h2>
            <p>From candidates to a Decision Package, plus a human evaluation API, signed webhooks, schema-versioned exports, and the automatic quality filtering that makes the signal worth trusting.</p>
          </div>
          <div className="tile-grid cols-4">
            {SUPPORTS.map(([t, d]) => (
              <div key={t} className="acard" style={{ gap: 6 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ color: "var(--acc)" }}>✓</span><span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14.5, color: "var(--fg-1)" }}>{t}</span></div>
                <div style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="section cta-band" style={{ borderBottom: "none" }}>
        <div className="glow glow--soft" />
        <div className="wrap" style={{ maxWidth: 720, textAlign: "center" }}>
          <h2 className="display" style={{ fontSize: "clamp(2.1rem, 4.4vw, 3.4rem)", marginBottom: 18 }}>Human signal for AI, <span className="em">without the cleanup</span>.</h2>
          <p className="lead-copy" style={{ margin: "0 auto 28px", textAlign: "center" }}>Get your first QA report free. Real people judge which version to ship, and you&apos;re never charged for the responses we filter out.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href={FREE_REPORT_URL} className="btn btn--lg">Get a free QA report <span aria-hidden>→</span></a>
            <a href="/r/sample" className="btn btn--ghost btn--lg">See a real report</a>
            <a href="/developers" className="btn btn--ghost btn--lg">Developers</a>
          </div>
        </div>
      </section>
    </>
  );
}
