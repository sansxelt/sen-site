import Link from "next/link";
import { ogMeta } from "@/lib/og-meta";

export const metadata = ogMeta({
  title: "How it works",
  description:
    "How Vraelis works: define the production requirements a system must keep, approve what runs, and Vraelis executes it against the exact build and environment, captures the evidence, and returns a truthful production decision.",
  path: "/how-it-works",
});

function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
const I = {
  connect: "M9 12a3 3 0 0 0 3 3h1a3 3 0 0 0 0-6M15 12a3 3 0 0 0-3-3h-1a3 3 0 0 0 0 6M7 7l-2 2a4 4 0 0 0 0 6M17 17l2-2a4 4 0 0 0 0-6",
  graph: "M5 5h5v5H5zM14 14h5v5h-5zM7.5 10v2a2 2 0 0 0 2 2h3M16.5 14v-2a2 2 0 0 0-2-2h-3",
  flag: "M4 21V4M4 4h13l-2 4 2 4H4",
  browser: "M3 5h18v14H3zM3 9h18M6.5 7h.01M9 7h.01",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4",
  wrench: "M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6a1.5 1.5 0 0 0 2.1 2.1l6-6a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.1-2.1z",
};

const STATUS = {
  ready: { label: "VERIFIED", fg: "var(--acc-deep)", bg: "var(--acc-soft)", line: "var(--acc-line)" },
  review: { label: "BLOCKED", fg: "#B45309", bg: "#FEF6E7", line: "#F3DFB0" },
  blocked: { label: "FAILED", fg: "#C0392B", bg: "#FBEBEA", line: "#F0C7C2" },
} as const;
type StatusKey = keyof typeof STATUS;
function StatusPill({ s }: { s: StatusKey }) {
  const c = STATUS[s];
  return <span className="pill" style={{ background: c.bg, color: c.fg, borderColor: c.line, fontFamily: "var(--font-code)", letterSpacing: "0.06em" }}>{c.label}</span>;
}

const STEPS: { k: string; t: string; d: string; i: string }[] = [
  { k: "01", t: "Connect your app", d: "Give Vraelis your deployed URL and the prompt you built the app from. Connect GitHub, Vercel, Supabase, or Stripe to give the plan setup and context; the evidence comes from what the real browser observes.", i: I.connect },
  { k: "02", t: "Map the production graph", d: "Vraelis reads the app and the prompt to learn what it promises, then links each promise to the layer that has to keep it: a route, a database write, an ownership rule, a charge.", i: I.graph },
  { k: "03", t: "Approve the Production Contract", d: "You get an editable contract of what the app must do. Nothing runs until you approve the critical flows, so Vraelis tests only what you signed off on.", i: I.flag },
  { k: "04", t: "Run it like production", d: "A real isolated browser runs your approved flows as two separate users. Every step is a deterministic observation of what was clicked, what rendered, and what the network and console did. No model guesses here.", i: I.browser },
  { k: "05", t: "Get the verification decision", d: "One decision: Verified, Failed, or Blocked. Each failure carries its requirement, the expected and observed behavior, exact reproduction steps, and a screenshot.", i: I.shield },
  { k: "06", t: "Repair with proof", d: "Every failure ships with a fix prompt for your builder. Push the fix and Vraelis reruns the exact failed check on a preview, then confirms the regression is closed.", i: I.wrench },
];

const ISSUE_TYPES: [string, string][] = [
  ["Fake success", "A success message with nothing written behind it."],
  ["Persistence failure", "Created data that vanishes on the next refresh."],
  ["Session failure", "State that does not survive a new sign in."],
  ["Cross-account access", "One user reaching another user's data."],
  ["Stale UI", "The screen showing state that no longer matches the data."],
  ["Duplicate action", "One action quietly creating two records."],
];

