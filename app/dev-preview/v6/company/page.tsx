import type { CSSProperties } from "react";
import { v6meta } from "../_system/meta";
import { PageHero, Reveal, SectionHead, CTA, EditorialLink, Signal, Prose } from "../_system/ui";

export const metadata = v6meta({
  title: "Company",
  description:
    "Vraelis is independent oversight for AI software agents, from assigned responsibility to trusted completion. Our mission, the three-act story of how software work is changing, what we are building, and how to reach us.",
  path: "/company",
  type: "website",
});

const BASE = "/dev-preview/v6";
const ANCHOR: CSSProperties = { scrollMarginTop: 88 };
// The real mailboxes are sales@, privacy@ and help@. hello@ was invented and does not receive mail, so a
// reader writing to it would have got silence. This section answers product, security and partnership
// questions, which is help@.
const CONTACT_EMAIL = "help@vraelis.com";

const WHY: string[] = [
  "For most of software's history, the same people who wrote a system also reviewed it, tested it, and decided it was ready. That worked because the work moved at human speed, and human judgment was always in the loop.",
  "Agents changed the ratio. They now plan, build, and repair systems faster than the people nominally reviewing them can keep up, and the agent doing the work is still the one reporting that it is done. Speed went up. Independent judgment did not.",
  "Vraelis exists to restore that judgment as a separate function. Not to slow agents down, but to make their completions mean something: a claim that has been checked against the running software by something other than the agent that produced it.",
];

type Act = { label: string; sig?: "go" | "wait"; sigLabel?: string; title: string; body: string };
const ACTS: Act[] = [
  {
    label: "Past",
    title: "Humans owned the judgment.",
    body: "People wrote, reviewed, tested, and shipped. Shipping something you had not checked was a deliberate choice, because the work and the judgment about it lived in the same hands.",
  },
  {
    label: "Present",
    sig: "go",
    sigLabel: "Live",
    title: "Agents outran their reviewers.",
    body: "Agents now plan, build, and repair systems faster than anyone reviewing them, and the builder still grades its own work. Vraelis puts an independent check back where that judgment used to be.",
  },
  {
    label: "Future",
    sig: "wait",
    sigLabel: "Direction",
    title: "Oversight follows the autonomy.",
    body: "As agents take on more responsibility across the stack, independent oversight follows them everywhere, so autonomy is earned against evidence and contracts the moment the record slips.",
  },
];

const LIVE: string[] = [
  "A verification engine that checks running software against a stated requirement.",
  "Real-browser execution with inspectable evidence.",
  "Human review, findings, and a structured repair handoff.",
  "Preserved history of requirements, failures, and decisions.",
  "API, CLI, webhooks, and current integrations.",
];
const NEXT: string[] = [
  "Continuous oversight of live agent activity.",
  "IDE and desktop surfaces where agents run.",
  "Agent reliability memory and earned-autonomy decisions.",
  "Automatic coverage of a responsibility.",
];

const PRINCIPLES: [string, string, string][] = [
  ["01", "We ship what is real.", "Live capabilities and directions are labeled separately, on the site and in the product. We would rather show an honest gap than imply a finished one."],
  ["02", "The judge is independent of the builder.", "Nothing an agent produces is trusted because the agent says so. Completion is a decision made on evidence by something other than the author."],
  ["03", "History is preserved.", "Failures and repairs are kept, not overwritten. The record is the point, because trust compounds from what a system has survived."],
  ["04", "Autonomy is earned.", "Agents get more room to act by accumulating met responsibilities, and lose it when their record slips. Independence follows the work wherever it goes."],
];

