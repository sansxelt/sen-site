import { v6meta } from "../_system/meta";
import { CTA, EditorialLink, SectionHead } from "../_system/ui";
import { Faq, IndexHero, type FaqItem } from "../_system/kit";
import { ClosingScene } from "../_system/close";
import { PricingSwitch, PricingToggle } from "../_system/pricing-toggle";
import { V6_BASE, v6SignInPath } from "@/lib/v6-routes";
import { PLAN_CATALOG_V1, FREE_TIER, PASS_INCLUDED_FLOWS, EXTRA_FLOW_CENTS, RERUN_PER_FLOW_CENTS, flowUnitsPerMonth, passPriceCents, type PlanV1 } from "@/lib/preflight/pass-pricing";
import { usdFromCents, effectiveMonthlyUsd, planCapacity } from "@/lib/preflight/pass-pricing-format";
import { PricingEstimate } from "./pricing-estimate";
import "./pricing.css";

export const metadata = v6meta({
  title: "Pricing",
  description: "Compare Vraelis browser-verification plans, estimate checks and targeted reruns, and explore the separate recording beta. No per-seat pricing.",
  path: "/pricing", type: "website",
});

const BASE = V6_BASE;
const SIGNUP = `${v6SignInPath()}&mode=signup`;
const RECORDED = v6SignInPath("/verifications/recorded");
const money = usdFromCents;
const FOR: Record<PlanV1["key"], string> = {
  builder_v1: "For a small team reviewing a few systems.",
  pro_v1: "For engineering teams checking several systems.",
  scale_v1: "For organizations with frequent review cycles.",
};
const FREE_LINES = [
  `${FREE_TIER.lifetimePasses} lifetime browser verification, up to ${FREE_TIER.flowsPerPass} flows`,
  `${FREE_TIER.maxApplications} connected system`,
  "Console access; no API or CLI",
];

function Price({ amount, unit, cyc }: { amount: string; unit?: string; cyc?: "monthly" | "yearly" }) {
  return <p className="v6-pp__price" data-cyc={cyc}><span className="v6-pp__amt" data-no-translate>{amount}</span>{unit ? <span className="v6-pp__unit">{unit}</span> : null}</p>;
}

const FAQ: FaqItem[] = [
  { q: "What am I paying for?", a: "These prices cover browser-verification capacity: an approved plan, a browser run, and the recorded steps and evidence behind the finding. A check of software is not proof of what a physical device did." },
  { q: "Is the recording beta included in these prices?", a: "The local recording beta is a separate workflow for supported JSON and MCAP task reports. It compares supplied reports in your browser; it does not consume browser-verification capacity. Read the beta and format documentation before bringing recordings." },
  { q: "What is a flow?", a: "A flow is one browser journey, such as confirming a selected contact or completing an equipment task. A verification can contain several flows. Each plan limits flows per check and has a monthly flow allowance." },
  { q: "What is an active software requirement?", a: "It is a saved outcome you want Vraelis to check, called a guarantee in the console. The plan limits how many can be active at once. Saving a requirement does not certify a system or guarantee future physical behavior." },
  { q: "How does monthly usage work?", a: "Each plan's monthly allowance is its listed verifications multiplied by flows per verification. A check uses the flows it runs; a targeted rerun uses only the selected failed flows. Smaller checks can use the same allowance across more runs. Unused monthly allowance does not roll over." },
  { q: "What does a rerun cost?", a: <><p>A fresh full check is billed as a new verification. A targeted rerun selects only failed flows from an existing check.</p><p>{`On pay as you go, a targeted rerun costs ${money(RERUN_PER_FLOW_CENTS)} per selected failed flow, capped at the price of a comparable full check. On a subscription, only those selected flows use the monthly allowance.`}</p><p>The estimator above shows the full-check and targeted-rerun amounts separately.</p></> },
  { q: "What changes with yearly billing?", a: "The displayed yearly price is charged up front and equals ten monthly payments for twelve months of access. Capacity resets monthly; the whole year's allowance is not released at once. Cancelling renewal keeps your paid-for access through the end of the term." },
  { q: "Can I start without a card?", a: `Yes. Free includes ${FREE_TIER.lifetimePasses} lifetime browser verification with up to ${FREE_TIER.flowsPerPass} flows, for ${FREE_TIER.maxApplications} connected system. The free allowance is not a monthly refill.` },
  { q: "Do I need a paid seat for every reviewer?", a: "No. These prices are based on verification capacity, not a per-seat charge. Team access and organizational controls are described separately on the Enterprise page." },
  { q: "What if Vraelis cannot build the check?", a: "If no check can be built for the requested requirement, there is no verification charge. A completed check that finds a problem is still a completed verification." },
  { q: "How do government and enterprise evaluations work?", a: <><p>Start with a conversation about your systems, a representative software workflow, and the evidence your reviewers need. Capacity, contract terms and organizational controls are scoped in a written quote. Bring your procurement and security requirements so the evaluation can be scoped before a purchase.</p><EditorialLink href={`${BASE}/government`}>Government and institutions</EditorialLink></> },
];

