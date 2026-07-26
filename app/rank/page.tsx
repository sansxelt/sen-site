import Link from "next/link";
import { ogMeta } from "@/lib/og-meta";
import { VerificationTimeline } from "./_components/verification-timeline";

export const metadata = {
  ...ogMeta({
    title: "AI says it is done. Vraelis proves it.",
    description:
      "Give Vraelis a deployed application and the outcome that should be true. It independently derives what must be checked, verifies the live result, and returns the evidence behind its decision. Starting with deployed web applications.",
    path: "/",
    // noImage used to be set here, because LinkedIn froze on a stale rendered OG card across several ?v
    // bumps and a text-only embed was the only way to stop it showing an old positioning. Nothing renders a
    // headline card any more: every embed now carries the square Vraelis mark and one fixed sentence, so
    // there is no stale artwork left to opt out of.
  }),
  title: { absolute: "Vraelis" },
};

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// THE RULE THIS PAGE IS WRITTEN UNDER: every sentence describes something that works today, or is explicitly
// marked as direction. The product is an independent verifier of completion claims. A homepage that
// overstates its own coverage is the exact failure it sells against, and that irony would be earned.
//
// Concretely, nothing here claims: MCP, GitHub Checks, deployment hooks, mobile, desktop, physical systems,
// or following an outcome through payment processors, databases or email. Vraelis drives a real browser
// against a deployed web application. That is the whole of it, and it is enough.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────

function Rule() {
  return <div style={{ height: 1, background: "var(--line-1)" }} />;
}

