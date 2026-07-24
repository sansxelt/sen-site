import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { v6meta } from "../_system/meta";
import { PageHero, Reveal, SectionHead, CTA, EditorialLink, Signal, Kicker } from "../_system/ui";

// Agents page (design 06). Framing: how Vraelis works AROUND software agents, from assigned responsibility to
// trusted completion. TRUTH: Vraelis does NOT read an agent's private reasoning. It works from observable,
// available activity: submitted plans, code changes, tool and API effects, external events, agent claims, and
// execution evidence, measured against human-reviewed standards. Deeper, continuous in-agent oversight is
// clearly marked as Direction. The verification engine is real, and is one capability. LIGHT = framing;
// GRAPHITE = live agent work.

export const metadata: Metadata = v6meta({
  title: "Agents",
  description:
    "How Vraelis provides oversight around AI software agents: observing the plan, tracking changes, challenging assumptions, routing sensitive decisions to review, and accepting completion only when it is proven.",
  path: "/agents",
  ogTitle: "Oversight around AI software agents",
  ogDescription:
    "Vraelis works around software agents from observable activity and evidence, not private reasoning: plan, changes, claims, findings, repair, and independent completion.",
});

const BASE = "/dev-preview/v6";
type Sig = "go" | "wait" | "stop";

const wrapRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "clamp(20px,2.8vw,44px)",
  alignItems: "stretch",
};

/* ---------- truthful inputs ---------- */

const WORKS_FROM = [
  "Submitted plans, before the work begins",
  "Code changes and diffs",
  "Tool and API effects the work produces",
  "External events from GitHub, CI, and webhooks",
  "The claims an agent makes about its own work",
  "Execution evidence from the running software in a real browser",
  "Human-reviewed standards, held outside the agent",
];
const DOES_NOT = [
  "Read an agent's private chain of thought",
  "Trust a claim because it sounds confident",
  "Treat a passing self-test as independent proof",
  "Assume the agent's intentions, only its observable work",
];

/* ---------- the loop around the agent (signature) ---------- */

const LOOP: { n: string; agent: string; vraelis: string; sig?: Sig; tag?: string }[] = [
  { n: "01", agent: "Receives responsibility for real work.", vraelis: "Opens a durable record with the reviewed standard held outside the code.", sig: "go", tag: "Recorded" },
  { n: "02", agent: "Submits a plan for how it will proceed.", vraelis: "Reads the submitted plan and maps the systems it will touch." },
  { n: "03", agent: "Changes code and calls tools and APIs.", vraelis: "Tracks the changes and the external effects that appear." },
  { n: "04", agent: "States assumptions and claims progress.", vraelis: "Challenges unsupported assumptions and asks for evidence.", sig: "wait", tag: "Challenged" },
  { n: "05", agent: "Reaches a sensitive or irreversible action.", vraelis: "Routes the decision to a person before it can ship.", sig: "wait", tag: "Review" },
  { n: "06", agent: "Produces work that misses the requirement.", vraelis: "Turns the failure into a structured, recorded finding.", sig: "stop", tag: "Finding" },
  { n: "07", agent: "Submits a repair for the finding.", vraelis: "Re-checks the repair independently against the same standard." },
  { n: "08", agent: "Claims the work is complete.", vraelis: "Accepts Verified, or returns Failed or Blocked.", sig: "go", tag: "Decided" },
];

/* ---------- review + integrations ---------- */

const SENSITIVE: { t: string; d: string }[] = [
  { t: "Changing what existing customers are charged", d: "Pricing that affects live accounts waits for a person." },
  { t: "Deleting or exporting production data", d: "Irreversible data actions are held for approval." },
  { t: "Granting broad access or API scope", d: "Widening permissions is a decision, not a step." },
  { t: "Shipping an irreversible migration", d: "One-way changes stop until someone accepts them." },
];

const LIVE_SURFACES = ["Vraelis web app", "API", "CLI", "GitHub", "Vercel", "Slack", "Webhooks"];
const DIRECTION_SURFACES = ["Cursor / VS Code", "Desktop", "Browser companion", "Mobile approvals", "MCP and agent tools"];

