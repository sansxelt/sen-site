import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { v6meta } from "../_system/meta";
import { PageHero, Reveal, SectionHead, CTA, EditorialLink, Signal, Kicker } from "../_system/ui";
import { V6_BASE } from "@/lib/v6-routes";

// Platform overview (design 06). Framing: Vraelis is oversight for AI software agents, from assigned
// responsibility to trusted completion. The verification engine (real browser, requirement held outside the
// code, preserved history, repair + reverify) is ONE current capability, shown deeper, never as the whole
// company. The signature is a single durable responsibility record that accumulates context, plan, activity,
// findings, decisions, repairs, evidence, completion, and history. LIGHT = framing; GRAPHITE = live work.

export const metadata: Metadata = v6meta({
  title: "Platform",
  description:
    "One system that follows every responsibility you hand an AI software agent: the durable record, live activity, human review, findings, repair, verified completion, and memory.",
  path: "/platform",
  ogTitle: "The Vraelis platform",
  ogDescription:
    "Responsibility, live activity, review, findings, repair, verified completion, and memory, on one durable record per piece of agent work.",
});

const BASE = V6_BASE;
type Sig = "go" | "wait" | "stop";
const DOT: Record<string, string> = {
  go: "var(--go-dk)",
  wait: "var(--wait-dk)",
  stop: "var(--stop-dk)",
  none: "var(--g-fg-3)",
};

const wrapRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "clamp(20px,2.8vw,44px)",
  alignItems: "stretch",
};

/* ---------- small building blocks (server, no state) ---------- */

function GPanel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  // Graphite panel usable inside a LIGHT section. v6-dark makes signal + heading colors resolve correctly;
  // the inline background overrides v6-dark's default so the panel reads as a raised surface.
  return (
    <div
      className="v6-dark"
      data-nav-dark
      style={{
        background: "var(--graphite-2)",
        border: "1px solid var(--g-line)",
        borderRadius: 16,
        padding: "clamp(20px,2.4vw,30px)",
        boxShadow: "var(--sh-lg)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function GBar({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        paddingBottom: 16,
        marginBottom: 18,
        borderBottom: "1px solid var(--g-line)",
      }}
    >
      {left}
      {right}
    </div>
  );
}

/* ============================ the signature: one durable record ============================ */

const RECORD_FACTS: [string, string][] = [
  ["Systems affected", "Stripe / billing / dashboard"],
  ["Reviewed standard", "Existing customers are never overcharged"],
  ["Evidence", "Real browser run, API trace, screenshots"],
  ["History", "Every state preserved, nothing overwritten"],
];

const RECORD_STATES: { t: string; d: string; sig?: Sig; tag?: string }[] = [
  { t: "Context captured", d: "The business requirement and its scope are recorded before any work is judged.", sig: "go", tag: "Recorded" },
  { t: "Standard reviewed", d: "A person approves what must remain true. It is held outside the code, where the agent cannot move it." },
  { t: "Plan observed", d: "6 steps, touching Stripe and the billing service, mapped to the systems they affect." },
  { t: "Activity tracked", d: "7 files changed. One Stripe price and one usage meter created through the API." },
  { t: "Assumption challenged", d: "“Existing customers keep their current price” is contested until it is proven.", sig: "wait", tag: "Needs proof" },
  { t: "Finding raised", d: "The usage meter is not enforced on the free plan. Recorded against the requirement.", sig: "stop", tag: "Finding" },
  { t: "Decision required", d: "The new pricing cannot ship until a person approves the change.", sig: "wait", tag: "Review" },
  { t: "Repair re-checked", d: "The fix is re-run against the same standard in a real browser, as its own record." },
  { t: "Completion accepted", d: "The requirement now holds, checked independently. Earlier records stay intact.", sig: "go", tag: "Verified" },
];