// Small monospace label used to number and name the three beats of the primitive.
function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
        <span style={{ fontFamily: "var(--font-code)", fontSize: 11, letterSpacing: "0.1em", color: "var(--acc-deep)" }}>{n}</span>
        <h3 style={{ margin: 0, fontSize: "1.06rem", letterSpacing: "-0.015em", color: "var(--fg-1)" }}>{title}</h3>
      </div>
      <div style={{ color: "var(--fg-3)", fontSize: "0.945rem", lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

// The requirements Vraelis derives from a claim, shown as the product actually presents them: machine
// derived, and labelled as such on the surface rather than in a footnote.
const DERIVED = [
  "The upgrade action is reachable from the pricing page",
  "Payment completes without an error",
  "The account reflects the Pro plan immediately afterwards",
  "Pro-only capability is actually available",
  "The plan survives a fresh sign-in",
  "No error state is shown on the way through",
];

export default function VraelisLanding() {
  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────────────────────────────────────────
          The claim on the left, the loop on the right. The visual is a timeline rather than a dashboard
          because what needs explaining is what Vraelis DOES, not what it looks like. */}
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
            {/* The honesty line belongs in the hero, not a footnote: a page promising to verify "outcomes"
                invites the reader to assume any system, and the assumption forms right here. */}
            <p className="rise" data-d="4" style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "var(--fg-4)", margin: "16px 0 0", maxWidth: 500, lineHeight: 1.55 }}>
              Starting with deployed web applications.
            </p>
          </div>

          <div className="hero-demo rise" data-d="5" style={{ position: "relative", minWidth: 0 }}>
            <VerificationTimeline />
          </div>
        </div>
      </section>

      {/* ── 2. From claim to evidence ───────────────────────────────────────────────────────────────────
          The primitive, in three beats. The load-bearing idea is that the INPUT is an outcome claim rather
          than an authored test suite, because a test encodes the same assumptions the bug came from. */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head" style={{ marginBottom: 34 }}>
            <p className="eyebrow">From claim to evidence</p>
            <h2 className="display">You describe the outcome. Vraelis works out the rest.</h2>
            <p>Not a test suite you author and maintain. A sentence about what should be true, turned into checks against the running system.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "clamp(22px, 3vw, 40px)", alignItems: "start" }}>
            <Step n="01" title="Describe what should be true">
              <p style={{ margin: "0 0 12px" }}>One sentence, about the result rather than the steps to reach it.</p>
              <p style={{
                margin: 0, padding: "11px 13px", borderRadius: 8, background: "var(--bg-2)",
                border: "1px solid var(--line-2)", fontSize: "0.9rem", lineHeight: 1.5, color: "var(--fg-2)",
              }}>
                &ldquo;A customer can upgrade to Pro and receive access immediately.&rdquo;
              </p>
            </Step>

            <Step n="02" title="Vraelis derives what must be checked">
              <p style={{ margin: "0 0 12px" }}>It reads the deployed application and works out the requirements that claim implies.</p>
              <ul style={{ margin: "0 0 12px", paddingLeft: 16, display: "grid", gap: 5 }}>
                {DERIVED.slice(0, 4).map((d) => (
                  <li key={d} style={{ fontSize: "0.875rem", lineHeight: 1.45, color: "var(--fg-3)" }}>{d}</li>
                ))}
                <li style={{ fontSize: "0.875rem", color: "var(--fg-5)", listStyle: "none", marginLeft: -16 }}>and {DERIVED.length - 4} more</li>
              </ul>
              {/* Disclosed on the surface, not in documentation. A misread claim producing a confident wrong
                  verdict is this product's main failure mode, and the requirements are how you catch it. */}
              <p style={{ margin: 0, fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)", lineHeight: 1.5 }}>
                Machine derived. Not human reviewed. Always shown to you.
              </p>
            </Step>

            <Step n="03" title="Vraelis returns a decision, with evidence">
              <p style={{ margin: "0 0 12px" }}>Three answers, and the third one is the honest option most tools refuse to have.</p>
              <div style={{ display: "grid", gap: 7, marginBottom: 12 }}>
                {[
                  ["Verified", "the claim held", "var(--acc-deep)"],
                  ["Failed", "it did not, and here is what happened instead", "#B45309"],
                  ["Blocked", "no verdict could be reached", "var(--fg-4)"],
                ].map(([k, v, c]) => (
                  <div key={k} style={{ display: "flex", gap: 9, alignItems: "baseline", fontSize: "0.88rem" }}>
                    <span style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: c, minWidth: 62 }}>{k}</span>
                    <span style={{ color: "var(--fg-3)", lineHeight: 1.45 }}>{v}</span>
                  </div>
                ))}
              </div>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--fg-4)", lineHeight: 1.5 }}>
                With the step trace, screenshots, console output, failed network requests, and a repair prompt when something breaks.
              </p>
            </Step>
          </div>
        </div>
      </section>

      {/* ── 3. Independent by design ────────────────────────────────────────────────────────────────────
          The architectural argument. No competitor is named: the point is a structural property, and
          attacking tools would make it sound like positioning instead of a design constraint. */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.05fr) minmax(0,0.95fr)", gap: "clamp(28px, 5vw, 64px)", alignItems: "center" }} className="cols-stack">
            <div>
              <p className="eyebrow">Independent by design</p>
              <h2 className="display" style={{ fontSize: "clamp(1.85rem, 3.3vw, 2.7rem)", marginBottom: 16 }}>It checks from outside the application.</h2>
              <p className="lead-copy" style={{ marginBottom: 16 }}>
                Vraelis does not need an SDK, test files, or access to the codebase. It operates the deployed application through a real browser, the way the person receiving it would.
              </p>
              <p style={{ color: "var(--fg-3)", fontSize: "0.98rem", lineHeight: 1.62, margin: 0 }}>
                That distance is the point. Anything written inside the system, by the author or the model that built it, inherits the same assumptions the mistake came from. Independence is not something you reach by trying harder. It is structural, and structure is the only way to get it.
              </p>
            </div>

            {/* The contrast, drawn rather than described. Three stacked stages, with Vraelis clearly beside
                the deployed system instead of inside it. */}
            <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)", background: "var(--bg-1)", padding: "clamp(20px, 3vw, 30px)", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ display: "grid", gap: 0, justifyItems: "center", textAlign: "center" }}>
                {[
                  { t: "AI builder", d: "writes and ships the change" },
                  { t: "Deployed application", d: "what your customer actually receives" },
                ].map((s) => (
                  <div key={s.t} style={{ display: "contents" }}>
                    <div style={{ width: "100%", padding: "13px 14px", border: "1px solid var(--line-2)", borderRadius: 9, background: "var(--bg-2)" }}>
                      <div style={{ fontSize: "0.95rem", color: "var(--fg-1)", fontWeight: 550 }}>{s.t}</div>
                      <div style={{ fontSize: "0.82rem", color: "var(--fg-4)", marginTop: 2 }}>{s.d}</div>
                    </div>
                    <div aria-hidden style={{ height: 22, width: 1, background: "var(--line-3)", margin: "0 auto" }} />
                  </div>
                ))}
                <div style={{ width: "100%", padding: "15px 14px", border: "1px solid var(--acc-line)", borderRadius: 9, background: "var(--acc-soft)" }}>
                  <div style={{ fontSize: "0.95rem", color: "var(--acc-deep)", fontWeight: 600 }}>Vraelis checks it independently</div>
                  <div style={{ fontSize: "0.82rem", color: "var(--fg-3)", marginTop: 2 }}>from outside, with no access to the source</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Failure is not the end ───────────────────────────────────────────────────────────────────
          The loop that makes a failure useful. The division of labour is stated precisely because the
          tempting overclaim here is that Vraelis fixes code. It does not. */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head" style={{ marginBottom: 30 }}>
            <p className="eyebrow">Failure is not the end</p>
            <h2 className="display">A failed claim becomes something the builder can fix.</h2>
            <p>A verdict on its own tells you something is wrong and leaves you to find it. The useful output is the package that lets the thing which wrote the code repair it.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,0.95fr) minmax(0,1.05fr)", gap: "clamp(26px, 4vw, 52px)", alignItems: "start" }} className="cols-stack">
            <div style={{ display: "grid", gap: 0 }}>
              {[
                "Failure observed",
                "Evidence captured",
                "Repair prompt generated",
                "Sent back to the coding agent",
                "New deployment",
                "Reverified",
              ].map((s, i, arr) => (
                <div key={s} style={{ display: "grid", gridTemplateColumns: "16px minmax(0,1fr)", gap: 12, alignItems: "start" }}>
                  <div style={{ display: "grid", justifyItems: "center", height: "100%" }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: i === arr.length - 1 ? "var(--acc-deep)" : "var(--line-3)", marginTop: 7 }} />
                    {i < arr.length - 1 && <span style={{ width: 1, flex: 1, minHeight: 26, background: "var(--line-2)" }} />}
                  </div>
                  <span style={{ fontSize: "0.97rem", color: i === arr.length - 1 ? "var(--acc-deep)" : "var(--fg-2)", paddingBottom: 14, fontWeight: i === arr.length - 1 ? 600 : 500 }}>{s}</span>
                </div>
              ))}
            </div>

            <div>
              <p style={{ color: "var(--fg-2)", fontSize: "1.02rem", lineHeight: 1.62, margin: "0 0 18px" }}>
                Vraelis packages what should have happened, what happened instead, how to reproduce it, and the browser evidence from the failure.
              </p>
              {/* The precise division of labour. Vraelis does not diagnose source-level causes and does not
                  edit code, and saying so plainly is what makes the rest of the claim credible. */}
              <p style={{ color: "var(--fg-2)", fontSize: "1.02rem", lineHeight: 1.62, margin: "0 0 18px" }}>
                The coding agent diagnoses the source-level cause. Vraelis independently checks the repair.
              </p>
              <p style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "var(--fg-4)", lineHeight: 1.6, margin: 0, paddingTop: 16, borderTop: "1px solid var(--line-2)" }}>
                Vraelis does not edit your code. It decides whether the outcome is true, and gives whoever wrote it enough to fix it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Built for people and agents ──────────────────────────────────────────────────────────────
          Both surfaces that exist today, and nothing that does not. The CLI is shown but kept visually
          secondary while the developer surface is still being proven in production. */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div className="sec-head" style={{ marginBottom: 30 }}>
            <p className="eyebrow">Built for people and agents</p>
            <h2 className="display">The same verification, however it is asked for.</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: "clamp(20px, 3vw, 34px)" }}>
            <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)", background: "var(--bg-1)", padding: "clamp(20px, 2.6vw, 28px)" }}>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 10 }}>For people</div>
              <h3 style={{ margin: "0 0 10px", fontSize: "1.12rem", letterSpacing: "-0.015em" }}>Submit and review verifications from the Vraelis application.</h3>
              <p style={{ margin: "0 0 18px", color: "var(--fg-3)", fontSize: "0.95rem", lineHeight: 1.6 }}>
                Describe the outcome, watch it run, and read the decision with the evidence behind it.
              </p>
              <Link href="/signin?callbackUrl=%2Fapp" className="btn">Verify an outcome</Link>
            </div>

            <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)", background: "var(--bg-1)", padding: "clamp(20px, 2.6vw, 28px)" }}>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 10 }}>For software</div>
              <h3 style={{ margin: "0 0 10px", fontSize: "1.12rem", letterSpacing: "-0.015em" }}>Launch and read verifications through the API or CLI.</h3>
              <p style={{ margin: "0 0 14px", color: "var(--fg-3)", fontSize: "0.95rem", lineHeight: 1.6 }}>
                One command, one exit code. Built so a pipeline or an agent can act on the result without a person reading it.
              </p>
              <pre className="codeblock" style={{ overflowX: "auto", fontSize: 12, margin: "0 0 14px" }}><code>{`vraelis verify \\
  --url https://example.com \\
  --claim "Checkout grants Pro access" \\
  --wait`}</code></pre>
              <Link href="/developers" style={{ fontSize: 14, fontWeight: 600, color: "var(--acc-deep)", textDecoration: "none" }}>See the developer surface →</Link>
            </div>
          </div>

          {/* The direction, stated as direction. This is where a reader decides how big the company is, and
              it is also where it would be easiest to fabricate coverage, so the boundary is explicit. */}
          <div style={{ marginTop: "clamp(30px, 4vw, 46px)", paddingTop: 24, borderTop: "1px solid var(--line-2)", maxWidth: 640 }}>
            <p style={{ fontSize: "1.05rem", lineHeight: 1.6, color: "var(--fg-2)", margin: "0 0 10px" }}>
              Vraelis starts with deployed web applications. The long-term verification layer should work anywhere AI claims an outcome occurred.
            </p>
            <p style={{ fontSize: "0.9rem", color: "var(--fg-4)", margin: 0, lineHeight: 1.55 }}>
              That is the direction, not today&rsquo;s coverage. What is live is on the <Link href="/limitations" style={{ color: "var(--acc-deep)" }}>limitations page</Link>, in full.
            </p>
          </div>
        </div>
      </section>

      <Rule />

      <section className="section cta-band" style={{ borderBottom: "none" }}>
        <div className="glow glow--soft" />
        <div className="wrap" style={{ maxWidth: 720, textAlign: "center" }}>
          <h2 className="display" style={{ fontSize: "clamp(2.1rem, 4.4vw, 3.4rem)", marginBottom: 18 }}>Before anything says <span className="em">done</span>.</h2>
          <p className="lead-copy" style={{ margin: "0 auto 28px", textAlign: "center" }}>
            Give Vraelis a deployed application and the outcome that should be true. Get back a decision you can act on, and the evidence behind it.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signin?callbackUrl=%2Fapp" className="btn btn--lg">Verify an outcome <span aria-hidden>→</span></Link>
            <Link href="/how-it-works" className="btn btn--ghost btn--lg">See how it works</Link>
          </div>
        </div>
      </section>
    </>
  );
}
