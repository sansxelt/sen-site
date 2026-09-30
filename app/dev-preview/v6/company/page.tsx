import type { CSSProperties } from "react";
import Link from "next/link";
import { v6meta } from "../_system/meta";
import { PageHero, Reveal, SectionHead, CTA, EditorialLink, Signal, Prose } from "../_system/ui";
import { LIVE, DIRECTION } from "../_content/scope";
import { V6_BASE } from "@/lib/v6-routes";

export const metadata = v6meta({
  title: "Company",
  description:
    "Vraelis checks whether live software does what someone says it does: one sentence about a deployed web app, or a device it controls, a plan a person approves, and a real browser run with the evidence. Who it is for, how it is different, what is built, and how to reach us.",
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

// WIDE ON WHO, NARROW ON WHAT (founder, 2026-09-28). This used to be a story about agents outrunning their
// reviewers, which made the company sound like it was for one kind of builder. The gap is the same whoever
// built the thing, so the story now names all of them and keeps the function exact.
const WHY: string[] = [
  "For most of software's history, the people who built a system also decided it was ready. That held while the work moved at human speed and someone could always be asked what they had checked.",
  "Now more of it ships faster than anyone reviews it: from small teams, from agencies shipping client sites, from founders on no-code tools, and from AI agents that write a change and then report it done. Speed went up. The check at the end did not.",
  "Vraelis exists to put that check back as a separate step: a claim tried on the live app by something other than whoever made it, with the evidence attached.",
];

type Act = { label: string; sig?: "go" | "wait"; sigLabel?: string; title: string; body: string };
const ACTS: Act[] = [
  {
    label: "Past",
    title: "Builders owned the judgment.",
    body: "People wrote, reviewed, tested, and shipped. Shipping something you had not checked was a deliberate choice, because the work and the judgment about it lived in the same hands.",
  },
  {
    label: "Present",
    sig: "go",
    sigLabel: "Live",
    title: "The work outran the checking.",
    body: "Teams, agencies, founders and AI agents ship faster than anyone checks by hand, and whoever did the work still reports that it is done. Vraelis puts an independent check on the live app, where that judgment used to be.",
  },
  // THE FUTURE ACT IS THE DEVICE LINE, stated to the site's standard. It used to read "Oversight follows the
  // autonomy", a destination for a much larger company. The founder named connected devices as the niche on
  // 2026-09-28: the panel check is live, reading the device itself is Next and not built.
  {
    label: "Next",
    sig: "wait",
    sigLabel: "Next",
    title: "The check follows software onto what it controls.",
    body: "More software now runs hardware: drones, robots and fleets operated from web control panels. Vraelis checks those panels today, through the same real browser. Reading the device itself, its firmware, sensors and telemetry, is next and not built yet.",
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
// REWRITTEN 2026-09-28 FOR A WIDE AUDIENCE. The "fits" rows were companies whose software is written by
// agents; the audience is anyone responsible for a web app, with pipelines, AI assistants and connected
// device teams as ways in rather than the definition.
const FOR: [string, string][] = [
  ["Anyone who ships, or answers for, a web app",
    "Developers, product teams, agencies checking client sites, founders and no-code builders, and QA. If you can say in one sentence what the app should do, Vraelis can check it on the live app."],
  ["Pipelines and AI assistants that need an answer rather than a guess",
    "A CI job can gate a release on the decision, and an AI coding assistant can check its own change over MCP before it says it is done. A person still approves each new plan."],
  ["Teams that run connected devices from a web panel",
    "Drones, robots and fleets operated through a control panel or dashboard. Vraelis checks what the panel reports after an operator action. Reading the device itself is next and not built."],
];
const NOT_FOR: [string, string][] = [
  ["Anyone who wants the builder watched while they work",
    "A check begins when someone says the work is done. Vraelis does not read code or watch a person or an agent while they work."],
  ["Anyone who wants a test suite written for them",
    "Vraelis holds one sentence outside the code and checks the deployed result against it. It does not author or maintain your tests."],
  ["Anyone who needs a native app, or the device itself, checked today",
    "The boundary today is what a real browser can open. Native mobile and desktop apps, and firmware, sensors and telemetry read from a device, are next and not built."],
];

// HOW THIS IS DIFFERENT. Each contrast is against a real category a reader is already paying for, and each
// one states the difference in terms of a mechanism rather than an adjective. Nothing here names a competitor
// or characterises anyone else's product as bad, because a claim about somebody else's software is a claim
// this company cannot show evidence for, and the whole argument here is about evidence.
const DIFFERENT: [string, string][] = [
  ["It is not the builder's own report",
    "Whoever wrote the work, a person or an agent, does not get to be the authority on whether it worked. The check is run by something else, against the deployed result, and the separation is structural: an API key cannot approve the plan."],
  ["It is not a test suite",
    "A suite is written alongside the code, often by the same process, and passes in a pipeline against mocks. Vraelis holds one sentence in plain language outside the code and drives the running deployment against it."],
  ["It is not monitoring",
    "Monitoring reports that something broke once your users have already found it. This is a decision made before that, on the deployment you are about to trust."],
  ["It refuses rather than guesses",
    "When no check could prove the claim, the answer is Blocked and nothing is charged. A verification tool that always returns an answer is a verification tool whose answers cannot be worth much."],
];

const PRINCIPLES: [string, string, string][] = [
  ["01", "We ship what is real.", "Live capabilities and directions are labeled separately, on the site and in the product. We would rather show an honest gap than imply a finished one."],
  ["02", "The judge is independent of the builder.", "Nothing anyone produces is trusted because they say so. Completion is a decision made on evidence by something other than the author."],
  ["03", "History is preserved.", "Failures and fixes are kept, not overwritten. A later Verified never erases the Failed that came before it."],
  // WAS "Autonomy should be earned", written as intent because none of it is built. It described a larger
  // product than the one the public story was locked on (2026-09-28). What replaces it is a commitment the
  // code already keeps: a person approves every new plan, and a key cannot.
  ["04", "A person approves the check.", "Whoever asks for a check, a teammate, a pipeline or an AI assistant, a person approves its plan before it runs, and an API key cannot. After a fix, the same plan may be re-checked within 24 hours without asking again."],
];

export default function CompanyPage() {
  return (
    <>
      <PageHero
        kicker="Company"
        // A verification company for anything people build (founder, 2026-09-29), stated at the size of what is
        // live today: software, and devices through the panel that runs them.
        title="We check that what people build does what they meant."
        lead="Software and connected devices ship faster than anyone can check them by hand, whether a team, an agency, a founder or an AI agent built them. Vraelis is the independent check on the live product: one sentence about what should work, a plan a person approves, and an answer with the evidence."
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
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Three acts"
              title="How the work is changing, and what has to follow it."
              lead="The story of software is a story about where the checking happens. It has moved, and the check has to move with it."
            />
          </Reveal>
          <Reveal media className="v6-grid3">
            {ACTS.map((a) => (
              <div key={a.label} style={{ background: "var(--graphite-2)", border: "1px solid var(--g-line)", borderRadius: 14, padding: "clamp(22px,2.4vw,28px)", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--g-fg-3)" }}>{a.label}</span>
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
              title="Anyone who can say what should work, on a live app."
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
              title="What is built, and what is next."
              lead="The check is real and in use. We label the rest as direction, and every direction line says what happens today instead. Next and Later say how much of a line already stands, not when it lands."
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
                      <span className="v6-mono" style={{ marginLeft: 8, fontSize: 11.5, color: "var(--ink-4)", whiteSpace: "nowrap" }}>{tier}</span>
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
            {/* Three real addresses, not one. help@ used to be the only one on this section, which made
                enterprise/privacy mail arrive at a support inbox instead of the person who owns it. The
                full list and what each is for lives on /contact; this is the short form. */}
            <p style={{ margin: "18px 0 0", fontSize: 14, color: "var(--ink-3)" }}>
              Support: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--brand-ink)", textDecoration: "underline", textUnderlineOffset: 3 }}>{CONTACT_EMAIL}</a>.
              {" "}Enterprise and invoicing: <a href="mailto:sales@vraelis.com" style={{ color: "var(--brand-ink)", textDecoration: "underline", textUnderlineOffset: 3 }}>sales@vraelis.com</a>.
              {" "}Privacy and data rights: <a href="mailto:privacy@vraelis.com" style={{ color: "var(--brand-ink)", textDecoration: "underline", textUnderlineOffset: 3 }}>privacy@vraelis.com</a>.
              {" "}<Link href={`${BASE}/contact`} style={{ color: "var(--ink-4)", textDecoration: "underline", textUnderlineOffset: 3 }}>What each is for →</Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* Close: mission + Open Vraelis.
          The rule above is normally enough to mark a section boundary, but here it sits between two nearly
          identical light surfaces — the Contact section's --sunk (#F4F4F5) and this section's plain white —
          on top of a hairline that's only 10% opacity. The colour step is a few percent of lightness, which
          reads fine at desktop's viewing distance but on a phone, where there's no surrounding chrome to cue
          "new section," the two just run together: the last line of Contact copy looks like it's sitting
          directly against the mission heading with no boundary at all. A visibly darker rule here (scoped to
          this one boundary, not the shared .v6-rule class used elsewhere) gives it the wall it was missing. */}
      <hr className="v6-rule" style={{ background: "var(--line-2)" }} />
      <section className="v6-sec v6-sec--tight">
        <div className="v6-wrap" style={{ textAlign: "center", maxWidth: 760 }}>
          <Reveal>
            <h2 className="v6-dl" style={{ marginInline: "auto" }}>Know it works before you say it does.</h2>
            <p className="v6-lead" style={{ margin: "20px auto 30px", textAlign: "center" }}>One independent check on the live app, with the evidence attached. That is the whole mission.</p>
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
