import type { CSSProperties } from "react";
import Link from "next/link";
import { v6meta } from "../_system/meta";
import { PageHero, Reveal, SectionHead, CTA, EditorialLink, Signal, Prose } from "../_system/ui";
import { LIVE, DIRECTION } from "../_content/scope";
import { V6_BASE } from "@/lib/v6-routes";

export const metadata = v6meta({
  title: "Company",
  description:
    "Vraelis is independent oversight for AI software agents, from assigned responsibility to trusted completion. Our mission, the three-act story of how software work is changing, what we are building, and how to reach us.",
  path: "/company",
  type: "website",
});

const BASE = V6_BASE;
// EMPTY, AND KEPT RATHER THAN DELETED SO THE REASON TRAVELS WITH THE CALL SITE.
//
// This was `{ scrollMarginTop: 88 }`. The document already reserves the bar's height on the scrollport, as
// html { scroll-padding-top: var(--nav-h) } in app/globals.css, and scroll-padding and scroll-margin ADD
// rather than override: the browser aligns the target's scroll-margin box inside the scrollport's
// scroll-padding box. So 88 here did not set the offset, it doubled it. Measured on /company#contact before
// this: the section landed 166px below the top of the window under a 67px bar, i.e. 99px of the section
// ABOVE it sitting under the bar, which is also what the bar then sampled and painted itself.
// One offset, on the scrollport, derived from the measured bar. Nothing per element.
const ANCHOR: CSSProperties = {};
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

// THE TWO COLUMNS BELOW ARE NO LONGER AUTHORED HERE. They were a second copy of the lists on
// /platform#current, and they had drifted: this page's live column had lost the refusal to charge for an
// unprovable claim, and its direction column was still four bare noun phrases with nothing saying what
// happens today instead, which is the shape /platform had already repaired. One of those noun phrases,
// "Automatic coverage of a responsibility", appeared nowhere else in the product or the repository and no
// checkable present tense could be written under it, so it is gone rather than restated. Both lists now come
// from _content/scope.ts, where the reasoning sits above the data.

// WHO THIS IS FOR. The site never said, anywhere, and a reader who does not recognise themselves on a
// homepage leaves without a way to check whether they were the intended audience.
//
// Written as a description of the SHAPE of the problem rather than as a claim about who is already a
// customer, because the second thing would be an invented number. The "not for" half is deliberate: an
// audience section that excludes nobody has not said anything, and two of the three exclusions below are
// the honest edges of the product rather than a positioning move.
const FOR: [string, string][] = [
  ["Companies whose production software is now partly written by agents",
    "The work arrives faster than anyone can review it by hand, and the thing that wrote it is also the thing reporting it is done."],
  ["Where at least one outcome is not allowed to quietly break",
    "The upgrade that has to grant access, the deactivation that has to remove it everywhere, the export that has to contain one tenant's records and no one else's."],
  ["And where someone is accountable when it does",
    "A person who would have to answer for the failure, and who currently has the agent's own word that it will not happen."],
];
const NOT_FOR: [string, string][] = [
  ["Anyone who wants the agent watched while it works",
    "A check begins when work is claimed complete. Reading an agent's activity as it happens is direction, and is not built."],
  ["Anyone who wants a test suite written for them",
    "Vraelis holds one business sentence outside the code and checks the deployed result against it. It does not author or maintain your tests."],
  ["Anyone who needs a native mobile or desktop application covered",
    "The boundary today is what a real browser and an HTTP client can observe from outside."],
];

// HOW THIS IS DIFFERENT. Each contrast is against a real category a reader is already paying for, and each
// one states the difference in terms of a mechanism rather than an adjective. Nothing here names a competitor
// or characterises anyone else's product as bad, because a claim about somebody else's software is a claim
// this company cannot show evidence for, and the whole argument here is about evidence.
const DIFFERENT: [string, string][] = [
  ["It is not the agent's own report",
    "The system that wrote the work does not get to be the authority on whether it worked. The check is run by something else, against the deployed result, and the separation is structural rather than a matter of prompting."],
  ["It is not a test suite",
    "A suite is written alongside the code, often by the same process, and passes in a pipeline against mocks. Vraelis holds one sentence in business language outside the code and drives the running deployment against it."],
  ["It is not monitoring",
    "Monitoring reports that something broke once your users have already found it. This is a decision made before that, on the deployment you are about to trust."],
  ["It refuses rather than guesses",
    "When no check could prove the claim, the answer is Blocked and nothing is charged. A verification tool that always returns an answer is a verification tool whose answers cannot be worth much."],
];

