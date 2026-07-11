import Link from "next/link";
import { ogMeta } from "@/lib/og-meta";

export const metadata = {
  ...ogMeta({
    title: "Productionization for AI-built SaaS",
    description:
      "AI built the product. Vraelis finishes the engineering. Connect your AI-built app and Vraelis runs it like production, in a real browser, as two real users, against the database, auth, and billing underneath, then returns a launch decision with the exact blockers to fix.",
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
  connect: "M9 12a3 3 0 0 0 3 3h1a3 3 0 0 0 0-6M15 12a3 3 0 0 0-3-3h-1a3 3 0 0 0 0 6M7 7l-2 2a4 4 0 0 0 0 6M17 17l2-2a4 4 0 0 0 0-6",
  graph: "M5 5h5v5H5zM14 14h5v5h-5zM7.5 10v2a2 2 0 0 0 2 2h3M16.5 14v-2a2 2 0 0 0-2-2h-3",
  browser: "M3 5h18v14H3zM3 9h18M6.5 7h.01M9 7h.01",
  users: "M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 20v-2a4 4 0 0 0-3-3.87M16 2.13A4 4 0 0 1 16 10",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4",
  database: "M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  card: "M3 6h18v12H3zM3 10h18M7 15h4",
  flag: "M4 21V4M4 4h13l-2 4 2 4H4",
  wrench: "M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6a1.5 1.5 0 0 0 2.1 2.1l6-6a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.1-2.1z",
  deploy: "M12 15V3m0 0l-4 4m4-4l4 4M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  refresh: "M21 12a9 9 0 1 1-3-6.7M21 4v5h-5",
  lock: "M6 10V7a6 6 0 0 1 12 0v3M5 10h14v11H5zM12 15v2",
  bolt: "M13 2 4 14h7l-2 8 9-12h-7l2-8z",
};

// The three launch-decision states. Self-contained colors that read on the cream background.
const STATUS = {
  ready:   { label: "READY",        fg: "var(--acc-deep)", bg: "var(--acc-soft)", line: "var(--acc-line)" },
  review:  { label: "NEEDS REVIEW", fg: "#B45309",         bg: "#FEF6E7",         line: "#F3DFB0" },
  blocked: { label: "BLOCKED",      fg: "#C0392B",         bg: "#FBEBEA",         line: "#F0C7C2" },
} as const;
type StatusKey = keyof typeof STATUS;

function StatusPill({ s }: { s: StatusKey }) {
  const c = STATUS[s];
  return <span className="pill" style={{ background: c.bg, color: c.fg, borderColor: c.line, fontFamily: "var(--font-code)", letterSpacing: "0.06em" }}>{c.label}</span>;
}

// ── The failure system: what AI-built SaaS ships broken ──
const FAILURES: { t: string; d: string; i: string }[] = [
  { t: "Fake completion", d: "The screen says saved. Nothing was written. A refresh proves the record was never real.", i: ICONS.refresh },
  { t: "Broken ownership", d: "One user can open, read, or change another user's data by guessing an id.", i: ICONS.lock },
  { t: "Demo-only infrastructure", d: "State lives in memory or localStorage and disappears on the next deploy.", i: ICONS.database },
  { t: "Billing mismatch", d: "Checkout shows success while no subscription, entitlement, or charge exists.", i: ICONS.card },
  { t: "Fragile deployment", d: "It works on the machine that built it and breaks on a clean production build.", i: ICONS.deploy },
  { t: "Operational blindness", d: "When it fails for a real user, nothing tells you it failed.", i: ICONS.eye },
];

// ── Connect to launch decision ──
const STEPS: { k: string; t: string; d: string; i: string }[] = [
  { k: "01", t: "Connect your app", d: "Point Vraelis at your deployed app and paste the prompt you built it from. Optionally connect GitHub, Vercel, Supabase, and Stripe.", i: ICONS.connect },
  { k: "02", t: "Map the production graph", d: "Vraelis discovers what the product promises and links each promise across the stack: routes, database, auth, and billing.", i: ICONS.graph },
  { k: "03", t: "Approve the contract", d: "You review an editable Production Contract, what the app must do, and approve the critical flows before anything runs.", i: ICONS.flag },
  { k: "04", t: "Run it like production", d: "A real isolated browser runs the approved flows as two separate users, capturing deterministic evidence: screenshots, console, network.", i: ICONS.browser },
  { k: "05", t: "Get the Production Pass", d: "One launch decision, READY, NEEDS REVIEW, or BLOCKED, with every blocker, its evidence, and exact reproduction steps.", i: ICONS.shield },
  { k: "06", t: "Repair with proof", d: "Each blocker ships with a fix prompt for your builder. Fix it, rerun the exact failed check, and watch the regression close.", i: ICONS.wrench },
];

const LAYERS = ["Build prompt", "Routes", "Database", "Row security", "Auth & sessions", "Stripe & entitlements", "Env & secrets", "Browser flows", "Deploys", "Incidents"];

const ISSUE_TYPES = ["Fake success", "Persistence failure", "Session failure", "Cross-account access", "Stale UI", "Duplicate action"];

const IS_THINGS = [
  "A production readiness system for AI-built apps: it verifies the whole stack and returns one launch decision.",
  "Real evidence: deterministic browser observations, screenshots, and repro steps, never an AI opinion dressed up as proof.",
  "Repair with proof: a fix prompt, an exact rerun on a preview, and a closed regression you can see.",
];
const IS_NOT_THINGS = [
  "A testing dashboard or a bug list you still have to triage and trust.",
  "A guarantee: it is a readiness assessment, not a promise of outcomes.",
  "A code writer: in V1 it proposes fixes and proves them, it does not modify or deploy your code on its own.",
];

// ── Signature device: the two-user proof timeline ──
function TwoUserProof() {
  const rows: { who: "A" | "B"; act: string; expect: string; ok: boolean }[] = [
    { who: "A", act: "Creates a project, sees “Saved”", expect: "Written to the database", ok: true },
    { who: "A", act: "Refreshes the page", expect: "Project is still there", ok: true },
    { who: "A", act: "Signs out, signs back in", expect: "Project survives a new session", ok: true },
    { who: "B", act: "Opens User A's project by id", expect: "Access is denied", ok: false },
  ];
  return (
    <div className="win" style={{ boxShadow: "var(--shadow-lg)" }}>
      <div className="win__bar">
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, color: "var(--fg-2)" }}>Two-user state check</span>
        <span style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.05em", color: "var(--fg-5)", marginLeft: 9 }}>illustrative</span>
        <span className="pill" style={{ marginLeft: "auto", background: "var(--acc-soft)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>Isolation held</span>
      </div>
      <div style={{ padding: "clamp(16px,2.4vw,24px)", display: "grid", gap: 10 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", borderRadius: 11, background: "var(--bg-2)", border: "1px solid var(--line-1)" }}>
            <span aria-hidden style={{ flex: "none", width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 12, color: "#fff", background: r.who === "A" ? "linear-gradient(135deg, var(--acc), var(--acc-deep))" : "linear-gradient(135deg, #7c8698, #5a6478)" }}>{r.who}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 500 }}>{r.act}</div>
              <div style={{ fontSize: 12, color: "var(--fg-4)" }}>{r.expect}</div>
            </div>
            <span aria-hidden style={{ flex: "none", width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, color: r.ok ? "var(--acc-deep)" : "#C0392B", background: r.ok ? "var(--acc-soft)" : "#FBEBEA", border: `1px solid ${r.ok ? "var(--acc-line)" : "#F0C7C2"}` }}>{r.ok ? "✓" : "✕"}</span>
          </div>
        ))}
        <div style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)", marginTop: 2 }}>Persistence held. Session survived. User B was denied. All three proven in a real browser.</div>
      </div>
    </div>
  );
}

