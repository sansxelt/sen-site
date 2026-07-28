import { v6meta } from "../_system/meta";
import { PageHero, Reveal, SectionHead, CTA, EditorialLink, ProseLink } from "../_system/ui";
import { V6_BASE } from "@/lib/v6-routes";
import { PLAN_CATALOG_V1 } from "@/lib/preflight/pass-pricing";

export const metadata = v6meta({
  title: "Pricing",
  description:
    "Vraelis is priced per verification pass, not per seat. A pass is one complete verification of one system: the plan, the real browser run, and the evidence behind the decision. Plans differ in how many passes you get and how much of a system a single pass may cover.",
  path: "/pricing",
  type: "website",
});

const BASE = V6_BASE;

// PRICES COME FROM THE BILLING CATALOG, NOT FROM THIS FILE.
//
// A pricing page holding its own copy of the numbers is a pricing page that eventually disagrees with what
// the customer is charged, and nobody notices until someone is billed an amount the site never quoted.
// PLAN_CATALOG_V1 is what checkout reads, so it is what this page renders.
const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US")}`;

const CARD = {
  background: "var(--graphite-2)", border: "1px solid var(--g-line)",
  borderRadius: 14, padding: "clamp(22px,2.4vw,28px)",
} as const;
const H3 = { margin: "0 0 8px", fontSize: "1.12rem", fontWeight: 600, letterSpacing: "-0.015em", color: "var(--g-fg)" } as const;
const P = { margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--g-fg-2)" } as const;

const WHAT_A_PASS_IS: [string, string][] = [
  ["One system, verified once", "A pass covers a single connected system end to end: deriving the checks from your guarantee, running the real workflow in a browser, and returning the evidence. It is not metered per page, per assertion, or per minute."],
  ["Flows are the depth of a pass", "A flow is one journey through the product. Higher plans allow more flows in a single pass, which is how a pass covers more of a system rather than more systems."],
  ["A refused run costs nothing", "When Vraelis cannot build a test that would prove your claim, it says so and charges nothing. You are never billed for a verification that could not have been evidence."],
];

const HONEST: [string, string][] = [
  ["No per-seat pricing", "Your team size is not the thing being measured. Invite whoever needs to read the evidence."],
  ["Yearly is a discount, not a lock", "Monthly is the default. Yearly is ten months for twelve."],
  ["Unused passes do not roll over", "Said here rather than discovered at renewal. If that is the wrong shape for how you work, say so and it can change."],
];

export default function V6Pricing() {
  return (
    <>
      <PageHero
        kicker="Pricing"
        title="Priced per verification, not per seat."
        lead="A pass is one complete verification of one system: the plan, the real browser run, and the evidence behind the decision. Plans differ in how many passes you get each month, and how much of a system a single pass may cover."
      />

      <section className="v6-sec">
        <div className="v6-wrap">
          <Reveal media className="v6-grid3">
            {PLAN_CATALOG_V1.map((p) => (
              <div key={p.key} style={CARD}>
                <h3 style={H3}>{p.name}</h3>
                <p style={{ margin: "0 0 4px", fontSize: "2rem", fontWeight: 600, letterSpacing: "-0.03em", color: "var(--g-fg)" }}>
                  {money(p.monthlyCents)}
                  <span style={{ fontSize: 14, fontWeight: 400, color: "var(--g-fg-3)" }}> per month</span>
                </p>
                <p style={{ ...P, marginBottom: 16 }}>{money(p.yearlyCents)} yearly, ten months for twelve.</p>
                {/* THE HEADLINE IS THE PROTECTED SURFACE AREA, matching the console exactly.
                    Nobody wants forty verifications. They want checkout to keep granting Pro access and
                    users to keep being able to sign in. Runs are how that is proven, so they stay
                    disclosed underneath rather than behind a phrase like "fair use": the first question
                    anyone serious asks is whether one guarantee can trigger unbounded browser time, and
                    the answer has to be a number on the card. */}
                <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: "var(--g-fg)" }}>
                  Protects up to {p.maxGuarantees} active guarantees
                </p>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                  <li style={P}>{p.passesPerMonth} verifications a month, up to {p.flowsPerPass} flows each</li>
                  <li style={P}>
                    {p.maxApplications === null
                      ? "Connect any number of systems"
                      : `${p.maxApplications} connected system${p.maxApplications === 1 ? "" : "s"}`}
                  </li>
                  {/* Was Scale-only and stated on no card, which is how somebody could install the CLI and
                      then be refused by a rule they had no way to read. */}
                  <li style={P}>API, CLI and webhooks</li>
                  <li style={P}>Top up for more, billed per verification</li>
                </ul>
                {/* EVERY CARD NEEDS A WAY TO SAY YES.
                    This page listed three plans, their prices and what each includes, and offered nothing to
                    click. Someone who read it and decided on Pro had to sign in, land on the app overview,
                    and go looking through Settings for where plans live. The checkout page takes the plan
                    from the query and sends a signed-out visitor through sign-in and back, so one link
                    serves both cases. */}
                <div style={{ marginTop: 20 }}>
                  <CTA brand={p.key === "pro_v1"} href={`/checkout?plan=${p.key}&cycle=monthly`}>Choose {p.name}</CTA>
                </div>
              </div>
            ))}
          </Reveal>
          {/* THE TIER THAT WAS NOT ON THE PAGE. An agency, a platform team, or anyone with a procurement
              process reads three self-serve cards, sees a ceiling and no way to say "we need more than
              that, and we need a contract", and leaves. Every line here is something /enterprise marks
              Operational: OIDC single sign-on, roles, owner-anchored billing, audit export. SAML is
              Preview there and SCIM is Planned, so neither is sold here. A card that presents a preview as
              shipped is the exact failure this product exists to catch, and enterprise buyers check. */}
          <Reveal>
            <div style={{ ...CARD, marginTop: 22 }}>
              <h3 style={{ ...H3, marginBottom: 6 }}>
                Enterprise: more than {PLAN_CATALOG_V1[PLAN_CATALOG_V1.length - 1].maxGuarantees} guarantees, or a contract
              </h3>
              {/* The last rung, in the same units as the other three. Not "Unlimited": what a contract
                  costs depends on verification volume, browser time, systems, retention and support. */}
              <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: "var(--g-fg)" }}>
                Custom guarantee capacity
              </p>
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
              Yearly billing is available at checkout. Or start without a plan: a verification can be paid for
              on its own.
            </p>
            <div style={{ marginTop: 16 }}><CTA ghost>Open Vraelis</CTA></div>
          </Reveal>
        </div>
      </section>

      <section className="v6-sec v6-dark" data-nav-dark>
        <div className="v6-wrap">
          <SectionHead eyebrow="What a pass is" title="One system, verified once, with the evidence kept." />
          <Reveal media className="v6-grid3">
            {WHAT_A_PASS_IS.map(([t, d]) => (
              <div key={t} style={CARD}><h3 style={H3}>{t}</h3><p style={P}>{d}</p></div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="v6-sec">
        <div className="v6-wrap">
          <SectionHead eyebrow="Stated plainly" title="What this pricing does not do." />
          <Reveal media className="v6-grid3">
            {HONEST.map(([t, d]) => (
              <div key={t} style={CARD}><h3 style={H3}>{t}</h3><p style={P}>{d}</p></div>
            ))}
          </Reveal>
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