function Chip({ children, soon = false }: { children: ReactNode; soon?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "7px 13px",
        borderRadius: 999,
        border: `1px solid ${soon ? "var(--line)" : "var(--line-2)"}`,
        background: soon ? "transparent" : "var(--surface)",
        color: soon ? "var(--ink-4)" : "var(--ink-2)",
        fontSize: 13.5,
        fontWeight: 500,
        ...(soon ? { borderStyle: "dashed" as const } : {}),
      }}
    >
      {children}
    </span>
  );
}

function InputList({ items, tone }: { items: string[]; tone: Sig }) {
  return (
    <ul style={{ listStyle: "none", margin: "18px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((t) => (
        <li key={t} style={{ display: "flex", gap: 11, alignItems: "flex-start", fontSize: 15, lineHeight: 1.5, color: "var(--ink-2)" }}>
          <span aria-hidden style={{ marginTop: 7, width: 7, height: 7, borderRadius: 999, background: tone === "go" ? "var(--go)" : "var(--wait)", flex: "none" }} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

/* ================================= page ================================= */

export default function Agents() {
  return (
    <>
      <PageHero
        kicker="For AI software agents"
        title="Oversight that works around the agent, not inside it."
        lead="An agent that plans, writes, and repairs the work will also tell you it is finished. Vraelis stays outside that loop: it observes the work an agent produces, challenges what it cannot prove, and decides independently whether the responsibility is met."
        cta={
          <>
            <CTA brand lg>Open Vraelis</CTA>
            <EditorialLink href={`${BASE}/platform`}>See the full platform</EditorialLink>
          </>
        }
      />

      {/* 1 ── Truthful inputs: what Vraelis can actually see ── */}
      <section className="v6-sec" style={{ paddingTop: "clamp(12px,2vw,28px)" }}>
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="What Vraelis works from"
              title="Observable work, not private reasoning."
              lead="Vraelis is honest about what it can see. It judges the activity an agent produces and the evidence the software leaves behind, measured against standards a person approved. It does not claim to read an agent's mind."
            />
          </Reveal>
          <div style={{ ...wrapRow, marginTop: "clamp(28px,3vw,40px)" }}>
            <Reveal style={{ flex: "1 1 320px", minWidth: 0 }}>
              <div className="v6-card" style={{ height: "100%" }}>
                <Signal state="go">Available activity, live today</Signal>
                <InputList items={WORKS_FROM} tone="go" />
              </div>
            </Reveal>
            <Reveal style={{ flex: "1 1 320px", minWidth: 0 }} i={1}>
              <div className="v6-card" style={{ height: "100%" }}>
                <Kicker>What Vraelis does not do</Kicker>
                <InputList items={DOES_NOT} tone="wait" />
                <p style={{ margin: "20px 0 0", paddingTop: 16, borderTop: "1px solid var(--line)", color: "var(--ink-3)", fontSize: 14, lineHeight: 1.55 }}>
                  Deeper, continuous oversight that runs alongside the agent as it reasons is on the roadmap, marked as Direction, not described as live.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 2 ── The loop around the agent (GRAPHITE signature) ── */}
      <section className="v6-sec v6-dark" data-nav-dark>
        <div className="v6-wrap v6-wrap--wide">
          <Reveal>
            <SectionHead
              eyebrow="From responsibility to completion"
              title="For every move the agent makes, Vraelis has a response."
              lead="Two lanes, one record. The agent does the work. Vraelis stays alongside it, turning each step into something observed, challenged, or decided."
            />
          </Reveal>

          <Reveal media style={{ marginTop: "clamp(28px,3vw,44px)" }}>
            <div style={{ background: "var(--graphite-2)", border: "1px solid var(--g-line)", borderRadius: 16, padding: "clamp(6px,1.4vw,20px) clamp(16px,2.2vw,28px)" }}>
              {/* lane header (desktop only labels; each row also self-labels for narrow screens) */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: "14px 0", borderBottom: "1px solid var(--g-line)" }}>
                <span className="v6-mono" style={{ flex: "1 1 260px", minWidth: 0, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--g-fg-3)" }}>The agent</span>
                <span className="v6-mono" style={{ flex: "1 1 260px", minWidth: 0, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--go-dk)" }}>Vraelis oversight</span>
              </div>

              {LOOP.map((s) => (
                <div key={s.n} style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: "clamp(16px,2vw,22px) 0", borderTop: "1px solid var(--g-line)" }}>
                  <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                      <span className="v6-mono" style={{ color: "var(--g-fg-3)", fontSize: 12.5, flex: "none" }}>{s.n}</span>
                      <span style={{ color: "var(--g-fg)", fontSize: 15.5, lineHeight: 1.45 }}>{s.agent}</span>
                    </div>
                  </div>
                  <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "baseline" }}>
                      <span style={{ color: "var(--g-fg)", fontSize: 15.5, lineHeight: 1.45 }}>{s.vraelis}</span>
                      {s.sig ? <Signal state={s.sig}>{s.tag}</Signal> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* 3 ── Challenge a claim (real engine) ── */}
      <section className="v6-sec v6-sec--sunk">
        <div className="v6-wrap">
          <div style={wrapRow}>
            <Reveal style={{ flex: "1 1 340px", minWidth: 0 }}>
              <SectionHead
                eyebrow="Challenge, live today"
                title="A claim is not proof. Vraelis makes the agent earn it."
                lead="When an agent says the work is done, Vraelis holds the requirement outside the code and drives the running software in a real browser to see what actually happens. When evidence and confidence disagree, evidence wins."
              />
              <div style={{ marginTop: 24 }}>
                <EditorialLink href={`${BASE}/platform`}>See how the record accumulates evidence</EditorialLink>
              </div>
            </Reveal>
            <Reveal media style={{ flex: "1 1 340px", minWidth: 0 }} i={1}>
              <div className="v6-dark" data-nav-dark style={{ background: "var(--graphite-2)", border: "1px solid var(--g-line)", borderRadius: 16, padding: "clamp(20px,2.4vw,30px)", boxShadow: "var(--sh-md)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", paddingBottom: 16, marginBottom: 18, borderBottom: "1px solid var(--g-line)" }}>
                  <span className="v6-kicker" style={{ color: "var(--g-fg-3)" }}>Agent claim, put to the test</span>
                </div>
                <p style={{ margin: 0, color: "var(--g-fg-2)", fontSize: "1.05rem", fontStyle: "italic" }}>&ldquo;Checkout works. A paid customer gets Pro access.&rdquo;</p>
                <div style={{ marginTop: 18, display: "flex", flexDirection: "column" }}>
                  {[
                    ["Payment", "succeeded", "none"],
                    ["Access after checkout", "not granted", "stop"],
                    ["First repair", "did not survive sign-in", "stop"],
                    ["Later repair", "independently Verified", "go"],
                  ].map(([k, v, tone], i) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "11px 0", borderTop: i === 0 ? "none" : "1px solid var(--g-line)" }}>
                      <span style={{ color: "var(--g-fg-2)", fontSize: 14 }}>{k}</span>
                      <span style={{ color: tone === "stop" ? "var(--stop-dk)" : tone === "go" ? "var(--go-dk)" : "var(--g-fg)", fontSize: 14, fontWeight: 600, textAlign: "right" }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--g-line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <Signal state="go">Verified / 72c98e</Signal>
                  <span className="v6-mono" style={{ color: "var(--g-fg-3)", fontSize: 12 }}>earlier records preserved</span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 4 ── Sensitive decisions enter review ── */}
      <section className="v6-sec">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Review"
              title="Some decisions should never be an agent's to make alone."
              lead="Vraelis lets an agent move quickly on reversible work and stops it at the boundary. Sensitive and irreversible actions are raised to a person before they can ship."
            />
          </Reveal>
          <div className="v6-grid3" style={{ marginTop: "clamp(28px,3vw,40px)" }}>
            {SENSITIVE.map((s, i) => (
              <Reveal key={s.t} i={i % 3}>
                <div className="v6-gcard" style={{ height: "100%" }}>
                  <div style={{ marginBottom: 12 }}><Signal state="wait">Enters review</Signal></div>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 5 ── Findings, repair, completion ── */}
      <section className="v6-sec v6-dark" data-nav-dark>
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Findings, repair, completion"
              title="Failure is not the end of the record. It is part of it."
              lead="When work misses the requirement, Vraelis records a structured finding, hands it back for repair, and re-checks the fix independently. Completion is accepted only when the standard passes."
            />
          </Reveal>
          <div className="v6-grid3" style={{ marginTop: "clamp(28px,3vw,40px)" }}>
            {[
              { s: "stop" as Sig, t: "Findings", d: "A contradiction, missing evidence, or an unsafe assumption becomes a recorded finding against the responsibility." },
              { s: "wait" as Sig, t: "Repair handoff", d: "The finding goes back to the agent as a structured handoff, not a vague complaint about what went wrong." },
              { s: "go" as Sig, t: "Independent recheck", d: "The repair is re-run against the same standard, as its own record. A later result never overwrites an earlier one." },
            ].map((c, i) => (
              <Reveal key={c.t} i={i}>
                <div style={{ background: "var(--graphite-2)", border: "1px solid var(--g-line)", borderRadius: 14, padding: "clamp(20px,2.2vw,26px)", height: "100%" }}>
                  <Signal state={c.s}>{c.t}</Signal>
                  <p style={{ margin: "14px 0 0", color: "var(--g-fg-2)", fontSize: 15, lineHeight: 1.55 }}>{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal style={{ marginTop: "clamp(26px,3vw,38px)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", padding: "clamp(18px,2vw,24px)", background: "var(--graphite-3)", border: "1px solid var(--g-line)", borderRadius: 14 }}>
              <span style={{ color: "var(--g-fg)", fontSize: "1.05rem", fontWeight: 600, flex: "1 1 240px", minWidth: 0 }}>
                Completion is independently accepted or blocked.
              </span>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Signal state="go">Verified</Signal>
                <Signal state="stop">Failed</Signal>
                <Signal state="stop">Blocked</Signal>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 6 ── Where agents run: live vs direction ── */}
      <section className="v6-sec">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Where the work lands"
              title="Vraelis meets agent work where it already happens."
              lead="Oversight reaches an agent through the surfaces its work already flows through. Running deeper and continuously inside the agent itself is the direction, not a claim about today."
            />
          </Reveal>
          <div style={{ ...wrapRow, marginTop: "clamp(28px,3vw,40px)" }}>
            <Reveal style={{ flex: "1 1 320px", minWidth: 0 }}>
              <div className="v6-card" style={{ height: "100%" }}>
                <Signal state="go">Live today</Signal>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
                  {LIVE_SURFACES.map((c) => <Chip key={c}>{c}</Chip>)}
                </div>
              </div>
            </Reveal>
            <Reveal style={{ flex: "1 1 320px", minWidth: 0 }} i={1}>
              <div className="v6-card" style={{ height: "100%" }}>
                <Signal state="wait">Direction</Signal>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
                  {DIRECTION_SURFACES.map((c) => <Chip key={c} soon>{c}</Chip>)}
                </div>
                <p style={{ margin: "18px 0 0", color: "var(--ink-3)", fontSize: 14, lineHeight: 1.55 }}>
                  Continuous, in-agent oversight and reading of live agent activity are being built. We will describe them as live only when they are.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 7 ── Close ── */}
      <hr className="v6-rule" />
      <section className="v6-sec v6-sec--tight">
        <div className="v6-wrap" style={{ textAlign: "center", maxWidth: 760 }}>
          <Reveal>
            <h2 className="v6-dl" style={{ marginInline: "auto" }}>Let agents do more of the work. Keep the judgment independent.</h2>
            <p className="v6-lead" style={{ margin: "20px auto 30px", textAlign: "center" }}>
              Vraelis follows a software agent from assigned responsibility to trusted completion, without ever having to take the agent&rsquo;s word for it.
            </p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <CTA brand lg>Open Vraelis</CTA>
              <CTA href={`${BASE}/platform`} ghost lg>Explore the platform</CTA>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
