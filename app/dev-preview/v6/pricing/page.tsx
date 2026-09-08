import { v6meta } from "../_system/meta";
import { PageHero, Reveal, SectionHead, CTA, EditorialLink, ProseLink } from "../_system/ui";
import { V6_BASE } from "@/lib/v6-routes";
import {
  PLAN_CATALOG_V1, FREE_TIER, PASS_INCLUDED_FLOWS, EXTRA_FLOW_CENTS, passPriceCents,
} from "@/lib/preflight/pass-pricing";
import { planHeadline, planCapacity } from "@/lib/preflight/pass-pricing-format";

export const metadata = v6meta({
  title: "Pricing",
  description:
    "Vraelis is priced per verification, not per seat. A verification is one complete check of one system: the plan, the real browser run, and the evidence behind the decision. The first one is free, a single verification can be bought on its own, and plans set how many you run each month and how much of a system one may cover.",
  path: "/pricing",
  type: "website",
});

const BASE = V6_BASE;

// PRICES COME FROM THE BILLING CATALOG, NOT FROM THIS FILE.
//
// A pricing page holding its own copy of the numbers is a pricing page that eventually disagrees with what
// the customer is charged, and nobody notices until someone is billed an amount the site never quoted.
// PLAN_CATALOG_V1 is what checkout reads, so it is what this page renders. The same rule now covers the
// two figures this page was missing outright: the free allowance comes from FREE_TIER and the single
// verification price from passPriceCents, which is the function that charges for one.
const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US")}`;

const CARD = {
  background: "var(--graphite-2)", border: "1px solid var(--g-line)",
  borderRadius: 14, padding: "clamp(22px,2.4vw,28px)",
} as const;
const H3 = { margin: "0 0 8px", fontSize: "1.12rem", fontWeight: 600, letterSpacing: "-0.015em", color: "var(--g-fg)" } as const;
const P = { margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--g-fg-2)" } as const;
// The three inline styles that were repeated verbatim on the plan cards and the enterprise card. They are
// lifted here because there are now four bands using them rather than two, and four copies of a price
// style is how one of them ends up a different size after a later edit touches only the card in front of
// whoever is editing.
const AMOUNT = { margin: "0 0 4px", fontSize: "2rem", fontWeight: 600, letterSpacing: "-0.03em", color: "var(--g-fg)" } as const;
const AMOUNT_UNIT = { fontSize: 14, fontWeight: 400, color: "var(--g-fg-3)" } as const;
const HEADLINE = { margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: "var(--g-fg)" } as const;
const FEATURES = { margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 } as const;

// ONE THREE-CARD GRID PER PAGE, AND ON THIS PAGE IT IS THE PLANS.
//
// This route ran .v6-grid3 three times in a row: the plans, then What a verification is, then What this
// pricing does not do. Three consecutive rows of three rounded cards is the shape every SaaS pricing page
// has, and it makes the two prose sections look like tiers as well, which they are not. The plans are the
// only thing here that is genuinely a set of comparable options, so they keep the grid and the prose
// sections are set as rows instead.
//
// FREE, PAY AS YOU GO AND ENTERPRISE ARE BANDS, NOT A FOURTH COLUMN, for the same reason. .v6-grid3 is
// auto-fit, so adding a fourth card would quietly retune the row to four narrower columns and take the
// three-way plan comparison down with it. Full width bands above and below the three keep the ladder
// readable from top to bottom and change no layout system.
//
// Both row sections here are graphite. .v6-row was authored for the light ground and now carries its own
// [data-nav-dark] rebind in pagekit.css, so nothing on-dark is stated per page: a page that patched the
// colours inline is exactly how the next dark row section would come to miss them.
const n2 = (i: number) => String(i + 1).padStart(2, "0");

// THE UNIT IS A VERIFICATION, AND ITS DEPTH IS MEASURED IN JOURNEYS.
//
// This page sold "passes", which is the internal billing noun escaping onto the public site: a pass is what
// the ledger calls one charged run, and no visitor has ever arrived already knowing that. Every rendered
// sentence here says verification now. The plan cards render the shared capacity copy, which still counts a
// journey as a flow, so the row that defines depth names both words once rather than leaving a reader to
// work out on their own whether they are two different things being sold.
const WHAT_A_VERIFICATION_IS: [string, string][] = [
  ["One system, verified once", "A verification covers a single connected system end to end: deriving the checks from your guarantee, running the real journeys in a browser, and returning the evidence. It is not metered per page, per assertion, or per minute."],
  ["Journeys are the depth of a verification", "A journey is one path through the product, and it is what the plan cards count as a flow. Higher plans allow more journeys in a single verification, which is how one verification covers more of a system rather than more systems."],
  ["A refused run costs nothing", "When Vraelis cannot build a test that would prove your claim, it says so and charges nothing. You are never billed for a verification that could not have been evidence."],
];