export default function CompanyPage() {
  return (
    <>
      <PageHero
        kicker="Company"
        title="Independent oversight for AI software agents."
        lead="Software is increasingly planned, written, and repaired by agents. Vraelis is the independent layer that follows that work from assigned responsibility to trusted completion, so companies can hand agents real responsibility without giving up control."
        cta={<><CTA brand>Open Vraelis</CTA><EditorialLink href="#contact">Talk to us</EditorialLink></>}
      />

      {/* Why we exist */}
      <section className="v6-sec">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead eyebrow="Why we exist" title="The builder can no longer be the only judge." />
          </Reveal>
          <Reveal>
            <Prose className="" >
              {WHY.map((p) => <p key={p}>{p}</p>)}
            </Prose>
          </Reveal>
        </div>
      </section>

      {/* Three acts (graphite) */}
      <section className="v6-sec v6-dark" data-nav-dark>
        <div className="v6-wrap v6-wrap--wide">
          <Reveal>
            <SectionHead
              eyebrow="Three acts"
              title="How the work is changing, and what has to follow it."
              lead="The story of software is a story about where judgment lives. It has moved, and oversight has to move with it."
            />
          </Reveal>
          <Reveal media className="v6-grid3">
            {ACTS.map((a) => (
              <div key={a.label} style={{ background: "var(--graphite-2)", border: "1px solid var(--g-line)", borderRadius: 14, padding: "clamp(22px,2.4vw,28px)", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--g-fg-3)" }}>{a.label}</span>
                  {a.sig ? <Signal state={a.sig}>{a.sigLabel}</Signal> : null}
                </div>
                <h3 style={{ margin: "0 0 10px", fontSize: "clamp(1.1rem,1.5vw,1.32rem)", fontWeight: 600, letterSpacing: "-0.015em", color: "var(--g-fg)" }}>{a.title}</h3>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--g-fg-2)" }}>{a.body}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Product direction */}
      <section className="v6-sec v6-sec--sunk">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Product direction"
              title="One capability today, one system over time."
              lead="Vraelis starts from a working verification engine and expands outward into full oversight. We ship what is real and label the rest as direction."
            />
          </Reveal>
          <div className="v6-cn" style={{ marginTop: "clamp(28px,3vw,40px)" }}>
            <Reveal className="v6-cn__col">
              <p className="v6-cn__h"><Signal state="go">Live today</Signal></p>
              <ul>{LIVE.map((t) => <li key={t}>{t}</li>)}</ul>
            </Reveal>
            <Reveal className="v6-cn__col v6-cn__col--next" i={1}>
              <p className="v6-cn__h"><Signal state="wait">Direction</Signal></p>
              <ul>{NEXT.map((t) => <li key={t}>{t}</li>)}</ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* How we build */}
      <section className="v6-sec">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead eyebrow="How we build" title="The commitments the product is held to." />
          </Reveal>
          <div className="v6-rows">
            {PRINCIPLES.map(([n, t, d], i) => (
              <Reveal key={t} i={i}>
                <div className="v6-row">
                  <span className="v6-row__n">{n}</span>
                  <div>
                    <h3 className="v6-row__t">{t}</h3>
                    <p className="v6-row__d">{d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="v6-sec v6-sec--sunk" id="contact" style={ANCHOR}>
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Contact"
              title="Talk to the team."
              lead="Questions about the product, security, or working together are read by the people building Vraelis."
            />
            <div style={{ marginTop: "clamp(24px,2.6vw,32px)", display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
              <CTA href={`mailto:${CONTACT_EMAIL}`}>Email the team</CTA>
              <EditorialLink href={`${BASE}/security`}>Read the security overview</EditorialLink>
            </div>
            <p style={{ margin: "18px 0 0", fontSize: 14, color: "var(--ink-3)" }}>
              Or write to <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--brand-ink)", textDecoration: "underline", textUnderlineOffset: 3 }}>{CONTACT_EMAIL}</a>.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Close: mission + Open Vraelis */}
      <hr className="v6-rule" />
      <section className="v6-sec v6-sec--tight">
        <div className="v6-wrap" style={{ textAlign: "center", maxWidth: 760 }}>
          <Reveal>
            <h2 className="v6-dl" style={{ marginInline: "auto" }}>Give agents more responsibility without giving up control.</h2>
            <p className="v6-lead" style={{ margin: "20px auto 30px", textAlign: "center" }}>Independent oversight, from the moment work is assigned to the moment it can be trusted. That is the whole mission.</p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <CTA brand lg>Open Vraelis</CTA>
              <CTA href={`${BASE}/research`} ghost lg>Read our research</CTA>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