function RecordObject() {
  return (
    <GPanel>
      <GBar
        left={
          <span className="v6-kicker" style={{ color: "var(--g-fg-3)" }}>
            Responsibility record / GR-4471
          </span>
        }
        right={<Signal state="go">Verified</Signal>}
      />
      <p style={{ margin: 0, color: "var(--g-fg)", fontSize: "clamp(1.15rem,1.7vw,1.4rem)", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.25 }}>
        Add usage-based billing to the customer dashboard.
      </p>
      <p style={{ margin: "8px 0 0", color: "var(--g-fg-2)", fontSize: 14.5, lineHeight: 1.5 }}>
        Everything Vraelis learns about this work accumulates here, in one place, in order.
      </p>

      {/* accumulated context */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "20px 0 6px" }}>
        {RECORD_FACTS.map(([k, v]) => (
          <div
            key={k}
            style={{
              flex: "1 1 220px",
              minWidth: 0,
              background: "var(--graphite-3)",
              border: "1px solid var(--g-line)",
              borderRadius: 11,
              padding: "12px 14px",
            }}
          >
            <div className="v6-mono" style={{ fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--g-fg-3)" }}>{k}</div>
            <div style={{ marginTop: 5, color: "var(--g-fg)", fontSize: 13.5, lineHeight: 1.4 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* the life of the record */}
      <ol style={{ listStyle: "none", margin: "22px 0 0", padding: "4px 0 0", position: "relative" }}>
        <span aria-hidden style={{ position: "absolute", left: 6, top: 14, bottom: 18, width: 1, background: "var(--g-line)" }} />
        {RECORD_STATES.map((s) => (
          <li key={s.t} style={{ display: "grid", gridTemplateColumns: "16px minmax(0,1fr)", gap: 14, padding: "11px 0", alignItems: "start" }}>
            <span
              aria-hidden
              style={{
                marginTop: 4,
                width: 13,
                height: 13,
                borderRadius: 999,
                background: "var(--graphite-2)",
                border: `2px solid ${DOT[s.sig ?? "none"]}`,
                boxShadow: "0 0 0 3px var(--graphite-2)",
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <span style={{ color: "var(--g-fg)", fontWeight: 600, fontSize: 15 }}>{s.t}</span>
                {s.sig ? <Signal state={s.sig}>{s.tag}</Signal> : null}
              </div>
              <p style={{ margin: "4px 0 0", color: "var(--g-fg-2)", fontSize: 14, lineHeight: 1.5 }}>{s.d}</p>
            </div>
          </li>
        ))}
      </ol>
    </GPanel>
  );
}

/* ============================ section-scoped data ============================ */

const WORK: { t: string; sys: string; state: Sig; label: string }[] = [
  { t: "Add usage-based billing to the dashboard", sys: "Stripe / billing", state: "wait", label: "In review" },
  { t: "Migrate the auth service to sessions", sys: "auth / api", state: "go", label: "Verified" },
  { t: "Bulk-export customer data on request", sys: "api / storage", state: "stop", label: "Blocked" },
  { t: "Ship the new onboarding flow", sys: "web / analytics", state: "go", label: "Verified" },
];

const ACTIVITY: { t: string; d: string; sig?: Sig; tag?: string; time: string }[] = [
  { time: "09:14", t: "Plan submitted", d: "6 steps, touching Stripe and the billing service" },
  { time: "09:15", t: "Systems mapped", d: "Stripe, billing, dashboard flagged as affected" },
  { time: "09:22", t: "7 files changed", d: "billing/, dashboard/, api/usage" },
  { time: "09:23", t: "Stripe API called", d: "created 1 price, 1 usage meter" },
  { time: "09:24", t: "Assumption flagged", d: "existing customers keep their current price", sig: "wait", tag: "Needs proof" },
  { time: "09:31", t: "Finding recorded", d: "usage meter is not enforced on the free plan", sig: "stop", tag: "Finding" },
];

const FINDINGS: { claim: string; reality: string; sig: Sig; tag: string }[] = [
  { claim: "“Usage billing is complete.”", reality: "The usage meter is not enforced on the free plan.", sig: "stop", tag: "Contradiction" },
  { claim: "“Existing customers keep their price.”", reality: "No evidence was produced. The assumption is unproven.", sig: "wait", tag: "Missing evidence" },
  { claim: "“Checkout works end to end.”", reality: "Access was not granted after a successful payment.", sig: "stop", tag: "Failed check" },
];

const REVIEW: { t: string; who: string }[] = [
  { t: "Approve the new pricing before it ships to existing customers", who: "Billing owner" },
  { t: "Confirm the data export is allowed for this account", who: "Security" },
  { t: "Accept the irreversible migration on the auth service", who: "Engineering lead" },
];

const MEMORY = [
  "Company requirements",
  "Architecture boundaries",
  "Recurring failures",
  "Approved decisions",
  "Repair history",
  "Agent behavior",
  "Trusted completion standards",
];

const KNOWLEDGE: [string, string, string][] = [
  ["Documentation", "Use and administer Vraelis", `${BASE}/docs`],
  ["Vraelis Method", "The worldview behind the product", `${BASE}/method`],
  ["README", "Why Vraelis exists", `${BASE}/readme`],
  ["Changelog", "What shipped, dated", `${BASE}/changelog`],
  ["Research", "The methodology and open questions", `${BASE}/research`],
];

const LIVE = [
  "A responsibility record with a reviewed standard held outside the code",
  "Execution of the running software in a real browser, with evidence",
  "Human review, findings, and a structured repair handoff",
  "Verified / Failed / Blocked decisions, with history preserved",
  "API, CLI, webhooks, GitHub, Vercel, and Slack",
];
const DIRECTION = [
  "Continuous ingestion of live agent activity as it happens",
  "IDE and desktop surfaces alongside the agent",
  "Agent reliability memory and earned-autonomy decisions",
  "Automatic responsibility coverage across a whole system",
];

function Led({ items, tone }: { items: string[]; tone: Sig }) {
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

export default function Platform() {
  return (
    <>
      <PageHero
        kicker="The platform"
        title="One system that follows every responsibility you hand an agent."
        lead="Vraelis stays with a piece of agent work from the moment it is assigned to the moment it can be trusted: the durable record, live activity, human review, findings, repair, verified completion, and everything the company learns along the way."
        cta={
          <>
            <CTA brand lg>Open Vraelis</CTA>
            <EditorialLink href={`${BASE}/agents`}>See how it works around agents</EditorialLink>
          </>
        }
      />

      {/* 1 ── Signature: the durable record everything happens on ── */}
      <section className="v6-sec" style={{ paddingTop: "clamp(12px,2vw,28px)" }}>
        <div className="v6-wrap v6-wrap--wide">
          <Reveal>
            <SectionHead
              eyebrow="One record per responsibility"
              title="Everything Vraelis knows lives on one object."
              lead="Not eight disconnected tools. A single durable record per piece of agent work accumulates the context, the plan, the activity, the findings, the decisions, the repairs, the evidence, the completion, and the full history."
            />
          </Reveal>
          <Reveal media style={{ marginTop: "clamp(28px,3.4vw,44px)" }}>
            <RecordObject />
          </Reveal>
        </div>
      </section>

      {/* 2 ── Responsibility ── */}
      <section className="v6-sec v6-sec--sunk">
        <div className="v6-wrap">
          <div style={wrapRow}>
            <Reveal style={{ flex: "1 1 340px", minWidth: 0 }}>
              <SectionHead
                eyebrow="Responsibility"
                title="Start from the outcome, not the code."
                lead="A company does not care which files changed. It cares whether something it depends on still holds. Every record begins with a plainly stated responsibility and the standard it must meet, approved by a person and kept outside the agent."
              />
            </Reveal>
            <Reveal style={{ flex: "1 1 320px", minWidth: 0 }} i={1}>
              <div className="v6-card">
                <Kicker>What must remain true</Kicker>
                <p style={{ margin: "12px 0 0", color: "var(--ink)", fontSize: "1.15rem", fontWeight: 600, lineHeight: 1.35, letterSpacing: "-0.015em" }}>
                  Existing customers are never overcharged when usage billing ships.
                </p>
                <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)", display: "grid", gap: 10 }}>
                  {[["Requirement", "Stated as an outcome"], ["Approval", "Reviewed by a person"], ["Location", "Held outside the code"]].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14 }}>
                      <span className="v6-mono" style={{ color: "var(--ink-4)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase" }}>{k}</span>
                      <span style={{ color: "var(--ink-2)", textAlign: "right" }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 3 ── Work ── */}
      <section className="v6-sec">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Work"
              title="Every responsibility, and where each one stands."
              lead="The work surface is the portfolio view: what agents are responsible for right now, and the current state of each, in one decision vocabulary."
            />
          </Reveal>
          <Reveal media style={{ marginTop: "clamp(28px,3vw,40px)" }}>
            <div className="v6-card" style={{ padding: 0, overflow: "hidden" }}>
              {WORK.map((w, i) => (
                <div
                  key={w.t}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 14,
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "clamp(16px,2vw,22px) clamp(18px,2.2vw,26px)",
                    borderTop: i === 0 ? "none" : "1px solid var(--line)",
                  }}
                >
                  <div style={{ minWidth: 0, flex: "1 1 260px" }}>
                    <div style={{ color: "var(--ink)", fontWeight: 600, fontSize: "1.02rem", letterSpacing: "-0.01em" }}>{w.t}</div>
                    <div className="v6-mono" style={{ marginTop: 4, color: "var(--ink-4)", fontSize: 12, letterSpacing: "0.05em" }}>{w.sys}</div>
                  </div>
                  <Signal state={w.state}>{w.label}</Signal>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* 4 ── Live activity (GRAPHITE) ── */}
      <section className="v6-sec v6-dark" data-nav-dark>
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Live activity"
              title="The work as it happens, from the outside."
              lead="Vraelis follows the activity it can actually observe: submitted plans, code changes, tool and API effects, external events, and the claims the agent makes. It reads what the work does, not what the agent privately thinks."
            />
          </Reveal>
          <Reveal media style={{ marginTop: "clamp(28px,3vw,40px)" }}>
            <div style={{ background: "var(--graphite-2)", border: "1px solid var(--g-line)", borderRadius: 16, padding: "clamp(18px,2.2vw,26px)" }}>
              <GBar
                left={<span className="v6-kicker" style={{ color: "var(--go-dk)" }}>&#9679; Live feed</span>}
                right={<span className="v6-mono" style={{ color: "var(--g-fg-3)", fontSize: 12 }}>GR-4471</span>}
              />
              <div style={{ display: "flex", flexDirection: "column" }}>
                {ACTIVITY.map((a, i) => (
                  <div
                    key={a.t}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto minmax(0,1fr)",
                      gap: "clamp(12px,2vw,20px)",
                      padding: "13px 0",
                      borderTop: i === 0 ? "none" : "1px solid var(--g-line)",
                      alignItems: "baseline",
                    }}
                  >
                    <span className="v6-mono" style={{ color: "var(--g-fg-3)", fontSize: 12.5 }}>{a.time}</span>
                    <div style={{ minWidth: 0, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "baseline" }}>
                      <span style={{ color: "var(--g-fg)", fontWeight: 600, fontSize: 14.5 }}>{a.t}</span>
                      <span style={{ color: "var(--g-fg-2)", fontSize: 14 }}>{a.d}</span>
                      {a.sig ? <span style={{ marginLeft: "auto" }}><Signal state={a.sig}>{a.tag}</Signal></span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal style={{ marginTop: 22 }}>
            <p style={{ display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap", color: "var(--g-fg-2)", fontSize: 14.5 }}>
              <Signal state="wait">Direction</Signal>
              Continuous, deeper ingestion of live agent activity is where Vraelis is heading, not what it claims today.
            </p>
          </Reveal>
        </div>
      </section>

      {/* 5 ── Review ── */}
      <section className="v6-sec v6-sec--sunk">
        <div className="v6-wrap">
          <div style={wrapRow}>
            <Reveal style={{ flex: "1 1 320px", minWidth: 0 }}>
              <SectionHead
                eyebrow="Review"
                title="Human judgment at the boundary."
                lead="Most oversight can be mechanical. Some of it cannot. Sensitive and irreversible decisions are raised to a person, deliberately and rarely, instead of being absorbed silently by automation."
              />
            </Reveal>
            <Reveal style={{ flex: "1 1 360px", minWidth: 0 }} i={1}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {REVIEW.map((r) => (
                  <div key={r.t} className="v6-card" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", padding: "clamp(16px,1.8vw,20px)" }}>
                    <div style={{ minWidth: 0, flex: "1 1 240px" }}>
                      <div style={{ color: "var(--ink)", fontWeight: 600, fontSize: 15.5, lineHeight: 1.35 }}>{r.t}</div>
                      <div className="v6-mono" style={{ marginTop: 5, color: "var(--ink-4)", fontSize: 12, letterSpacing: "0.05em", textTransform: "uppercase" }}>Decides: {r.who}</div>
                    </div>
                    <Signal state="wait">Awaiting decision</Signal>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 6 ── Findings (GRAPHITE) ── */}
      <section className="v6-sec v6-dark" data-nav-dark>
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Findings"
              title="Where a claim and the evidence disagree."
              lead="A finding is what remains when an agent's confidence meets what the software actually does. Contradictions, missing evidence, and unsafe assumptions are recorded against the responsibility, not buried in a log."
            />
          </Reveal>
          <div style={{ marginTop: "clamp(28px,3vw,40px)", display: "flex", flexDirection: "column", gap: 14 }}>
            {FINDINGS.map((f, i) => (
              <Reveal key={f.claim} i={i}>
                <div style={{ background: "var(--graphite-2)", border: "1px solid var(--g-line)", borderRadius: 14, padding: "clamp(18px,2vw,24px)" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--g-fg-2)", fontSize: 15.5, fontStyle: "italic" }}>{f.claim}</span>
                    <Signal state={f.sig}>{f.tag}</Signal>
                  </div>
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--g-line)", display: "flex", gap: 11, alignItems: "flex-start" }}>
                    <span aria-hidden style={{ marginTop: 6, width: 7, height: 7, borderRadius: 999, background: DOT[f.sig], flex: "none" }} />
                    <span style={{ color: "var(--g-fg)", fontSize: 15, lineHeight: 1.5 }}>{f.reality}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 7 ── Repair (real engine, deeper) ── */}
      <section className="v6-sec v6-sec--sunk">
        <div className="v6-wrap">
          <div style={wrapRow}>
            <Reveal style={{ flex: "1 1 340px", minWidth: 0 }}>
              <SectionHead
                eyebrow="Repair, live today"
                title="A fix is finished when the requirement holds, checked independently."
                lead="This is the verification engine, one part of oversight. It holds the requirement outside the code and proves the running software against it in a real browser. A repair is not done because the agent changed something. It is done when the standard passes, as its own record, without overwriting the earlier ones."
              />
              <div style={{ marginTop: 24 }}>
                <EditorialLink href={`${BASE}/agents`}>How Vraelis challenges an agent&rsquo;s claim</EditorialLink>
              </div>
            </Reveal>
            <Reveal media style={{ flex: "1 1 340px", minWidth: 0 }} i={1}>
              <GPanel style={{ boxShadow: "var(--sh-md)" }}>
                <GBar left={<span className="v6-kicker" style={{ color: "var(--g-fg-3)" }}>Requirement, held outside the code</span>} />
                <p style={{ margin: 0, color: "var(--g-fg)", fontSize: "1.1rem", fontWeight: 600, lineHeight: 1.35 }}>
                  A paid customer keeps Pro access after signing back in.
                </p>
                <div style={{ marginTop: 18, display: "flex", flexDirection: "column" }}>
                  {[
                    ["The agent claimed", "checkout complete", "none"],
                    ["Payment", "succeeded", "none"],
                    ["Access", "not granted", "stop"],
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
              </GPanel>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 8 ── Completion (GRAPHITE) ── */}
      <section className="v6-sec v6-dark" data-nav-dark>
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Completion"
              title="Completion is a decision, not a claim."
              lead="When an agent says it is done, Vraelis returns one of three states. The agent that produced the work does not get to certify it."
            />
          </Reveal>
          <div className="v6-grid3" style={{ marginTop: "clamp(28px,3vw,40px)" }}>
            {[
              { s: "go" as Sig, t: "Verified", d: "The responsibility holds, checked independently against the reviewed standard." },
              { s: "stop" as Sig, t: "Failed", d: "The software does not meet the requirement. The gap is recorded as evidence." },
              { s: "stop" as Sig, t: "Blocked", d: "A sensitive or irreversible action stops the work until a person decides." },
            ].map((c, i) => (
              <Reveal key={c.t} i={i}>
                <div style={{ background: "var(--graphite-2)", border: "1px solid var(--g-line)", borderRadius: 14, padding: "clamp(20px,2.2vw,26px)", height: "100%" }}>
                  <Signal state={c.s}>{c.t}</Signal>
                  <p style={{ margin: "14px 0 0", color: "var(--g-fg-2)", fontSize: 15, lineHeight: 1.55 }}>{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 9 ── Memory ── */}
      <section className="v6-sec">
        <div className="v6-wrap">
          <div style={wrapRow}>
            <Reveal style={{ flex: "1 1 320px", minWidth: 0 }}>
              <SectionHead
                eyebrow="Memory"
                title="Every task teaches Vraelis how your software and agents fail."
                lead="Oversight compounds. What Vraelis learns on one responsibility makes the next one faster to judge and harder to fool. The value is the accumulated, company-specific understanding, not any single verdict."
              />
            </Reveal>
            <Reveal media style={{ flex: "1 1 320px", minWidth: 0 }} i={1}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {MEMORY.map((m, i) => (
                  <div key={m} style={{ display: "flex", gap: 16, alignItems: "center", padding: "14px 2px", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
                    <span className="v6-mono" style={{ color: "var(--brand-ink)", fontSize: 12.5 }}>{String(i + 1).padStart(2, "0")}</span>
                    <span style={{ color: "var(--ink)", fontSize: "1.05rem", fontWeight: 500, letterSpacing: "-0.01em" }}>{m}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 10 ── Knowledge ── */}
      <section className="v6-sec v6-sec--sunk">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Knowledge"
              title="A real body of work behind the product."
              lead="Not footer links. Authored surfaces that explain how Vraelis thinks, how it works, and what it has shipped."
            />
          </Reveal>
          <div className="v6-grid3">
            {KNOWLEDGE.map(([t, d, href], i) => (
              <Reveal key={t} i={i % 3}>
                <Link href={href} className="v6-gcard" style={{ display: "block", textDecoration: "none", height: "100%" }}>
                  <h3>{t}</h3>
                  <p>{d}</p>
                  <span className="v6-elink" style={{ marginTop: 14, color: "var(--ink)" }}><span className="v6-elink__t">Open</span><span className="v6-arw" aria-hidden>&rarr;</span></span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 11 ── Current vs Direction ── */}
      <section className="v6-sec" id="current">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Honest about what is live"
              title="What Vraelis does today, and where it is going."
              lead="The verification engine is real and in use. The wider, continuous oversight around agents is being built in the open. We keep the two clearly separated."
            />
          </Reveal>
          <div style={{ ...wrapRow, marginTop: "clamp(28px,3vw,40px)" }}>
            <Reveal style={{ flex: "1 1 320px", minWidth: 0 }}>
              <div className="v6-card" style={{ height: "100%" }}>
                <Signal state="go">Live today</Signal>
                <Led items={LIVE} tone="go" />
              </div>
            </Reveal>
            <Reveal style={{ flex: "1 1 320px", minWidth: 0 }} i={1}>
              <div className="v6-card" style={{ height: "100%" }}>
                <Signal state="wait">Direction</Signal>
                <Led items={DIRECTION} tone="wait" />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 12 ── Close ── */}
      <hr className="v6-rule" />
      <section className="v6-sec v6-sec--tight">
        <div className="v6-wrap" style={{ textAlign: "center", maxWidth: 760 }}>
          <Reveal>
            <h2 className="v6-dl" style={{ marginInline: "auto" }}>Give agents more responsibility without giving up control.</h2>
            <p className="v6-lead" style={{ margin: "20px auto 30px", textAlign: "center" }}>
              One durable record follows the work from the moment it is assigned to the moment it can be trusted.
            </p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <CTA brand lg>Open Vraelis</CTA>
              <CTA href={`${BASE}/agents`} ghost lg>See how it works around agents</CTA>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
