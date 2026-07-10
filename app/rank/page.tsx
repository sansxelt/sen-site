import Link from "next/link";
import { ogMeta } from "@/lib/og-meta";

export const metadata = {
  ...ogMeta({
    title: "QA for AI output",
    description: "Automated QA for the output your AI app ships. Get an instant check with per-criterion scores, the version to ship, and the exact lines to fix, with a stable pass/fail gate.",
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
  { t: "AI app builders shipping user-facing output", d: "Check the responses, messages, and content your app puts in front of users before they ship. Get scores, the version to ship, and the exact lines to fix, with a stable pass/fail gate.", i: ICONS.layers },
];

const STEPS = [
  { k: "01", t: "Paste your output", d: "One or more versions of what your app generates: a support reply, onboarding copy, an agent action. By API or in the app.", i: ICONS.upload },
  { k: "02", t: "Set the context", d: "Output type, audience, and what \"good\" means here. The rubric adapts, so a support reply is judged on empathy and safety, marketing on clarity and overpromise.", i: ICONS.layers },
  { k: "03", t: "Get the instant check", d: "Per-criterion scores, the version to ship, and line-level flags on the exact spans that read as dismissive, risky, or off.", i: ICONS.spark },
  { k: "04", t: "Apply the fixes", d: "Each flag comes with a concrete suggested rewrite for that span. Ship the version that scores best, with the problems already fixed.", i: ICONS.flag },
  { k: "05", t: "Ship the corrected version", d: "The recommended version with every fix already applied, in one clean block you can copy and paste.", i: ICONS.flag },
  { k: "06", t: "Ship, or check the next batch", d: "Pull the structured result by API or run it in the app. Every check is recorded, so you keep an audit trail.", i: ICONS.report },
];

const TESTABLE = ["Support replies", "Onboarding copy", "Marketing copy", "Agent actions", "Model output", "Prompts & completions", "Product copy", "Content variations"];

// What AI and product teams actually check: the output, and what the check gives back.
const USE_CASES: { t: string; c: string; g: string }[] = [
  { t: "Support replies", c: "The responses your agent drafts or sends", g: "Scores on empathy, resolution, and tone, plus the lines that read as dismissive, with a fix." },
  { t: "Onboarding & lifecycle", c: "The messages that greet and activate users", g: "Whether the next step is clear and the tone lands, with the exact copy to change." },
  { t: "Marketing copy", c: "Headlines, landing heroes, product copy", g: "Clarity and persuasion, plus any claim that overpromises or invites risk." },
  { t: "Agent actions", c: "What your agent decides to do", g: "Correctness and safety, with risky or irreversible steps flagged before they run." },
  { t: "Model & prompt comparison", c: "Output from two prompts, models, or versions", g: "Which version scores higher on the rubric, and exactly why." },
  { t: "Content at volume", c: "Variations, batches, and rewrites", g: "Score every version against the rubric, get the one to ship, and the exact lines to fix." },
];

const IS_THINGS = ["An instant AI check on the output your app ships: per-criterion scores, the version to ship, and the exact lines to fix", "A pass/fail gate that holds run to run, on a fixed rubric that adapts to your output type", "Structured results by API or in the app, with an audit trail you can act on"];
const IS_NOT_THINGS = ["A black-box score you can't inspect: every flag quotes the exact span, with a concrete fix", "A guarantee: it is an AI assessment, not a promise of outcomes", "A slow panel you wait days on before every ship"];

const REPORT_PARTS = [
  "The recommended version, computed from the scores",
  "Per-criterion scores on a rubric for your output type",
  "Line-level flags on the exact problem spans",
  "A concrete suggested fix for each flag",
  "An honest confidence read, never a guarantee",
  "Structured and exportable, by API or in the app",
];

const SUPPORTS: [string, string][] = [
  ["Instant AI check", "Scores, the version to ship, and line-level fixes in seconds."],
  ["Domain rubrics", "Criteria that shift by output type: support, onboarding, copy, agent."],
  ["Corrected version", "The recommended output with every fix applied, ready to copy."],
  ["Check API", "POST your output to /api/v1/check, get structured results."],
  ["Pay per check", "1 credit per check. New accounts start with free credits."],
  ["Signed webhooks", "Get notified the moment a check completes."],
  ["Schema-versioned exports", "Pull structured results as JSON or CSV."],
  ["Stable pass/fail gate", "The gate verdict holds run to run; scores are indicative, not gated."],
];

// The value proposition: what a check gives you, and what shipping unchecked costs.
const WHAT_YOU_GET: [string, string][] = [
  ["Recommended version", "the one to ship, computed from the scores"],
  ["Per-criterion scores", "on a rubric for your output type"],
  ["Line-level flags", "the exact spans that read as risky or off"],
  ["A concrete fix", "a suggested rewrite for each flag"],
  ["Stable pass/fail gate", "the gate verdict holds run to run"],
  ["Instant", "seconds, on every ship, not days"],
  ["By API or in the app", "for pipelines and internal tools"],
  ["An audit trail", "every check recorded and exportable"],
];
const COST_OF_WRONG: [string, string][] = [
  ["Shipping unchecked output", "a dismissive reply or an overpromise reaches real users."],
  ["An LLM marking its own work", "self-preference bias; it agrees with itself more than people do."],
  ["Automated metrics alone", "miss helpfulness, tone, and harm that only people catch."],
  ["Eyeballing every draft yourself", "slow, inconsistent, and it doesn't scale with your output."],
  ["A human panel for everything", "too slow for every ship, so most output goes out unchecked."],
];

const API_RESPONSE = `{
  "id": "chk_9f2a3c",
  "output_type": "support_reply",
  "assessment": "ai",
  "recommended": { "index": 1, "label": "B" },
  "candidates": [
    { "label": "B", "overall": 84 },
    { "label": "A", "overall": 61 }
  ],
  "flags": [
    { "candidate": "A", "issue": "overpromise",
      "span": "states one claim as fact",
      "fix": "add a caveat before the claim" }
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
        <div className="grid-faint" style={{ opacity: 0.55 }} />
        <div className="wrap" style={{ position: "relative", zIndex: 1, paddingTop: "clamp(48px, 7vw, 96px)", paddingBottom: "clamp(40px, 5vw, 68px)", textAlign: "center" }}>
          <p className="eyebrow rise" data-d="1" style={{ justifyContent: "center" }}>Instruction-aware AI output QA</p>
          <h1 className="display rise" data-d="2" style={{ fontSize: "clamp(2.4rem, 5.4vw, 4.2rem)", margin: "0 auto 22px", maxWidth: 860, lineHeight: 1.05, textWrap: "balance" }}>
            <span style={{ color: "var(--fg-3)" }}>Your AI answered.</span><br />
            Did it actually do the job?
          </h1>
          <p className="rise" data-d="3" style={{ fontSize: "clamp(1.08rem, 1.45vw, 1.3rem)", color: "var(--fg-2)", maxWidth: 700, margin: "0 auto 26px", lineHeight: 1.55 }}>
            Paste the original request and one or more AI outputs. Vraelis checks instruction fit, clarity, risk, and effectiveness, then recommends the version to ship and shows the exact lines to fix.
          </p>
          <div className="rise" data-d="4" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/app/checks/new" className="btn btn--lg">Check an AI output <span aria-hidden>→</span></Link>
            <Link href="/r/check" className="btn btn--ghost btn--lg">View a sample report</Link>
          </div>
          <p className="rise" data-d="4" style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "var(--fg-4)", margin: "14px 0 0" }}>1 credit per successful check · No charge if analysis fails</p>

          {/* Product preview: instruction fit in action — the request, per-version fit, and the pick */}
          <div className="rise" data-d="5" style={{ position: "relative", maxWidth: 880, margin: "clamp(24px, 3vw, 40px) auto 0" }}>
            <div className="win" style={{ textAlign: "left", boxShadow: "var(--shadow-lg)" }}>
              <div className="win__bar"><span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, color: "var(--fg-2)" }}>AI output check</span><span style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.05em", color: "var(--fg-5)", marginLeft: 9 }}>illustrative example</span><span className="pill" style={{ marginLeft: "auto", background: "var(--acc-soft)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>Instruction fit</span></div>
              <div style={{ padding: "clamp(18px,2.6vw,28px)" }}>
                {/* the original request */}
                <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 6 }}>Original request</div>
                <div style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.5, padding: "11px 13px", background: "var(--bg-2)", border: "1px solid var(--line-1)", borderRadius: 10, marginBottom: 16 }}>Explain the refund policy without promising the customer a refund.</div>
                {/* two versions, each with its overall score AND its instruction fit */}
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12, marginBottom: 16 }} className="cols-stack">
                  {[
                    { l: "A", overall: 74, fit: 35, kind: "Contradiction", note: "Promises that a refund will be issued.", win: false },
                    { l: "B", overall: 88, fit: 95, kind: "Satisfied", note: "Explains the policy clearly without guaranteeing an outcome.", win: true },
                  ].map((v) => (
                    <div key={v.l} style={{ padding: "13px 14px", background: "var(--bg-2)", borderRadius: 11, border: `1px solid ${v.win ? "var(--acc-line)" : "var(--line-2)"}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                        <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)" }}>Version {v.l}</span>
                        {v.win ? <span className="pill" style={{ background: "var(--acc-soft)", color: "var(--acc-deep)", borderColor: "var(--acc-line)", fontSize: 10 }}>Ship this</span> : null}
                      </div>
                      <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
                        <div><div style={{ fontFamily: "var(--font-code)", fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-5)" }}>Overall</div><div style={{ fontFamily: "var(--font-code)", fontSize: 16, color: "var(--fg-2)" }}>{v.overall}</div></div>
                        <div><div style={{ fontFamily: "var(--font-code)", fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-5)" }}>Instruction fit</div><div style={{ fontFamily: "var(--font-code)", fontSize: 16, color: v.win ? "var(--acc-deep)" : "var(--err)" }}>{v.fit}</div></div>
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--fg-3)" }}>
                        <span style={{ fontFamily: "var(--font-code)", fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: v.win ? "var(--acc-deep)" : "var(--err)" }}>{v.kind} </span>{v.note}
                      </div>
                    </div>
                  ))}
                </div>
                {/* the recommendation with the reason to ship */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 13, padding: "13px 14px", borderRadius: 11, border: "1px solid var(--acc-line)", background: "var(--acc-soft)" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, var(--acc), var(--acc-deep))", flex: "none", display: "grid", placeItems: "center", color: "#fff", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17 }}>B</div>
                  <div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--fg-1)" }}>Ship Version B</div>
                    <div style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5, marginTop: 2 }}>It follows the original request, avoids the unsupported promise, and gives the customer a clear next step.</div>
                  </div>
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
            <h2 className="display">You&apos;re not paying for another model&apos;s guess. You&apos;re paying for a check you can <span className="em">trust</span>.</h2>
            <p>The hard part isn&apos;t scoring output; it&apos;s trusting the score. Vraelis checks your output against a domain rubric with a fail-closed pass/fail gate whose verdict is measured for run-to-run stability, so what you get back is a check you can trust, not a model marking its own homework. Credits are the unit; a trustworthy check is the product.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.02fr) minmax(0,0.98fr)", gap: 16, alignItems: "stretch" }} className="cols-stack">
            <div className="card">
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 16 }}>What you get from a check</div>
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
              <p style={{ fontSize: 13.5, color: "var(--fg-2)", marginTop: 16, marginBottom: 0, fontWeight: 600 }}>Replace shipping-and-hoping with an instant check and a stable pass/fail gate.</p>
            </div>
          </div>
          <div className="card card--acc" style={{ textAlign: "center", marginTop: 16, padding: "clamp(22px, 3vw, 30px)" }}>
            <div className="display" style={{ fontSize: "clamp(1.4rem, 2.8vw, 2rem)", marginBottom: 8 }}>Trust the check, <span className="em">calibrated on people</span>.</div>
            <p style={{ fontSize: 13.5, color: "var(--fg-3)", maxWidth: 600, margin: "0 auto", lineHeight: 1.55 }}>The instant check gives you scores, the version to ship, and the exact lines to fix, with a pass/fail gate that holds run to run. Human validation on real people is coming, for when the call matters. It informs your decisions; it is an AI assessment, not a guarantee of outcomes.</p>
          </div>
        </div>
      </section>

      {/* ── Who uses Vraelis ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div className="sec-head sec-head--center">
            <p className="eyebrow">Who it&apos;s for</p>
            <h2 className="display">Built for teams shipping <span className="em">user-facing AI</span>.</h2>
            <p>Vraelis is automated QA for AI output. Paste what your app generates and get an instant check with scores, the version to ship, and the lines to fix. The pass/fail gate is measured for run-to-run stability, and an optional human-validation layer is coming.</p>
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
            <p className="eyebrow">How it works</p>
            <h2 className="display">From raw output to a check you can <span className="em">trust</span>.</h2>
            <p>Paste your output, set the context, and get an instant check: scores, the version to ship, and the lines to fix. Human validation on real people is coming.</p>
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
              <p className="eyebrow">The check report</p>
              <h2 className="display" style={{ fontSize: "clamp(1.85rem, 3.3vw, 2.7rem)", marginBottom: 16 }}>Structured check output, <span className="em">not a vibe</span>.</h2>
              <p className="lead-copy" style={{ marginBottom: 22 }}>Every check returns a typed report: the recommended version, per-criterion scores, line-level flags with a suggested fix, and an honest confidence read, delivered by API or in the app, ready for your pipeline.</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
                {REPORT_PARTS.map((x) => (
                  <li key={x} style={{ display: "flex", gap: 11, fontSize: 14.5, color: "var(--fg-2)", alignItems: "flex-start" }}>
                    <span style={{ width: 18, height: 18, flex: "none", marginTop: 1, borderRadius: "50%", background: "var(--acc-soft)", border: "1px solid var(--acc-line)", color: "var(--acc-deep)", display: "grid", placeItems: "center", fontSize: 11 }}>✓</span>{x}
                  </li>
                ))}
              </ul>
              <div style={{ display: "flex", gap: 12, marginTop: 26, flexWrap: "wrap" }}>
                <Link href="/app/checks/new" className="btn">Check your AI output</Link>
                <Link href="/pricing" style={{ alignSelf: "center", fontSize: 14, fontWeight: 500, color: "var(--acc-deep)", textDecoration: "none" }}>See what&apos;s included →</Link>
              </div>
            </div>
            <div className="win" style={{ boxShadow: "var(--shadow-lg)" }}>
              <div className="win__bar"><span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, color: "var(--fg-2)" }}>AI check</span><span className="pill" style={{ marginLeft: "auto", background: "var(--acc-soft)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>Instant</span></div>
              <div style={{ padding: "clamp(18px,2.4vw,26px)" }}>
                <div className="card card--acc" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, boxShadow: "none", padding: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg, var(--acc), var(--acc-deep))", flex: "none", display: "grid", placeItems: "center", color: "#fff", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 20 }}>B</div>
                  <div>
                    <div style={{ fontFamily: "var(--font-code)", fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)" }}>Recommendation</div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 20, color: "var(--fg-1)" }}>Ship Version B</div>
                  </div>
                  <span className="pill" style={{ marginLeft: "auto", background: "var(--bg-1)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>Score 84</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                  {[["Clarity", "88"], ["Tone", "82"], ["Accuracy", "90"], ["Overall", "84"]].map(([l, v]) => (
                    <div key={l} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--bg-2)", border: "1px solid var(--line-1)" }}>
                      <div style={{ fontFamily: "var(--font-code)", fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-4)" }}>{l}</div>
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--fg-1)", marginTop: 2 }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: "var(--font-code)", fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-5)", marginBottom: 7 }}>Per-version score</div>
                <Verdict rows={[["A", 61, false], ["B", 84, true]]} />
                <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "var(--bg-2)", border: "1px solid var(--line-1)" }}>
                  <div style={{ fontFamily: "var(--font-code)", fontSize: 8.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 6 }}>Delivered via</div>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                    {["API", "In the app", "JSON / CSV export"].map((m) => (
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
            <p className="eyebrow">What teams check</p>
            <h2 className="display">A check for <span className="em">every kind of output</span>.</h2>
            <p>Paste the output, get an instant check with scores and the lines to fix, and route the structured result into your pipeline, your team, or your client. Human validation on real people is coming.</p>
          </div>
          <div className="tile-grid cols-3" style={{ marginBottom: 22 }}>
            {USE_CASES.map((u) => (
              <div key={u.t} className="acard" style={{ gap: 8 }}>
                <div className="acard__t" style={{ fontSize: 15.5 }}>{u.t}</div>
                <div style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.55 }}><span style={{ color: "var(--fg-4)" }}>Check:</span> {u.c}</div>
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
            <h2 className="display">Wire the check into your <span className="em">pipeline</span>.</h2>
            <p>POST your output to the check API and get structured results back in one call: scores, the version to ship, and line-level fixes. Route them into your CI, your app, or your review flow. Human validation on real people is coming.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,0.92fr) minmax(0,1.08fr)", gap: 18, alignItems: "stretch", marginBottom: 16 }} className="cols-stack">
            {/* left: the loop, on cream */}
            <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 20 }}>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" }}>The external loop</div>
              <div style={{ display: "grid", gap: 14 }}>
                {[["Send output", "POST to /api/v1/check"], ["Instant check", "Scores, the pick, and flags come back"], ["Apply fixes", "Ship the version to ship"], ["Corrected version", "Every fix applied, ready to copy"]].map(([s, d], i) => (
                  <div key={s as string} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ flex: "none", width: 28, height: 28, borderRadius: 9, background: "var(--acc-soft)", border: "1px solid var(--acc-line)", color: "var(--acc-deep)", display: "grid", placeItems: "center", fontFamily: "var(--font-code)", fontSize: 12.5, fontWeight: 600 }}>{i + 1}</span>
                    <div><div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14.5, color: "var(--fg-1)" }}>{s}</div><div style={{ fontSize: 12.5, color: "var(--fg-4)" }}>{d}</div></div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href="/developers" className="btn">See the API</Link>
                <Link href="/developers#embed" className="btn btn--ghost">Embed in your site</Link>
              </div>
            </div>
            {/* right: a real API response */}
            <div className="win" style={{ boxShadow: "var(--shadow-lg)" }}>
              <div className="win__bar" style={{ background: "#1C2733", borderBottom: "1px solid rgba(255,255,255,0.06)" }}><span style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "#94A1B2" }}>POST /api/v1/check</span><span className="pill" style={{ marginLeft: "auto", background: "rgba(97,197,84,0.12)", color: "#8CE0B4", borderColor: "rgba(97,197,84,0.3)" }}>200 OK</span></div>
              <pre className="codeblock" style={{ borderRadius: 0, border: "none", boxShadow: "none", height: "100%" }}>{API_RESPONSE}</pre>
            </div>
          </div>
          <div className="tile-grid cols-3">
            {[["Plug in", "One API call", "POST your output to /api/v1/check and get scores, the pick, and fixes back."], ["Catch", "Before your users", "Flag dismissive, risky, or overpromising lines before they ship."], ["Use it", "Results in your app", "Pull the recommendation and structured data into your product or CI."]].map(([k, t, d]) => (
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
            <p className="eyebrow">Human validation is coming</p>
            <h2 className="display">Built for real quality gates, <span className="em">not good faith</span>.</h2>
            <p>An optional human-validation layer is on the way. When it ships, you&apos;ll route a check to real people and Vraelis will run automatic filters on every response, so rushed and gamed answers are rejected and you&apos;re only charged for genuine judgment. Here is how it will stay honest.</p>
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
          <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "18px 0 0", lineHeight: 1.6, textAlign: "center" }}>Every validation will report valid-vs-filtered counts and filter reasons, so you can audit it programmatically. Until it ships, the product is the instant AI check.</p>
        </div>
      </section>

      {/* ── Buyer objections: honest answers ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">For AI teams: honest answers</p>
            <h2 className="display">Questions we hear from <span className="em">builders</span>.</h2>
            <p>ChatGPT tells you what it thinks. Vraelis gives you a neutral check with a fixed rubric and a stable pass/fail gate, in your pipeline, on the output your app ships.</p>
          </div>
          <div className="tile-grid cols-2">
            {[
              ["Why not just ask ChatGPT to check it?", "Because ChatGPT gives you an opinion and can't tell you whether it's right. A model grading its own kind of output is circular: biased toward its own style, with no ground truth to check against. Vraelis is a neutral check with a scoreboard. It applies the same domain rubric every time (a support reply on empathy and resolution, marketing on clarity and overpromise), so the same criteria are applied every time and versions stay comparable, and it runs in your pipeline as an API, not a chat tab someone has to remember to open. And its pass/fail gate is measured for run-to-run stability and published, so you are not trusting a score that moves. Checking one message? ChatGPT is free and fine. Vraelis is for teams shipping output at volume that need a consistent rubric, automation, and a stable gate."],
              ["Why not just use a cheap survey or panel? (human validation, coming)", "Panels ship you raw responses: you pay for volume, then hand-clean noise out of rushed and gamed answers. When Vraelis human validation ships, it will filter automatically (time-on-task, IP velocity, reputation, screening) and you'll pay only for judgments that pass. A survey gives you responses; Vraelis will give you signal."],
              ["Who will judge? Are they vetted experts? (coming)", "When the human-validation layer ships: real people completing evaluation tasks, not verified experts or a vetted specialist panel. Screening questions will let you qualify who judges before they answer, and reputation gating will remove evaluators who consistently produce rejected responses. For preference and eval data, that's real human preference, not expert opinion."],
              ["What will happen to rejected responses? (coming)", "Rejected responses will be recorded for transparency but won't count toward your result, and you won't be charged for them. You'll see valid-vs-filtered counts and filter reasons in every report and in the API response."],
              ["Can this plug into my pipeline?", "Yes: POST your output to /api/v1/check and get structured scores, the recommended version, and line-level flags back in one call. Wire it into CI to catch bad output before it ships, or into your app. Checks return signed webhooks and JSON / CSV exports."],
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
              <h2 className="display">Start with free credits.</h2>
            </div>
            <Link href="/pricing" className="btn btn--ghost">See pricing →</Link>
          </div>
          <div className="card card--acc" style={{ textAlign: "center", padding: "clamp(24px, 4vw, 40px)" }}>
            <div className="display" style={{ fontSize: "clamp(1.4rem, 2.8vw, 2rem)", marginBottom: 8 }}>Your first checks are <span className="em">free</span>.</div>
            <p style={{ fontSize: 14, color: "var(--fg-3)", maxWidth: 560, margin: "0 auto 20px", lineHeight: 1.6 }}>New accounts start with free credits, so you can check your output before you pay a thing. Paste what your app generates and get scores, the version to ship, and the exact lines to fix. 1 credit per check after that.</p>
            <Link href="/app/checks/new" className="btn btn--lg">Check your AI output <span aria-hidden>→</span></Link>
          </div>
        </div>
      </section>

      {/* ── Capability proof ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">What&apos;s live today</p>
            <h2 className="display">The instant check is the <span className="em">product</span>.</h2>
            <p>From pasted output to a structured check by API or in the app, plus domain rubrics, line-level fixes, the corrected version, and a check API. Human validation on real people is coming.</p>
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
          <h2 className="display" style={{ fontSize: "clamp(2.1rem, 4.4vw, 3.4rem)", marginBottom: 18 }}>Check your AI output <span className="em">before you ship it</span>.</h2>
          <p className="lead-copy" style={{ margin: "0 auto 28px", textAlign: "center" }}>Paste what your app generates and get an instant check: the scores, the version to ship, and the exact lines to fix. A stable pass/fail gate, and free to try.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/app/checks/new" className="btn btn--lg">Check your AI output <span aria-hidden>→</span></Link>
            <Link href="/r/sample" className="btn btn--ghost btn--lg">See a real report</Link>
            <Link href="/developers" className="btn btn--ghost btn--lg">Developers</Link>
          </div>
        </div>
      </section>
    </>
  );
}