export default function HowItWorks() {
  return (
    <>
      {/* Hero */}
      <section style={{ position: "relative" }}>
        <div className="glow glow--soft glow--bleed" />
        <div className="grid-faint" style={{ opacity: 0.5 }} />
        <div className="wrap" style={{ position: "relative", zIndex: 1, paddingTop: "clamp(48px, 6vw, 88px)", paddingBottom: "clamp(20px, 3vw, 34px)", textAlign: "center" }}>
          <p className="eyebrow" style={{ justifyContent: "center" }}>How it works</p>
          <h1 className="display" style={{ fontSize: "clamp(2.2rem, 4.6vw, 3.5rem)", marginBottom: 16, maxWidth: 860, marginInline: "auto", lineHeight: 1.05, textWrap: "balance" }}>
            You approve what runs. <span className="em">Vraelis runs it like production.</span>
          </h1>
          <p className="lead-copy" style={{ margin: "0 auto", textAlign: "center", maxWidth: 700 }}>
            No test scripts to write and no dashboard to babysit. You define what must work and approve what runs; Vraelis executes it against the exact build, captures the evidence, and returns one truthful production decision, with the reasons behind it.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 26 }}>
            <Link href="/signin?callbackUrl=%2Fapp" className="btn btn--lg">Check your application <span aria-hidden>→</span></Link>
            <Link href="/pricing" className="btn btn--ghost btn--lg">View pricing</Link>
          </div>
        </div>
      </section>

      {/* The six steps */}
      <section className="section" style={{ paddingTop: "clamp(24px, 3vw, 40px)" }}>
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">The loop</p>
            <h2 className="display">Six steps from <span className="em">connected app</span> to <span className="em">launch decision</span>.</h2>
          </div>
          <div className="tile-grid cols-2">
            {STEPS.map((s) => (
              <div key={s.k} className="acard" style={{ flexDirection: "row", gap: 18, alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, flex: "none" }}>
                  <div className="acard__icon" style={{ width: 44, height: 44 }}><Icon d={s.i} /></div>
                  <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-5)" }}>{s.k}</span>
                </div>
                <div>
                  <h3 style={{ fontSize: "clamp(1.1rem, 1.7vw, 1.35rem)", marginBottom: 7 }}>{s.t}</h3>
                  <p style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: 1.6 }}>{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What "like production" means */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">What running it like production means</p>
            <h2 className="display">The checks a demo <span className="em">never runs on itself</span>.</h2>
            <p>A green screen is easy. Vraelis asks the harder questions: did the data actually get written, does it survive a refresh and a new session, and can a second user reach it. These are first-class issue types, not footnotes.</p>
          </div>
          <div className="tile-grid cols-3">
            {ISSUE_TYPES.map(([t, d]) => (
              <div key={t} className="acard" style={{ gap: 6 }}>
                <div className="acard__t">{t}</div>
                <div className="acard__d">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deterministic vs AI honesty */}
      <section className="section">
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "clamp(28px, 4vw, 56px)", alignItems: "center" }} className="cols-stack">
            <div>
              <p className="eyebrow">How Vraelis stays honest</p>
              <h2 className="display" style={{ fontSize: "clamp(1.85rem, 3.3vw, 2.7rem)", marginBottom: 16 }}>Evidence is <span className="em">deterministic</span>. Interpretation is <span className="em">labeled</span>.</h2>
              <p className="lead-copy" style={{ marginBottom: 16 }}>The pass or fail of every flow comes from what the browser actually did, never from a model&apos;s opinion. Screenshots, step timelines, and console and network activity are the record. When Vraelis suggests a likely cause, it is marked as interpretation and never counts as evidence.</p>
              <p style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: 1.6 }}>The launch decision follows one explainable rule, not a number you have to trust: any critical flow that fails means the claim comes back Failed, anything that needs a human call comes back Blocked, and only a clean run is Verified.</p>
            </div>
            <div className="card card--acc" style={{ padding: "clamp(20px, 3vw, 30px)" }}>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 14 }}>The rule, in full</div>
              <div style={{ display: "grid", gap: 12 }}>
                {([
                  { s: "blocked" as StatusKey, d: "Any critical flow failed." },
                  { s: "review" as StatusKey, d: "A non-critical flow failed, or something needs a human call." },
                  { s: "ready" as StatusKey, d: "Every critical flow held across the stack." },
                ]).map((r) => (
                  <div key={r.s} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <StatusPill s={r.s} />
                    <span style={{ fontSize: 14, color: "var(--fg-2)" }}>{r.d}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Verification output */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div className="sec-head sec-head--center">
            <p className="eyebrow">The output</p>
            <h2 className="display">A <span className="em">launch decision</span>, not a report to interpret.</h2>
            <p>Every run ends in one answer you can act on, each with the reason and the evidence behind it.</p>
          </div>
          <div className="tile-grid cols-3" style={{ maxWidth: 900, margin: "0 auto" }}>
            {([
              { s: "ready" as StatusKey, t: "Ship it", d: "Every critical flow held. Launch with the evidence attached." },
              { s: "review" as StatusKey, t: "Look before you ship", d: "A non-critical flow needs a human call. Vraelis shows exactly what and why." },
              { s: "blocked" as StatusKey, t: "Do not launch yet", d: "A critical promise failed in production conditions. Fix it and rerun to green." },
            ]).map((c) => (
              <div key={c.s} className="acard" style={{ gap: 10, borderColor: STATUS[c.s].line }}>
                <StatusPill s={c.s} />
                <div className="acard__t">{c.t}</div>
                <div className="acard__d">{c.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section cta-band" style={{ borderBottom: "none" }}>
        <div className="glow glow--soft" />
        <div className="wrap" style={{ maxWidth: 680, textAlign: "center" }}>
          <h2 className="display" style={{ fontSize: "clamp(1.9rem, 3.6vw, 2.8rem)", marginBottom: 16 }}>See it run on <span className="em">your app</span>.</h2>
          <p className="lead-copy" style={{ margin: "0 auto 26px", textAlign: "center" }}>Connect your AI-built app and get a launch decision before your users find the failures.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signin?callbackUrl=%2Fapp" className="btn btn--lg">Check your application <span aria-hidden>→</span></Link>
            <Link href="/pricing" className="btn btn--ghost btn--lg">View pricing</Link>
            <Link href="/developers" className="btn btn--ghost btn--lg">Developers</Link>
          </div>
        </div>
      </section>
    </>
  );
}