export default function V6Pricing() {
  return (
    <>
      <PricingToggle className="v6-pp">
        <div className="v6-pp__hero">
          <IndexHero compact eyebrow="Pricing" title="Evidence first. Capacity when you need it." lead="Start with a free browser check. Add review capacity as your systems grow, with no per-seat pricing." actions={<><PricingSwitch /><p className="v6-pp__note">Yearly: twelve months of access for ten monthly payments.</p></>} />
        </div>
        <section className="v6-sec v6-pp__plans" id="plans" aria-labelledby="plans-h">
          <div className="v6-wrap">
            <h2 className="v6-pp__sr" id="plans-h">Browser-verification plans</h2>
            <ul className="v6-pp__grid" role="list">
              <li className="v6-pp__card">
                <h3 className="v6-pp__name">Free</h3>
                <div className="v6-pp__prow"><Price amount={money(0)} /><p className="v6-pp__billing">No card required</p></div>
                <p className="v6-pp__for">Try one check before choosing a plan.</p>
                <div className="v6-pp__act"><CTA href={SIGNUP}>Start free</CTA></div>
                <p className="v6-pp__head">{`${FREE_TIER.maxGuarantees} active software requirement`}</p>
                <ul className="v6-pp__list" role="list">{FREE_LINES.map((line) => <li key={line}>{line}</li>)}</ul>
              </li>
              {PLAN_CATALOG_V1.map((p) => (
                <li className="v6-pp__card" key={p.key}>
                  <h3 className="v6-pp__name">{p.name}</h3>
                  <div className="v6-pp__prow">
                    <Price amount={money(p.monthlyCents)} unit="per month" cyc="monthly" />
                    <Price amount={money(p.yearlyCents)} unit="per year" cyc="yearly" />
                    <p className="v6-pp__billing" data-cyc="monthly">Billed monthly</p>
                    <p className="v6-pp__billing" data-cyc="yearly">{`Billed upfront; about ${effectiveMonthlyUsd(p.yearlyCents)} per month`}</p>
                  </div>
                  <p className="v6-pp__for">{FOR[p.key]}</p>
                  <div className="v6-pp__act">
                    <span data-cyc="monthly"><CTA ghost href={`/checkout?plan=${p.key}&cycle=monthly`}>Choose {p.name}</CTA></span>
                    <span data-cyc="yearly"><CTA ghost href={`/checkout?plan=${p.key}&cycle=yearly`}>Choose {p.name}</CTA></span>
                  </div>
                  <p className="v6-pp__head">{`Up to ${p.maxGuarantees} active software requirements`}</p>
                  <ul className="v6-pp__list" role="list">{planCapacity(p).map((line) => <li key={line}>{line}</li>)}</ul>
                </li>
              ))}
            </ul>
            <p className="v6-pp__capacity-note">Plan capacity applies to browser checks. The local recording beta is a separate report-review workflow.</p>
            <div className="v6-pp__more">
              <div className="v6-pp__alt">
                <h3 className="v6-pp__name">Pay as you go</h3>
                <Price amount={money(passPriceCents(PASS_INCLUDED_FLOWS))} unit="per verification" />
                <p className="v6-pp__for">Occasional checks, or extra capacity beyond a plan.</p>
                <ul className="v6-pp__list" role="list">
                  <li>{`Up to ${PASS_INCLUDED_FLOWS} flows in a full check`}</li>
                  <li>{`${money(EXTRA_FLOW_CENTS)} per additional flow`}</li>
                  <li>No recurring subscription</li>
                </ul>
                <div className="v6-pp__act"><CTA ghost href="/credits">Add verification balance</CTA><EditorialLink href="#estimate">Estimate a check</EditorialLink></div>
              </div>
              <div className="v6-pp__alt v6-pp__enterprise">
                <h3 className="v6-pp__name">Enterprise & government</h3>
                <p className="v6-pp__cap">Scope the review together.</p>
                <p className="v6-pp__for">For institutions, integrators and teams with organizational requirements. Capacity and terms are agreed in a written quote.</p>
                <ul className="v6-pp__list" role="list"><li>Single sign-on through your identity provider</li><li>Team roles, owner-anchored billing and audit export</li><li>A conversation about evaluation scope and contract needs</li></ul>
                <div className="v6-pp__act"><CTA ghost href={`${BASE}/contact?topic=enterprise`}>Talk to sales</CTA><EditorialLink href={`${BASE}/enterprise`}>Enterprise details</EditorialLink></div><a className="v6-pp__mail" href="mailto:sales@vraelis.com?subject=Vraelis%20evaluation" data-no-translate>sales@vraelis.com</a>
              </div>
            </div>
          </div>
        </section>
      </PricingToggle>

      <section className="v6-sec v6-pp__beta" aria-labelledby="recording-h">
        <div className="v6-wrap v6-pp__beta-inner">
          <div><p className="v6-eyebrow">The recording beta</p><h2 id="recording-h">Already have the reports?</h2><p>Compare the requested task with control-panel, service and device reports. Find conflicting states, missing completion and changes to the wrong asset.</p><EditorialLink href={RECORDED}>Open recorded evidence</EditorialLink><div className="v6-pp__beta-docs"><EditorialLink href={`${BASE}/docs/recorded-reports`}>Supported JSON and MCAP formats</EditorialLink></div></div>
          <div className="v6-pp__record-flow" role="figure" aria-label="Supported task reports are compared against a requirement, producing findings linked to source events.">
            <div className="v6-pp__record-inputs"><span>Control panel</span><span>Task service</span><span>Device report</span></div>
            <span className="v6-pp__record-arrow" aria-hidden="true">↓</span>
            <div className="v6-pp__record-compare"><span>One task. One intended asset.</span><strong>Compare the recorded states</strong></div>
            <span className="v6-pp__record-arrow" aria-hidden="true">↓</span>
            <div className="v6-pp__record-result"><span>Finding</span><strong>Inspect the source events</strong></div>
            <p>Files stay in your browser. Reports describe recorded state; they do not establish physical ground truth. Live device connections are not available.</p>
          </div>
        </div>
      </section>

      <section className="v6-sec v6-pp__estimate-sec" id="estimate" aria-labelledby="estimate-h"><div className="v6-wrap"><SectionHead eyebrow="Understand the charge" title={<span id="estimate-h">Make the cost visible.</span>} lead="The same catalog calculations used for browser-verification billing, with the included flows and rerun cap shown explicitly." /><PricingEstimate /></div></section>

      <section className="v6-sec v6-pp__comparison" aria-labelledby="comparison-h"><div className="v6-wrap">
        <SectionHead eyebrow="Plan details" title={<span id="comparison-h">Compare the actual limits.</span>} lead="A software requirement is called a guarantee in the console. It records what you want checked; it is not a safety certification." />
        <p className="v6-pp__scroll-hint">Scroll across to compare all plans.</p>
        <div className="v6-pp__table-scroll" role="region" aria-label="Plan capacity comparison" tabIndex={0}>
          <table className="v6-pp__table"><caption className="v6-pp__sr">Browser-verification capacity by plan</caption><thead><tr><th scope="col">Capacity</th><th scope="col">Free</th>{PLAN_CATALOG_V1.map(p => <th scope="col" key={p.key}>{p.name}</th>)}</tr></thead>
            <tbody>
              <tr><th scope="row">Active requirements</th><td>{FREE_TIER.maxGuarantees}</td>{PLAN_CATALOG_V1.map(p => <td key={p.key}>{p.maxGuarantees}</td>)}</tr>
              <tr><th scope="row">Flows per check</th><td>{FREE_TIER.flowsPerPass}</td>{PLAN_CATALOG_V1.map(p => <td key={p.key}>{p.flowsPerPass}</td>)}</tr>
              <tr><th scope="row">Monthly flow allowance</th><td>{`${FREE_TIER.lifetimePasses * FREE_TIER.flowsPerPass} lifetime`}</td>{PLAN_CATALOG_V1.map(p => <td key={p.key}>{flowUnitsPerMonth(p).toLocaleString("en-US")}</td>)}</tr>
              <tr><th scope="row">Connected systems</th><td>{FREE_TIER.maxApplications}</td>{PLAN_CATALOG_V1.map(p => <td key={p.key}>{p.maxApplications ?? "No plan cap"}</td>)}</tr>
              <tr><th scope="row">API, CLI & webhooks</th><td>—</td>{PLAN_CATALOG_V1.map(p => <td key={p.key}>Included</td>)}</tr>
              <tr><th scope="row">Pay-as-you-go top-ups</th><td>Available</td>{PLAN_CATALOG_V1.map(p => <td key={p.key}>Available</td>)}</tr>
              <tr><th scope="row">Per-seat charge</th><td>None</td>{PLAN_CATALOG_V1.map(p => <td key={p.key}>None</td>)}</tr>
            </tbody>
          </table>
        </div>
        <p className="v6-pp__capacity-note">Full checks use their selected flow count. Targeted reruns use only the failed flows selected to run again. Subscription allowance resets monthly, including on yearly billing.</p>
      </div></section>

      <section className="v6-sec v6-pp-faq" id="questions"><div className="v6-wrap"><Faq items={FAQ} /></div></section>
      <ClosingScene title="Start with evidence you can inspect." action={{ label: "Start free", href: SIGNUP }} say="Your first browser verification is free. Bring a clear software requirement and review the recorded result." />
    </>
  );
}
