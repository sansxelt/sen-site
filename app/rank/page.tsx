import Link from "next/link";
import { ogMeta } from "@/lib/og-meta";
import { VerificationTimeline } from "./_components/verification-timeline";
import { TwoUserDemo } from "./_components/two-user-demo";

export const metadata = {
  ...ogMeta({
    title: "AI says it is done. Vraelis proves it.",
    description:
      "Give Vraelis a deployed application and the outcome that should be true. It independently derives what must be checked, verifies the live result, and returns the evidence behind its decision. Starting with deployed web applications.",
    path: "/",
    // Text-only card: LinkedIn froze on a stale OG image across several ?v bumps, so the homepage
    // advertises no image and shows the current title + description instead.
    noImage: true,
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
  contract: "M8 4h8l2 2v14H6V4zM9 9h6M9 13h6M9 17h4",
  build: "M4 7l8-4 8 4-8 4-8-4zM4 7v10l8 4 8-4V7M12 11v10",
  execute: "M5 4l14 8-14 8V4z",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4",
  history: "M3 12a9 9 0 1 0 3-6.7M3 5v5h5M12 8v4l3 2",
  lock: "M6 10V7a6 6 0 0 1 12 0v3M5 10h14v11H5zM12 15v2",
  key: "M14 7a4 4 0 1 1-3.9 5H7v3H4v-3a1 1 0 0 1 1-1h5.1A4 4 0 0 1 14 7zM17 9h.01",
  database: "M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  api: "M9 12a3 3 0 0 0 3 3h1a3 3 0 0 0 0-6M15 12a3 3 0 0 0-3-3h-1a3 3 0 0 0 0 6M7 7l-2 2a4 4 0 0 0 0 6M17 17l2-2a4 4 0 0 0 0-6",
  flow: "M5 6h6M5 12h14M5 18h9M17 4l2 2-2 2M13 16l2 2-2 2",
  transitions: "M4 12h10m0 0l-3-3m3 3l-3 3M20 6v12",
  recover: "M4 4v6h6M4 10a8 8 0 1 1 2 8",
  device: "M7 4h10v16H7zM10 4V2h4v2M9 20h6",
};

// The production-decision outcomes. READY is the normal outcome; these are results the system returns,
// not the definition of the product.
const STATUS = {
  ready:   { label: "READY",          fg: "var(--acc-deep)", bg: "var(--acc-soft)", line: "var(--acc-line)" },
  review:  { label: "NEEDS REVIEW",   fg: "#B45309",         bg: "#FEF6E7",         line: "#F3DFB0" },
  blocked: { label: "BLOCKED",        fg: "#C0392B",         bg: "#FBEBEA",         line: "#F0C7C2" },
  repair:  { label: "REPAIR VERIFIED",fg: "var(--acc-deep)", bg: "var(--acc-soft)", line: "var(--acc-line)" },
} as const;
type StatusKey = keyof typeof STATUS;

function StatusPill({ s }: { s: StatusKey }) {
  const c = STATUS[s];
  return <span className="pill" style={{ background: c.bg, color: c.fg, borderColor: c.line, fontFamily: "var(--font-code)", letterSpacing: "0.06em" }}>{c.label}</span>;
}

// ── What Vraelis validates: behavior categories, not a runtime list ──
// Every row carries its real maturity. `tag` is the honest label: absent means it runs today in the browser
// flow you approve; BETA means it works but has not been exercised by an outside customer; ROADMAP means it
// is not built. A row is never left untagged just because code exists for it.
const VALIDATES: { t: string; d: string; i: string; tag?: "BETA" | "ROADMAP" }[] = [
  { t: "Authentication & identity", d: "Sign-in and sessions hold across a refresh and a new session, in the flows you approve.", i: ICONS.lock },
  { t: "Authorization & permissions", d: "In flows that use two roles, the one that should be refused is refused. Scoped to the paths you approve, not a full permission audit.", i: ICONS.key },
  { t: "Data creation & persistence", d: "What the product says it saved is still visible after a refresh, a new session, and a later request.", i: ICONS.database },
  { t: "APIs & integrations", d: "Endpoints, chained requests, statuses, values and schemas checked against your contract. Works today; no outside customer has run it end to end yet.", i: ICONS.api, tag: "BETA" },
  { t: "Critical user & system workflows", d: "The journeys that matter run end to end in a real browser against your deployment.", i: ICONS.flow },
  { t: "Build & configuration behavior", d: "A run is pinned to the exact deployment and environment it ran against, so a result is never carried forward to a build that was not checked.", i: ICONS.build },
  { t: "Cross-service state transitions", d: "Roadmap: following state as it moves between services, rather than checking it on one screen.", i: ICONS.transitions, tag: "ROADMAP" },
  { t: "Recovery & failure handling", d: "Roadmap: driving a system into failure and checking how it degrades and recovers.", i: ICONS.recover, tag: "ROADMAP" },
  { t: "SDK & connected-device telemetry", d: "Roadmap: signed execution checkpoints and telemetry from instrumented apps, edge systems, and devices.", i: ICONS.device, tag: "ROADMAP" },
];

// ── The core loop: how it works ──
const STEPS: { k: string; t: string; d: string; i: string }[] = [
  { k: "01", t: "Define what must work", d: "Capture the production requirements the system has to keep: the promises that matter before it ships.", i: ICONS.contract },
  { k: "02", t: "Bind the exact build & environment", d: "Every check is tied to a specific build, deployment, environment, role, and configuration: the exact thing under verification.", i: ICONS.build },
  { k: "03", t: "Execute approved verification flows", d: "Vraelis runs the approved flows against the real system in controlled execution, capturing what actually happens.", i: ICONS.execute },
  { k: "04", t: "Capture observed evidence", d: "Factual evidence at every step: what was expected, what was observed, and the record that proves it.", i: ICONS.eye },
  { k: "05", t: "Receive a production decision", d: "One decision you can act on (READY, BLOCKED, NEEDS REVIEW, or REPAIR VERIFIED), scoped to the flows that ran, with the evidence behind it.", i: ICONS.shield },
  { k: "06", t: "Preserve history across releases", d: "Every result is remembered, so you can see how behavior held, or changed, across future builds and deployments.", i: ICONS.history },
];

// ── Evidence is bound to exactness ──
const EVIDENCE_BINDS = ["Exact build or deployment", "Runtime target", "Environment", "User role", "Contract version", "Configuration", "Execution steps", "Expected vs observed"];
const EVIDENCE_KINDS = ["Browser screenshots", "HTTP transactions", "Logs", "Assertions", "Execution timing", "Issue lineage", "SDK / device checkpoints (roadmap)"];

// ── What Vraelis is not ──
const IS_NOT = [
  "A website scanner",
  "A generic AI audit",
  "A prompt wrapper",
  "A screenshot generator",
  "A test-script recorder",
  "An autonomous coding agent",
];

export default function VraelisLanding() {
  return (
    <>
      {/* ── Hero ── asymmetric: the claim on the left, the proof-object (a real production
          decision, live) on the right so the demo lands with the copy, above the fold. Stacks on
          mobile. */}
      <section style={{ position: "relative" }}>
        <div className="glow glow--bleed" />
        <div className="grid-faint" style={{ opacity: 0.55 }} />
        <div className="wrap hero-grid" style={{ position: "relative", zIndex: 1, paddingTop: "clamp(32px, 4vw, 56px)", paddingBottom: "clamp(32px, 4vw, 52px)" }}>
          <div className="hero-copy">
            <p className="eyebrow rise" data-d="1">The independent verification layer for work performed by AI</p>
            <h1 className="display rise" data-d="2" style={{ fontSize: "clamp(2.3rem, 4.4vw, 3.7rem)", margin: "0 0 20px", lineHeight: 1.05, textWrap: "balance" }}>
              AI says it&rsquo;s done. <span className="em">Vraelis proves it</span>.
            </h1>
            <p className="rise" data-d="3" style={{ fontSize: "clamp(1.05rem, 1.3vw, 1.22rem)", color: "var(--fg-2)", maxWidth: 560, margin: "0 0 26px", lineHeight: 1.55 }}>
              Give Vraelis a deployed application and the outcome that should be true. It independently derives what must be checked, verifies the live result, and returns the evidence behind its decision.
            </p>
            <div className="rise" data-d="4" style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <Link href="/signin?callbackUrl=%2Fapp" className="btn btn--lg">Verify an outcome <span aria-hidden>→</span></Link>
              <Link href="/developers" style={{ fontSize: 15, fontWeight: 600, color: "var(--fg-2)", textDecoration: "none", textUnderlineOffset: 4, borderBottom: "1px solid var(--line-3)", paddingBottom: 2 }}>View the API</Link>
            </div>
            {/* The honesty line. A page that promises to verify "outcomes" invites the reader to assume any
                system, and only deployed web applications work today. Said in the hero rather than a footnote,
                because the assumption forms in the hero. */}
            <p className="rise" data-d="4" style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "var(--fg-4)", margin: "16px 0 0", maxWidth: 500, lineHeight: 1.55 }}>
              Starting with deployed web applications.
            </p>
          </div>

          {/* The main visual is the LOOP, not a dashboard. A screenshot shows what the software looks like;
              this shows what it does, which is the part nobody has a mental model for yet. */}
          <div className="hero-demo rise" data-d="5" style={{ position: "relative", minWidth: 0 }}>
            <VerificationTimeline />
          </div>
        </div>
      </section>

      {/* ── What Vraelis validates ── */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">What Vraelis validates</p>
            <h2 className="display">The behavior that has to hold in production.</h2>
            <p>Vraelis works from explicit requirements, not generic AI opinions. It verifies how a system actually behaves, across identity, access, data, integrations, and the workflows that matter, and ties every result to the exact build it ran against.</p>
          </div>
          <div className="tile-grid cols-3">
            {VALIDATES.map((f) => (
              <div key={f.t} className="acard" style={{ gap: 8, opacity: f.tag === "ROADMAP" ? 0.72 : 1 }}>
                <div className="acard__icon"><Icon d={f.i} /></div>
                <div className="acard__t">{f.t}{f.tag && <span className="pill" style={{ marginLeft: 8, fontSize: 10, background: "var(--bg-2)", color: "var(--fg-4)", borderColor: "var(--line-2)", fontFamily: "var(--font-code)" }}>{f.tag}</span>}</div>
                <div className="acard__d">{f.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works: the core loop ── */}
      <section id="how" className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">How it works</p>
            <h2 className="display">A repeatable process, not a one-time check.</h2>
            <p>You define what must work and approve what runs. Vraelis executes it against the exact build, captures what actually happened, and returns one decision, then remembers it across every release that follows. The same flows run on every build, so results stay comparable release to release.</p>
          </div>
          <div className="tile-grid cols-2">
            {STEPS.map((s) => (
              <div key={s.k} className="acard" style={{ flexDirection: "row", gap: 18, alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, flex: "none" }}>
                  <div className="acard__icon" style={{ width: 42, height: 42 }}><Icon d={s.i} size={20} /></div>
                  <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-5)" }}>{s.k}</span>
                </div>
                <div>
                  <h3 style={{ fontSize: "clamp(1.1rem, 1.7vw, 1.35rem)", marginBottom: 7 }}>{s.t}</h3>
                  <p style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: 1.55 }}>{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Execution & evidence ── */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">Execution & evidence</p>
            <h2 className="display">Proof tied to the exact thing you shipped.</h2>
            <p>A green screen is not proof. Vraelis produces factual evidence bound to the precise build, environment, role, and configuration it ran against, so a decision means something you can defend, not an opinion dressed up as one.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "clamp(18px, 3vw, 36px)" }} className="cols-2">
            <div className="card" style={{ background: "var(--bg-2)" }}>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 12 }}>Every result is bound to</div>
              <div className="chips">{EVIDENCE_BINDS.map((x) => <span key={x} className="chip">{x}</span>)}</div>
            </div>
            <div className="card" style={{ background: "var(--bg-2)" }}>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Evidence may include</div>
              <div className="chips">{EVIDENCE_KINDS.map((x) => <span key={x} className="chip">{x}</span>)}</div>
            </div>
          </div>

          {/* One concrete example of a behavioral check, demoted from "the whole product" to an illustration. */}
          <div style={{ marginTop: "clamp(32px, 4vw, 56px)", display: "grid", gridTemplateColumns: "minmax(0,0.92fr) minmax(0,1.08fr)", gap: "clamp(28px, 4vw, 60px)", alignItems: "center" }} className="cols-stack">
            <div>
              <p className="eyebrow">One example</p>
              <h3 className="display" style={{ fontSize: "clamp(1.5rem, 2.6vw, 2.1rem)", marginBottom: 14 }}>Does the data persist, and stay private?</h3>
              <p className="lead-copy" style={{ marginBottom: 16 }}>Whether apparent success survives a refresh and a new session, and whether one user can reach another&apos;s data, is one thing Vraelis checks with real execution, not a claim taken on faith. It is one behavior among many, captured as factual evidence.</p>
            </div>
            <TwoUserDemo />
          </div>
        </div>
      </section>

      {/* ── Decisions: outcomes, not the product ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div className="sec-head sec-head--center">
            <p className="eyebrow">The decision</p>
            <h2 className="display">One truthful outcome, tied to evidence.</h2>
            <p>A run returns a decision you can act on. READY is the normal result when the system does what it must. Failure detection is one capability, not the definition.</p>
          </div>
          <div className="tile-grid cols-2" style={{ maxWidth: 900, margin: "0 auto" }}>
            {([
              { s: "ready" as StatusKey, d: "The complete approved production contract passed." },
              { s: "blocked" as StatusKey, d: "Critical required behavior genuinely failed." },
              { s: "review" as StatusKey, d: "The result could not be determined reliably." },
              { s: "repair" as StatusKey, d: "A known issue passed against a later build, without claiming full coverage." },
            ]).map((c) => (
              <div key={c.s} className="acard" style={{ gap: 10, borderColor: STATUS[c.s].line, flexDirection: "row", alignItems: "flex-start" }}>
                <StatusPill s={c.s} />
                <div className="acard__d" style={{ marginTop: 2 }}>{c.d}</div>
              </div>
            ))}
          </div>
          <p style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "var(--fg-4)", textAlign: "center", marginTop: 18, maxWidth: 640, marginLeft: "auto", marginRight: "auto", lineHeight: 1.55 }}>
            REPAIR VERIFIED appears only when a known issue is rerun against a later build and that specific issue now passes. No one has to manufacture a failure to use Vraelis.
          </p>
        </div>
      </section>

      {/* ── Across releases: a system of record ── */}
      <section className="section">
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "clamp(28px, 4vw, 56px)", alignItems: "center" }} className="cols-stack">
            <div>
              <p className="eyebrow">Across releases</p>
              <h2 className="display" style={{ fontSize: "clamp(1.85rem, 3.3vw, 2.7rem)", marginBottom: 16 }}>A persistent system of record, not a one-time report.</h2>
              <p className="lead-copy" style={{ marginBottom: 20 }}>Production behavior is not a single moment. Vraelis remembers what was required, which exact version was tested, what failed, when an issue first appeared, whether it recurred, whether a later build fixed it, and which runtimes remain unverified.</p>
              <div className="card card--acc" style={{ padding: 14 }}>
                <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 6 }}>Continuity across builds</div>
                <p style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.55, margin: 0 }}>An issue keeps its lineage across releases, so a repaired build proves the exact issue closed, and a regression is caught the moment it returns.</p>
              </div>
            </div>
            <div className="win" style={{ boxShadow: "var(--shadow-lg)" }}>
              <div className="win__bar"><span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, color: "var(--fg-2)" }}>Release history</span><span className="pill" style={{ marginLeft: "auto", background: "var(--acc-soft)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>Tracked</span></div>
              <div style={{ padding: "clamp(18px,2.4vw,26px)", display: "grid", gap: 12 }}>
                {[
                  ["Required", "The production contract this build was verified against."],
                  ["Exact version", "The specific build, deployment, and environment under test."],
                  ["Outcome", "The decision that build received, with its evidence."],
                  ["Issue lineage", "When an issue appeared, whether it recurred, when it closed."],
                  ["Unverified", "Which runtimes and requirements have not yet been proven."],
                ].map(([t, d], i, arr) => (
                  <div key={t} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ flex: "none", width: 26, height: 26, borderRadius: 8, background: i === arr.length - 1 ? "var(--bg-2)" : "var(--acc-soft)", border: `1px solid ${i === arr.length - 1 ? "var(--line-2)" : "var(--acc-line)"}`, color: i === arr.length - 1 ? "var(--fg-4)" : "var(--acc-deep)", display: "grid", placeItems: "center", fontFamily: "var(--font-code)", fontSize: 12, fontWeight: 600 }}>{i + 1}</span>
                    <div><div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, color: "var(--fg-1)" }}>{t}</div><div style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.5 }}>{d}</div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Runtime coverage: compact status tiles ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">Runtime coverage</p>
            <h2 className="display">What Vraelis checks today.</h2>
            <p style={{ fontSize: "clamp(1.05rem, 1.5vw, 1.2rem)", color: "var(--fg-2)", marginBottom: 10 }}>Web and APIs today, on an architecture built to reach further.</p>
            <p>Vraelis validates web applications and APIs today. Its shared verification architecture is designed to extend across mobile, desktop, SDK-instrumented systems, simulators, robotics, and connected devices.</p>
          </div>
          <div className="tile-grid cols-3" style={{ maxWidth: 960, margin: "0 auto" }}>
            {[
              { mark: "✓", markColor: "var(--acc)", tag: "WEB", tagColor: "var(--acc-deep)", status: "Available now" },
              { mark: "✓", markColor: "var(--acc)", tag: "APIs", tagColor: "var(--acc-deep)", status: "Available now" },
              { mark: "→", markColor: "var(--fg-4)", tag: "MORE RUNTIMES", tagColor: "var(--fg-4)", status: "Mobile, desktop, SDKs, simulators and connected systems" },
            ].map((r) => (
              <div key={r.tag} className="card" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span aria-hidden style={{ fontSize: 17, color: r.markColor, fontFamily: "var(--font-code)", lineHeight: 1 }}>{r.mark}</span>
                  <span style={{ fontFamily: "var(--font-code)", fontSize: 12, letterSpacing: "0.08em", fontWeight: 600, color: r.tagColor }}>{r.tag}</span>
                </div>
                <div style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.45 }}>{r.status}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Physical AI / connected systems ── */}
      <section className="section">
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "clamp(28px, 4vw, 56px)", alignItems: "center" }} className="cols-stack">
            <div>
              <p className="eyebrow">Where the same approach extends</p>
              <h2 className="display" style={{ fontSize: "clamp(1.85rem, 3.3vw, 2.7rem)", marginBottom: 16 }}>Some systems a browser can&apos;t reach.</h2>
              <p className="lead-copy" style={{ marginBottom: 18 }}>A physical or connected system is more than a model: cloud services, APIs, SDKs, firmware, configuration, devices, telemetry, and real-world outcomes. The same method, bind defined requirements to an exact build and prove behavior with execution evidence, extends to those components, where a browser or a single request cannot reach. This is the direction the architecture is built for, not a capability offered today.</p>
              <p style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.55 }}>Vraelis verifies defined behavior and production requirements with evidence. It does not certify safety or guarantee a system is harmless.</p>
            </div>
            <div className="card" style={{ background: "var(--bg-2)" }}>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>The future system identity binds</div>
              <div className="chips">
                {["Product", "Runtime target", "Software build", "Model version", "Firmware version", "SDK version", "Configuration", "Device or simulator", "Environment", "Verification scenario"].map((x) => <span key={x} className="chip">{x}</span>)}
              </div>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", margin: "16px 0 12px" }}>Evidence may eventually include</div>
              <div className="chips">
                {["Telemetry", "Sensor state", "Command receipt", "Model output", "State transitions", "Actuator outcome", "Latency", "Safety-stop behavior", "Recovery behavior", "Simulator video", "Signed checkpoints"].map((x) => <span key={x} className="chip">{x}</span>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Differentiation ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">What Vraelis is</p>
            <h2 className="display">A system for proving production behavior.</h2>
            <p>Vraelis connects requirements, builds, execution, evidence, issues, and history into one decision. It is not a lighter-weight version of any of these:</p>
          </div>
          <div className="chips" style={{ justifyContent: "center" }}>
            {IS_NOT.map((x) => (
              <span key={x} className="chip" style={{ color: "var(--fg-3)", display: "inline-flex", alignItems: "center", gap: 7 }}>
                <span aria-hidden style={{ color: "var(--fg-4)", fontSize: 11, lineHeight: 1 }}>✕</span>{x}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="section cta-band" style={{ borderBottom: "none" }}>
        <div className="glow glow--soft" />
        <div className="wrap" style={{ maxWidth: 720, textAlign: "center" }}>
          <h2 className="display" style={{ fontSize: "clamp(2.1rem, 4.4vw, 3.4rem)", marginBottom: 18 }}>Find out how it behaves <span className="em">before your users do</span>.</h2>
          <p className="lead-copy" style={{ margin: "0 auto 28px", textAlign: "center" }}>Define the behavior that has to hold, run it against the exact build, and get a decision backed by evidence. Web checking is live; API checking is in beta.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signin?callbackUrl=%2Fapp" className="btn btn--lg">Validate a web application <span aria-hidden>→</span></Link>
            <Link href="/how-it-works" className="btn btn--ghost btn--lg">See how it works</Link>
          </div>
        </div>
      </section>
    </>
  );
}