const PRINCIPLES: [string, string, string][] = [
  ["01", "We ship what is real.", "Live capabilities and directions are labeled separately, on the site and in the product. We would rather show an honest gap than imply a finished one."],
  ["02", "The judge is independent of the builder.", "Nothing an agent produces is trusted because the agent says so. Completion is a decision made on evidence by something other than the author."],
  ["03", "History is preserved.", "Failures and repairs are kept, not overwritten. The record is the point, because trust compounds from what a system has survived."],
  // WRITTEN AS INTENT, BECAUSE NONE OF IT IS BUILT. This was in the flat present tense, in a list headed
  // "the commitments the product is held to", two sections above the same page's own Direction column
  // rendering "Reliability memory, and autonomy earned from a record. Not built." A reader met the
  // capability as a current fact and then, further down, as a Horizon item. Nothing in the repository
  // measures an agent's record: every hit for autonomy outside this copy is a research article.
  // The second sentence had the same problem about reach. Independence today is a real browser and an HTTP
  // client, which is what /platform#coverage says, and this page's own "not for" row repeats.
  ["04", "Autonomy should be earned.", "How much an agent may do alone should be a conclusion drawn from responsibilities it has actually met, not a setting somebody chooses, and independent oversight should follow the work onto whatever it runs on. Neither is built: nothing in the product measures that record today, and the reach today is a real browser and an HTTP client."],
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

      {/* Who it is for ── the site never answered this anywhere. Both halves render, because the exclusions
          are the honest edges of the product and reading only the first half would overstate it. */}
      <section className="v6-sec" id="who">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Who it is for"
              title="One outcome that cannot be allowed to break, and an agent that keeps touching it."
            />
          </Reveal>
          <div className="v6-rows" style={{ marginTop: "clamp(24px,2.6vw,34px)" }}>
            {FOR.map(([t, d], i) => (
              <Reveal key={t} i={i}>
                <div className="v6-row">
                  <span className="v6-row__n"><Signal state="go">Fits</Signal></span>
                  <div>
                    <h3 className="v6-dm" style={{ margin: 0 }}>{t}</h3>
                    <p className="v6-body" style={{ marginTop: 8, maxWidth: "68ch" }}>{d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
            {NOT_FOR.map(([t, d], i) => (
              <Reveal key={t} i={i}>
                <div className="v6-row">
                  <span className="v6-row__n"><Signal state="wait">Not yet</Signal></span>
                  <div>
                    <h3 className="v6-dm" style={{ margin: 0 }}>{t}</h3>
                    <p className="v6-body" style={{ marginTop: 8, maxWidth: "68ch" }}>{d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How this is different ── against categories, never against a named company. */}
      <section className="v6-sec v6-sec--sunk" id="different">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="How this is different"
              title="Four things it is not, and what it does instead."
              lead="Stated against the categories a reader is already paying for. No competitor is named and none is characterised, because a claim about somebody else's software is a claim this company cannot show evidence for."
            />
          </Reveal>
          <div className="v6-rows" style={{ marginTop: "clamp(24px,2.6vw,34px)" }}>
            {DIFFERENT.map(([t, d], i) => (
              <Reveal key={t} i={i}>
                <div className="v6-row">
                  <span className="v6-row__n">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="v6-dm" style={{ margin: 0 }}>{t}</h3>
                    <p className="v6-body" style={{ marginTop: 8, maxWidth: "68ch" }}>{d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p className="v6-body" style={{ marginTop: "clamp(22px,2.4vw,32px)", maxWidth: "72ch" }}>
              Three times this was tested by somebody else, with sources and with the cases where an
              independent check would have done nothing:{" "}
              <Link href={`${BASE}/method#in-public`} className="v6-plink">what happened in public</Link>.
            </p>
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
              lead="Vraelis starts from a working verification engine and expands outward into full oversight. We ship what is real and label the rest as direction, and every direction line says what happens today instead. Next, Later and Horizon say how much of a line already stands, not when it lands."
            />
          </Reveal>
          <div className="v6-cn" style={{ marginTop: "clamp(28px,3vw,40px)" }}>
            <Reveal className="v6-cn__col">
              <p className="v6-cn__h"><Signal state="go">Live today</Signal></p>
              <ul>{LIVE.map((t) => <li key={t}>{t}</li>)}</ul>
            </Reveal>
            <Reveal className="v6-cn__col v6-cn__col--next" i={1}>
              <p className="v6-cn__h"><Signal state="wait">Direction</Signal></p>
              {/* Two lines per item, matching /platform#current: the destination, then the sentence a reader
                  can check. The list rule puts the dot on the li, so the pair goes in one child span. */}
              <ul style={{ gap: 16 }}>{DIRECTION.map(([t, now, tier]) => (
                <li key={t}>
                  <span>
                    <span style={{ display: "block" }}>
                      {t}
                      <span className="v6-mono" style={{ marginLeft: 8, fontSize: 10.5, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--ink-4)", whiteSpace: "nowrap" }}>{tier}</span>
                    </span>
                    <span style={{ display: "block", marginTop: 4, fontSize: 13.5, lineHeight: 1.55, color: "var(--ink-4)" }}>{now}</span>
                  </span>
                </li>
              ))}</ul>
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
