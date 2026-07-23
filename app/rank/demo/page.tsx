import Link from "next/link";
import { ogMeta } from "@/lib/og-meta";

export const metadata = ogMeta({
  title: "Demo",
  description:
    "A walkthrough of a Vraelis verification: connect an AI-built app, approve the Production Contract, watch a real browser run the critical flows as two users, and follow one failure from evidence to a verified fix and a Verified decision.",
  path: "/demo",
});

// Public walkthrough of the verification workflow. Every artifact rendered here is an
// illustrative example (and labeled as such), not a live account or a real run.

function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
const I = {
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8",
  connect: "M9 12a3 3 0 0 0 3 3h1a3 3 0 0 0 0-6M15 12a3 3 0 0 0-3-3h-1a3 3 0 0 0 0 6M7 7l-2 2a4 4 0 0 0 0 6M17 17l2-2a4 4 0 0 0 0-6",
  flag: "M4 21V4M4 4h13l-2 4 2 4H4",
};

// Decision / status tones. The .pill class renders the label text, so status is never colour-only.
const TONES = {
  ready: { fg: "var(--acc-deep)", bg: "var(--acc-soft)", line: "var(--acc-line)" },
  blocked: { fg: "#C0392B", bg: "#FBEBEA", line: "#F0C7C2" },
  muted: { fg: "var(--fg-4)", bg: "var(--bg-2)", line: "var(--line-2)" },
} as const;
type Tone = keyof typeof TONES;
function Pill({ tone, children }: { tone: Tone; children: string }) {
  const c = TONES[tone];
  return (
    <span className="pill" style={{ background: c.bg, color: c.fg, borderColor: c.line, fontFamily: "var(--font-code)", letterSpacing: "0.06em" }}>
      {children}
    </span>
  );
}

// The honesty tag every example artifact on this page carries.
function Illustrative() {
  return (
    <span style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-5)", flex: "none" }}>
      Illustrative example
    </span>
  );
}

function EvRow({ label, text }: { label: string; text: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "96px minmax(0,1fr)", gap: 10 }}>
      <span style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", paddingTop: 3 }}>{label}</span>
      <span style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.6 }}>{text}</span>
    </div>
  );
}

const CONTRACT_FLOWS: string[] = [
  "Sign up and land in an empty workspace",
  "Create a task and find it again after a refresh",
  "A second user cannot see the first user's tasks",
  "Navigate and create at phone width",
];