const HONEST: [string, string][] = [
  ["No per-seat pricing", "Your team size is not the thing being measured. Invite whoever needs to read the evidence."],
  ["Yearly is a discount, not a lock", "Monthly is the default. Yearly is ten months for twelve."],
  ["Unused verifications do not roll over", "Said here rather than discovered at renewal. If that is the wrong shape for how you work, say so and it can change."],
];

export default function V6Pricing() {
  return (
    <>
      <PageHero
        kicker="Pricing"
        title="Priced per verification, not per seat."
        lead="A verification is one complete check of one system: the plan, the real browser run, and the evidence behind the decision. The first one is free. After that, buy a single verification on its own, or take a plan, which sets how many you run each month and how much of a system one may cover."
      />

      <section className="v6-sec">
        <div className="v6-wrap">
          {/* THE FREE TIER WAS NOWHERE ON THIS PAGE, AND IT IS THE STRONGEST THING WE CAN PUT IN FRONT OF A
              STRANGER. One verification, no card, against their own deployed system, ending in a real
              decision with the screenshots and the step record behind it. That is the entire argument for
              the product, made once, for nothing. The page opened on three monthly prices instead, so a
              reader who was not ready to choose a subscription had no smaller step available and no way to
              find out whether any of this works on their system. It leads the ladder now, for the same
              reason the enterprise card had to exist at the other end: a price list that starts above where
              the reader is standing is a price list they leave.

              Every figure below is FREE_TIER, the same constant the guarantee cap route and the console free
              card read, so this page cannot advertise an allowance the product does not actually grant. */}
          <Reveal>
            <div style={{ ...CARD, marginBottom: 16 }}>
              <h3 style={{ ...H3, marginBottom: 6 }}>
                Free: {FREE_TIER.lifetimePasses} full verification, no card
              </h3>
              <p style={AMOUNT}>
                {money(0)}
                <span style={AMOUNT_UNIT}> to see a real decision on your own system</span>
              </p>
              <p style={HEADLINE}>Protects {FREE_TIER.maxGuarantees} active guarantee</p>
              <ul style={FEATURES}>
                <li style={P}>
                  {FREE_TIER.lifetimePasses} verification for the life of the account, up to{" "}
                  {FREE_TIER.flowsPerPass} journeys
                </li>
                <li style={P}>{FREE_TIER.maxApplications} connected system</li>
                <li style={P}>A full Verified, Failed or Blocked decision, with screenshots and the step record</li>
                {/* Free is the ONE tier without the API, now that every paid plan has it. Stated on the card
                    rather than discovered when a key is refused. */}
                <li style={P}>Console only, no API or CLI</li>
              </ul>
              <div style={{ marginTop: 20 }}>
                <CTA>Start free</CTA>
              </div>
            </div>
          </Reveal>
          <Reveal media className="v6-grid3">
            {PLAN_CATALOG_V1.map((p) => (
              <div key={p.key} style={CARD}>
                <h3 style={H3}>{p.name}</h3>
                <p style={AMOUNT}>
                  {money(p.monthlyCents)}
                  <span style={AMOUNT_UNIT}> per month</span>
                </p>
                <p style={{ ...P, marginBottom: 16 }}>{money(p.yearlyCents)} yearly, ten months for twelve.</p>
                {/* THE PLAN COPY IS RENDERED, NOT RETYPED.
                    The headline and the four lines under it were a verbatim third copy of the wording in
                    lib/preflight/pass-pricing-format.ts, kept in step by hand. That was tried once already
                    and the copies drifted without anyone noticing: API access was Scale-only and stated on
                    none of the three surfaces that described a plan. The signed-in plans page and the
                    console pricing page both render the shared helpers, so this one does too, and a plan
                    can no longer be described two ways depending on which page you landed on.

                    The headline is still the protected surface area rather than the run count, because
                    nobody wants forty verifications: they want checkout to keep granting Pro access and
                    users to keep being able to sign in. The capacity that pays for it is disclosed
                    immediately underneath rather than behind a phrase like "fair use", since the first
                    question anyone serious asks is whether one guarantee can trigger unbounded browser
                    time, and the answer has to be a number on the card. */}
                <p style={HEADLINE}>{planHeadline(p)}</p>
                <ul style={FEATURES}>
                  {planCapacity(p).map((line) => <li key={line} style={P}>{line}</li>)}
                </ul>
                {/* EVERY CARD NEEDS A WAY TO SAY YES.
                    This page listed three plans, their prices and what each includes, and offered nothing to
                    click. Someone who read it and decided on Pro had to sign in, land on the app overview,
                    and go looking through Settings for where plans live. The checkout page takes the plan
                    from the query and sends a signed-out visitor through sign-in and back, so one link
                    serves both cases. */}
                {/* NO RECOMMENDED TIER. The middle plan used to carry brand, which is the highlighted
                    centre card every three-tier pricing page has, and it is a nudge rather than a fact:
                    which plan is right depends on how many guarantees a team is protecting, and the card
                    already says that in a number. Three identical buttons let the numbers decide. */}
                <div style={{ marginTop: 20 }}>
                  <CTA href={`/checkout?plan=${p.key}&cycle=monthly`}>Choose {p.name}</CTA>
                </div>
              </div>
            ))}
          </Reveal>
          {/* THE PRICE OF ONE RUN, PUT WHERE THAT COMPARISON IS ACTUALLY MADE.
              The page carried the idea in a closing line, that a verification can be paid for on its own,
              and never once carried the number. A reader weighing a monthly plan against a single run was
              being asked to compare a price with a blank, and the blank always loses. It sits directly
              under the plans because that is the moment the question gets asked, rather than below the
              enterprise card where the reader has already been handed off to sales.

              Both figures come from the functions that charge, not from this file. The console credits page
              once quoted the early-access price from a typed literal while every charging path took the
              public one, and it went unnoticed because nothing tied the sentence to the maths. */}
          <Reveal>
            <div style={{ ...CARD, marginTop: 16 }}>
              <h3 style={{ ...H3, marginBottom: 6 }}>
                Pay as you go: {money(passPriceCents(PASS_INCLUDED_FLOWS))} for one verification
              </h3>
              <p style={HEADLINE}>No plan, no monthly allowance</p>
              <p style={{ ...P, marginBottom: 16 }}>
                One verification covers up to {PASS_INCLUDED_FLOWS} journeys through a single system, and
                each journey beyond that is {money(EXTRA_FLOW_CENTS)}. Buy one when you need one. Nothing
                renews, and a run Vraelis refuses to build still costs nothing.
              </p>
              <CTA>Run a single verification</CTA>
            </div>
          </Reveal>
          {/* THE TIER THAT WAS NOT ON THE PAGE. An agency, a platform team, or anyone with a procurement
              process reads three self-serve cards, sees a ceiling and no way to say "we need more than
              that, and we need a contract", and leaves. Every line here is something /enterprise marks
              Operational: OIDC single sign-on, roles, owner-anchored billing, audit export. SAML is
              Preview there and SCIM is Planned, so neither is sold here. A card that presents a preview as
              shipped is the exact failure this product exists to catch, and enterprise buyers check. */}
          <Reveal>
            <div style={{ ...CARD, marginTop: 16 }}>
              <h3 style={{ ...H3, marginBottom: 6 }}>
                Enterprise: more than {PLAN_CATALOG_V1[PLAN_CATALOG_V1.length - 1].maxGuarantees} guarantees, or a contract
              </h3>
              {/* The last rung, in the same units as the other three. Not "Unlimited": what a contract
                  costs depends on verification volume, browser time, systems, retention and support. */}
              <p style={HEADLINE}>Custom guarantee capacity</p>
              <p style={{ ...P, marginBottom: 16 }}>
                Volume above the listed plans, single sign-on through your own identity provider, roles
                across a team, owner-anchored billing, and audit activity you can export. Invoicing, a
                signed agreement and a security review are all available. Written quotes, not a calculator.
              </p>
              <CTA href="mailto:sales@vraelis.com?subject=Vraelis%20Enterprise">Talk to sales</CTA>
            </div>
          </Reveal>
          <Reveal>
            <p style={{ ...P, marginTop: 24 }}>
              Yearly billing is available at checkout, and a plan that runs out early can be topped up with
              single verifications at the pay as you go price.
            </p>
            <div style={{ marginTop: 16 }}><CTA ghost>Open Vraelis</CTA></div>
          </Reveal>
        </div>
      </section>

      <section className="v6-sec v6-dark" data-nav-dark>
        <div className="v6-wrap">
          <SectionHead eyebrow="What a verification is" title="One system, verified once, with the evidence kept." />
          <div className="v6-rows">
            {WHAT_A_VERIFICATION_IS.map(([t, d], i) => (
              <Reveal key={t} i={i}>
                <div className="v6-row">
                  <span className="v6-row__n">{n2(i)}</span>
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

      <section className="v6-sec">
        <div className="v6-wrap">
          <SectionHead eyebrow="Stated plainly" title="What this pricing does not do." />
          {/* Light ground, so the row classes need no overrides here. */}
          <div className="v6-rows">
            {HONEST.map(([t, d], i) => (
              <Reveal key={t} i={i}>
                <div className="v6-row">
                  <span className="v6-row__n">{n2(i)}</span>
                  <div>
                    <h3 className="v6-row__t">{t}</h3>
                    <p className="v6-row__d">{d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p className="v6-note">
              Running past the largest plan, or need invoicing, SSO and a signed agreement? That is the{" "}
              <ProseLink href={`${BASE}/enterprise`}>enterprise</ProseLink> conversation. What Vraelis
              cannot do yet is written down on{" "}
              <ProseLink href={`${BASE}/limitations`}>limitations</ProseLink>.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
