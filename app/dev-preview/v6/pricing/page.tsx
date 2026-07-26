import { v6meta } from "../_system/meta";
import { PageHero, Reveal, SectionHead, CTA, EditorialLink } from "../_system/ui";
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
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                  <li style={P}>{p.passesPerMonth} verification passes each month</li>
                  <li style={P}>Up to {p.flowsPerPass} flows in a single pass</li>
                  <li style={P}>
                    {p.maxApplications === null
                      ? "Unlimited connected systems"
                      : `${p.maxApplications} connected system${p.maxApplications === 1 ? "" : "s"}`}
                  </li>
                </ul>
              </div>
            ))}
          </Reveal>
          <Reveal>
            <div style={{ marginTop: 28 }}><CTA brand>Open Vraelis</CTA></div>
          </Reveal>
        </div>
      </section>

      <section className="v6-sec" data-nav-dark>
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
              <EditorialLink href={`${BASE}/enterprise`}>enterprise</EditorialLink> conversation. What Vraelis
              cannot do yet is written down on{" "}
              <EditorialLink href={`${BASE}/limitations`}>limitations</EditorialLink>.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