export default function Demo() {
  return (
    <>
      {/* Hero */}
      <section style={{ position: "relative" }}>
        <div className="glow glow--soft glow--bleed" />
        <div className="grid-faint" style={{ opacity: 0.5 }} />
        <div className="wrap" style={{ position: "relative", zIndex: 1, paddingTop: "clamp(48px, 6vw, 88px)", paddingBottom: "clamp(20px, 3vw, 34px)", textAlign: "center" }}>
          <p className="eyebrow" style={{ justifyContent: "center" }}>Demo</p>
          <h1 className="display" style={{ fontSize: "clamp(2.2rem, 4.6vw, 3.5rem)", marginBottom: 16, maxWidth: 880, marginInline: "auto", lineHeight: 1.05, textWrap: "balance" }}>
            Follow one app from <span className="em">prototype</span> to <span className="em">Verified</span>.
          </h1>
          <p className="lead-copy" style={{ margin: "0 auto", textAlign: "center", maxWidth: 700 }}>
            AI built the product. Vraelis finishes the engineering. This walkthrough follows a single verification: the contract, the real-browser run, a failure with evidence, the fix, and the verified rerun.
          </p>
          <p style={{ fontFamily: "var(--font-code)", fontSize: 11.5, letterSpacing: "0.06em", color: "var(--fg-4)", marginTop: 14 }}>
            Every artifact below is an illustrative example, not a live account.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 26 }}>
            <Link href="/signin?callbackUrl=%2Fapp" className="btn btn--lg">Check your application <span aria-hidden>→</span></Link>
            <Link href="/how-it-works" className="btn btn--ghost btn--lg">How it works</Link>
          </div>
        </div>
      </section>

      {/* Steps 01-03: prototype, connect, contract */}
      <section className="section" style={{ paddingTop: "clamp(24px, 3vw, 40px)" }}>
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">Steps 01 to 03</p>
            <h2 className="display">A prototype, a URL, and a <span className="em">signed contract</span>.</h2>
          </div>
          <div className="tile-grid cols-3">
            {[
              { k: "01", i: I.spark, t: "The prototype", d: "An afternoon with an AI builder produced a working task tracker. It demos well. What nobody knows yet: does created data survive a refresh, and can a second user reach it." },
              { k: "02", i: I.connect, t: "Connect the app", d: "You give Vraelis the deployed URL and the prompt the app was built from. No test scripts to write, nothing to install." },
              { k: "03", i: I.flag, t: "Approve the Production Contract", d: "Vraelis proposes what the app must do and you edit and approve it. Four flows are marked critical. Nothing runs until you sign off." },
            ].map((s) => (
              <div key={s.k} className="acard" style={{ gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="acard__icon" style={{ width: 40, height: 40 }}><Icon d={s.i} /></div>
                  <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-5)" }}>{s.k}</span>
                </div>
                <div className="acard__t">{s.t}</div>
                <div className="acard__d">{s.d}</div>
              </div>
            ))}
          </div>

          {/* Contract artifact */}
          <div className="card" style={{ marginTop: 20, padding: "clamp(18px, 2.5vw, 26px)", maxWidth: 720, marginInline: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-3)" }}>Production Contract</span>
                <Pill tone="ready">Approved</Pill>
              </div>
              <Illustrative />
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {CONTRACT_FLOWS.map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", border: "1px solid var(--line-2)", borderRadius: 8, background: "var(--bg-1)" }}>
                  <span style={{ fontSize: 14, color: "var(--fg-2)" }}>{f}</span>
                  <Pill tone="muted">Critical</Pill>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Steps 04-05: the run and the BLOCKED decision */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">Steps 04 and 05</p>
            <h2 className="display">A real browser runs it. The verification comes back <span className="em">Failed</span>.</h2>
            <p>An isolated real browser signs up, clicks, types, and refreshes as two separate users. Every step is a recorded observation: what was clicked, what rendered, and what the network and console did. Then one decision, with the evidence behind it.</p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", maxWidth: 720, margin: "0 auto 16px" }}>
            <Pill tone="blocked">FAILED</Pill>
            <span style={{ fontSize: 14, color: "var(--fg-2)" }}>Two of the four critical flows failed. Here is the first failure in full.</span>
          </div>

          {/* Blocker artifact */}
          <div className="card" style={{ padding: "clamp(18px, 2.5vw, 26px)", maxWidth: 720, marginInline: "auto", borderColor: TONES.blocked.line }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Pill tone="blocked">Critical</Pill>
                <Pill tone="muted">Persistence</Pill>
              </div>
              <Illustrative />
            </div>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.15rem, 1.8vw, 1.4rem)", marginBottom: 14 }}>Created data disappears after refresh</h3>
            <div style={{ display: "grid", gap: 10 }}>
              <EvRow label="Expected" text="A task created by User A is still listed after a hard refresh." />
              <EvRow label="Observed" text="The task renders right after creation, but the list is empty after refresh. No write appears in the network log." />
              <EvRow label="Repro" text="Sign in as User A, create a task, hard refresh the workspace." />
            </div>
            <p style={{ fontSize: 13, color: "var(--fg-4)", lineHeight: 1.6, marginTop: 14, marginBottom: 0 }}>
              The full failure record ships with the step timeline, the screenshot at the moment of failure, and the network and console records.
            </p>
          </div>

          <p style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: 1.6, maxWidth: 720, margin: "16px auto 0" }}>
            The second failure from the same run: navigation breaks at phone width. Same anatomy, its category, expected and observed behavior, reproduction steps, and screenshot.
          </p>
        </div>
      </section>

      {/* Steps 06-07: fix prompt and verified rerun */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">Steps 06 and 07</p>
            <h2 className="display">A fix prompt, then a <span className="em">verified rerun</span>.</h2>
            <p>Every failure ships with a fix prompt written for the tool that built the app, not just a description of what broke. Paste it into your builder, push the fix, and Vraelis reruns the exact checks that failed.</p>
          </div>

          <div className="tile-grid cols-2">
            {/* Fix prompt artifact */}
            <div className="card" style={{ padding: "clamp(18px, 2.5vw, 26px)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-3)" }}>Fix prompt</span>
                  <Pill tone="muted">Persistence</Pill>
                </div>
                <Illustrative />
              </div>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-2)", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>
                The create-task flow renders the new task from client state but never persists it. Make the create action write to the backing store, and make the workspace read the list from the store on load. Keep the UI unchanged. To confirm: create a task, hard refresh, the task must still be listed.
              </p>
            </div>

            {/* Rerun artifact */}
            <div className="card" style={{ padding: "clamp(18px, 2.5vw, 26px)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                <span style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-3)" }}>Verified rerun</span>
                <Illustrative />
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>Created data disappears after refresh</div>
                    <div style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55, marginTop: 3 }}>The exact failed check now passes on the new deploy.</div>
                  </div>
                  <Pill tone="ready">Resolved</Pill>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>Navigation breaks at phone width</div>
                    <div style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55, marginTop: 3 }}>Untouched by this fix. It gets its own prompt.</div>
                  </div>
                  <Pill tone="blocked">Still failing</Pill>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 12, borderTop: "1px solid var(--line-2)" }}>
                  <Pill tone="blocked">FAILED</Pill>
                  <span style={{ fontSize: 13, color: "var(--fg-3)" }}>One verified fix is progress, not a launch.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Step 08: Verified */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div className="sec-head sec-head--center">
            <p className="eyebrow">Step 08</p>
            <h2 className="display">The final rerun comes back <span className="em">Verified</span>.</h2>
            <p>The phone-width fix lands, and a final rerun exercises every critical flow again. Sign up, persistence, two-user isolation, and phone-width navigation all hold.</p>
          </div>
          <div className="card card--acc" style={{ padding: "clamp(20px, 3vw, 30px)", maxWidth: 640, marginInline: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <Pill tone="ready">VERIFIED</Pill>
              <Illustrative />
            </div>
            <p style={{ fontSize: 15, color: "var(--fg-2)", lineHeight: 1.65, margin: 0 }}>
              Every critical flow in the contract held. The same evidence behind the earlier Failed decision is now the record that those flows passed on this build, and the next verification starts from that baseline.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section cta-band" style={{ borderBottom: "none" }}>
        <div className="glow glow--soft" />
        <div className="wrap" style={{ maxWidth: 680, textAlign: "center" }}>
          <h2 className="display" style={{ fontSize: "clamp(1.9rem, 3.6vw, 2.8rem)", marginBottom: 16 }}>AI built the product. <span className="em">Vraelis finishes the engineering.</span></h2>
          <p className="lead-copy" style={{ margin: "0 auto 26px", textAlign: "center" }}>Connect your app and get this walkthrough with real evidence on your own flows.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signin?callbackUrl=%2Fapp" className="btn btn--lg">Check your application <span aria-hidden>→</span></Link>
            <Link href="/how-it-works" className="btn btn--ghost btn--lg">How it works</Link>
          </div>
        </div>
      </section>
    </>
  );
}