export default function VraelisLanding() {
  return (
    <>
      {/* ── Hero ── */}
      <section style={{ position: "relative" }}>
        <div className="glow glow--bleed" />
        <div className="grid-faint" style={{ opacity: 0.55 }} />
        <div className="wrap" style={{ position: "relative", zIndex: 1, paddingTop: "clamp(48px, 7vw, 96px)", paddingBottom: "clamp(40px, 5vw, 68px)", textAlign: "center" }}>
          <p className="eyebrow rise" data-d="1" style={{ justifyContent: "center" }}>Productionization for AI-built SaaS</p>
          <h1 className="display rise" data-d="2" style={{ fontSize: "clamp(2.4rem, 5.4vw, 4.2rem)", margin: "0 auto 22px", maxWidth: 900, lineHeight: 1.04, textWrap: "balance" }}>
            <span style={{ color: "var(--fg-3)" }}>AI built the product.</span><br />
            Vraelis <span className="em">finishes the engineering</span>.
          </h1>
          <p className="rise" data-d="3" style={{ fontSize: "clamp(1.08rem, 1.45vw, 1.3rem)", color: "var(--fg-2)", maxWidth: 720, margin: "0 auto 26px", lineHeight: 1.55 }}>
            Your AI shipped something that looks done. Vraelis runs it like production, in a real browser, as two real users, against the database, auth, and billing underneath, then hands you a launch decision and the exact blockers to fix.
          </p>
          <div className="rise" data-d="4" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signin?callbackUrl=%2Fapp" className="btn btn--lg">Get early access <span aria-hidden>→</span></Link>
            <Link href="/how-it-works" className="btn btn--ghost btn--lg">See how it works</Link>
          </div>
          <p className="rise" data-d="4" style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "var(--fg-4)", margin: "14px 0 0" }}>Test-only. No real charges, nothing deleted. You approve every flow before it runs.</p>

          {/* Signature artifact: the Production Pass, a launch decision, not a dashboard */}
          <div className="rise" data-d="5" style={{ position: "relative", maxWidth: 880, margin: "clamp(24px, 3vw, 40px) auto 0" }}>
            <div className="win" style={{ textAlign: "left", boxShadow: "var(--shadow-lg)" }}>
              <div className="win__bar">
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, color: "var(--fg-2)" }}>Production Pass</span>
                <span style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.05em", color: "var(--fg-5)", marginLeft: 9 }}>illustrative example</span>
                <span style={{ marginLeft: "auto" }}><StatusPill s="blocked" /></span>
              </div>
              <div style={{ padding: "clamp(18px,2.6vw,28px)" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "clamp(1.2rem,2.4vw,1.6rem)", color: "var(--fg-1)" }}>Not ready to launch</div>
                  <div style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "var(--fg-4)" }}>5 critical flows checked, 2 blocked</div>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {[
                    { s: "blocked" as StatusKey, layer: "Data", t: "Created project disappears after refresh", d: "Saved to memory, never written to the database." },
                    { s: "blocked" as StatusKey, layer: "Auth / row security", t: "User B can open User A's invoice by id", d: "No ownership check on the record route." },
                    { s: "review" as StatusKey, layer: "Billing", t: "Upgrade shows success with no subscription", d: "Stripe test mode created no subscription for the checkout." },
                  ].map((f, i) => (
                    <div key={i} style={{ display: "flex", gap: 13, alignItems: "flex-start", padding: "13px 14px", borderRadius: 11, background: "var(--bg-2)", border: `1px solid ${STATUS[f.s].line}` }}>
                      <span style={{ marginTop: 1 }}><StatusPill s={f.s} /></span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--fg-1)" }}>{f.t}</div>
                        <div style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5, marginTop: 2 }}>{f.d}</div>
                        <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--fg-5)", marginTop: 6 }}>{f.layer}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)", marginTop: 14 }}>Every finding carries deterministic browser evidence, a screenshot, and reproduction steps.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── The gap: the failure system ── */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">Why AI-built SaaS breaks</p>
            <h2 className="display">It looks done. <span className="em">Production disagrees.</span></h2>
            <p>AI is fluent at the happy path and the demo. The engineering that makes software survive real users, its state, its boundaries, its money, is exactly what gets skipped. These are the failures Vraelis is built to catch, and none of them show up in a screenshot.</p>
          </div>
          <div className="tile-grid cols-3">
            {FAILURES.map((f) => (
              <div key={f.t} className="acard" style={{ gap: 8 }}>
                <div className="acard__icon"><Icon d={f.i} /></div>
                <div className="acard__t">{f.t}</div>
                <div className="acard__d">{f.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Two-user proof: the signature differentiator ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,0.92fr) minmax(0,1.08fr)", gap: "clamp(28px, 4vw, 60px)", alignItems: "center" }} className="cols-stack">
            <div>
              <p className="eyebrow">The test AI never runs on itself</p>
              <h2 className="display" style={{ fontSize: "clamp(1.85rem, 3.3vw, 2.7rem)", marginBottom: 16 }}>Does it <span className="em">keep the data</span>? Does it <span className="em">keep it private</span>?</h2>
              <p className="lead-copy" style={{ marginBottom: 20 }}>The most common lie in an AI-built app is a success message with nothing behind it, and the most dangerous is one user reaching another user&apos;s data. Vraelis proves both the only way that counts: two real users, in real sessions, in a real browser.</p>
              <div className="chips">
                {ISSUE_TYPES.map((t) => <span key={t} className="chip">{t}</span>)}
              </div>
              <p style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 16, lineHeight: 1.55 }}>State integrity is a first-class check, not a side effect. Vraelis asks whether apparent success survives a refresh, a new session, and a second user.</p>
            </div>
            <TwoUserProof />
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="section">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">How it works</p>
            <h2 className="display">From <span className="em">connected app</span> to <span className="em">launch decision</span>.</h2>
            <p>You approve what runs, Vraelis runs it like production, and you get one answer you can act on. No test scripts to write, no dashboard to interpret.</p>
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

      {/* ── The production graph: the whole stack ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">The production graph</p>
            <h2 className="display">We check the <span className="em">whole stack</span>, not just the screen.</h2>
            <p>A test that only clicks buttons misses the database write that never happened and the row another tenant can read. Vraelis links every promise the product makes to the layer that has to keep it, so a green screen with a broken backend does not pass.</p>
          </div>
          <div className="chips" style={{ justifyContent: "center", marginBottom: 22 }}>
            {LAYERS.map((l) => <span key={l} className="chip">{l}</span>)}
          </div>
          <div className="tile-grid cols-3">
            {[
              ["Promise", "What the product claims", "Vraelis reads the build prompt and the app to learn what each flow is supposed to do."],
              ["Layer", "Where it has to hold", "Each promise is traced to the route, database write, ownership rule, or charge that backs it."],
              ["Proof", "Whether it actually held", "A real browser run confirms the promise end to end, with evidence at every layer it touched."],
            ].map(([k, t, d]) => (
              <div key={k} className="acard" style={{ gap: 6 }}>
                <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--acc-deep)" }}>{k}</div>
                <div className="acard__t">{t}</div>
                <div className="acard__d">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Repair with proof ── */}
      <section className="section">
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "clamp(28px, 4vw, 56px)", alignItems: "center" }} className="cols-stack">
            <div>
              <p className="eyebrow">Repair, then prove it</p>
              <h2 className="display" style={{ fontSize: "clamp(1.85rem, 3.3vw, 2.7rem)", marginBottom: 16 }}>A fix you can <span className="em">trust went in</span>.</h2>
              <p className="lead-copy" style={{ marginBottom: 20 }}>Vraelis does not hand you a bug list and walk away. Every blocker ships with a builder-specific fix prompt. When you push the fix, Vraelis reruns the exact failed check on a preview, confirms the regression is closed, and can open the pull request.</p>
              <div className="card card--acc" style={{ padding: 14 }}>
                <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 6 }}>You stay in control</div>
                <p style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.55, margin: 0 }}>Vraelis does not modify your code or deploy on its own. It proposes the fix and proves it worked. The decision to ship stays yours.</p>
              </div>
            </div>
            <div className="win" style={{ boxShadow: "var(--shadow-lg)" }}>
              <div className="win__bar"><span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, color: "var(--fg-2)" }}>Repair loop</span><span className="pill" style={{ marginLeft: "auto", background: "var(--acc-soft)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>Regression closed</span></div>
              <div style={{ padding: "clamp(18px,2.4vw,26px)", display: "grid", gap: 12 }}>
                {[
                  ["Fix prompt", "A builder-specific prompt that describes the exact blocker and the change."],
                  ["Preview deploy", "You push the fix; Vraelis picks up the preview build."],
                  ["Rerun the exact check", "Only the failed flow reruns, on the same steps, in a real browser."],
                  ["Regression closed", "The blocker is confirmed gone, with fresh evidence."],
                  ["Open the PR", "Vraelis can open the pull request with the run attached."],
                ].map(([t, d], i, arr) => (
                  <div key={t} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ flex: "none", width: 26, height: 26, borderRadius: 8, background: i === arr.length - 1 ? "var(--acc-soft)" : "var(--bg-2)", border: `1px solid ${i === arr.length - 1 ? "var(--acc-line)" : "var(--line-2)"}`, color: "var(--acc-deep)", display: "grid", placeItems: "center", fontFamily: "var(--font-code)", fontSize: 12, fontWeight: 600 }}>{i + 1}</span>
                    <div><div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, color: "var(--fg-1)" }}>{t}</div><div style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.5 }}>{d}</div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── The Production Pass: the output ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div className="sec-head sec-head--center">
            <p className="eyebrow">The output</p>
            <h2 className="display">A <span className="em">launch decision</span>, not a dashboard.</h2>
            <p>Every run ends in one answer you can act on. Not a wall of charts, not a score to interpret. READY to launch, NEEDS REVIEW, or BLOCKED, each with the reason and the evidence behind it.</p>
          </div>
          <div className="tile-grid cols-3" style={{ maxWidth: 900, margin: "0 auto" }}>
            {([
              { s: "ready" as StatusKey, t: "Ship it", d: "Every critical flow held across the stack. Launch with the evidence attached." },
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
          <p style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "var(--fg-4)", textAlign: "center", marginTop: 18 }}>Delivered in the app, by API, or as a gate in CI.</p>
        </div>
      </section>

      {/* ── Is / is not: own the category, honestly ── */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">What Vraelis is</p>
            <h2 className="display">Production readiness, <span className="em">not another test tool</span>.</h2>
            <p>Testing tools find bugs and hand you a list. Vraelis verifies the whole stack the way production will and returns a decision, with the proof and the path to green.</p>
          </div>
          <div className="card" style={{ background: "var(--bg-2)", borderRadius: "var(--r-xl)" }}>
            <div className="cols-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(18px, 3vw, 36px)" }}>
              <div>
                <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 10 }}>Vraelis is</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>{IS_THINGS.map((x) => <div key={x} style={{ display: "flex", gap: 9, fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.5 }}><span style={{ color: "var(--acc)", marginTop: 1 }}>✓</span>{x}</div>)}</div>
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 10 }}>Vraelis is not</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>{IS_NOT_THINGS.map((x) => <div key={x} style={{ display: "flex", gap: 9, fontSize: 13.5, color: "var(--fg-4)", lineHeight: 1.5 }}><span style={{ color: "var(--fg-5)", marginTop: 1 }}>✕</span>{x}</div>)}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Where we are: honest status ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">Where we are</p>
            <h2 className="display">Shipping the <span className="em">first pillar</span> now.</h2>
            <p>Vraelis Browser Verification, the real-browser preflight that runs your critical flows as two users and returns a launch decision, is the piece we are putting in front of first builders. The deeper cross-layer connections build out from there. We will be straight about what is live and what is next.</p>
          </div>
          <div className="tile-grid cols-2">
            <div className="card">
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 12 }}>Live in early access</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
                {["Real-browser verification of your approved flows", "Two-user state and isolation proof", "The Production Pass launch decision with evidence"].map((x) => (
                  <li key={x} style={{ display: "flex", gap: 10, fontSize: 14, color: "var(--fg-2)", alignItems: "flex-start" }}><span style={{ color: "var(--acc)", marginTop: 1 }}>✓</span>{x}</li>
                ))}
              </ul>
            </div>
            <div className="card" style={{ background: "var(--bg-1)" }}>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Rolling in</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
                {["Connections for GitHub, Vercel, Supabase, and Stripe", "Repair pull requests with the rerun attached", "Continuous guard on every deploy"].map((x) => (
                  <li key={x} style={{ display: "flex", gap: 10, fontSize: 14, color: "var(--fg-3)", alignItems: "flex-start" }}><span style={{ color: "var(--fg-5)", marginTop: 1 }}>○</span>{x}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="section cta-band" style={{ borderBottom: "none" }}>
        <div className="glow glow--soft" />
        <div className="wrap" style={{ maxWidth: 720, textAlign: "center" }}>
          <h2 className="display" style={{ fontSize: "clamp(2.1rem, 4.4vw, 3.4rem)", marginBottom: 18 }}>Stop shipping <span className="em">demos as products</span>.</h2>
          <p className="lead-copy" style={{ margin: "0 auto 28px", textAlign: "center" }}>Connect your AI-built app and get a launch decision before your users find the blockers. Test-only, you approve every flow, and early access is open.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signin?callbackUrl=%2Fapp" className="btn btn--lg">Get early access <span aria-hidden>→</span></Link>
            <Link href="/how-it-works" className="btn btn--ghost btn--lg">See how it works</Link>
          </div>
        </div>
      </section>
    </>
  );
}
