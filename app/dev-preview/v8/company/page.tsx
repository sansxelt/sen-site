import Link from "next/link";
import { Button, Capture, PageHero, Section, Tag, Wrap } from "../_kit/blocks";
import { RiseWords } from "../_kit/client";
import { v8meta } from "../_kit/meta";
import { CONTOUR, FACTS, STATUS, href, TAB_NAMES } from "../_kit/site";
import { PARTNERS, PARTNERS_NOTE } from "../_content/partners";
import { LogoCard } from "../partners/logo-card";
import "../partners/partners.css";
import "./company.css";

export const metadata = v8meta({
  title: "About Vraelis",
  description: `Why Vraelis exists, the problem it works on, what is built in ${CONTOUR.name} today and where it stops.`,
  path: "/company",
  tab: TAB_NAMES.company,
});

// ABOUT (founder, 2026-10-13): why Vraelis exists, the problem, what is actually built, its limits and the partners.
// Concrete facts only, read from STATUS and FACTS so they match /contour/status. Vraelis is Vraelis: no founder, no
// umbrella brand on this page ("dont say anything about me thats foremake"). The URL stays /company.
export default function About() {
  return (
    <div className="cmp">
      <PageHero
        eyebrow="About"
        title={<RiseWords text="An approved AI update is not proof it is running." />}
        lead={<>Vraelis is building {CONTOUR.name}, which records whether the model release you approved is the one a runtime reports running. In private development, not for public use.</>}
        actions={<><Button to="/contact" arrow>Talk to us</Button><Button to="/contour/status" kind="soft">Development status</Button></>}
      />

      <Section rule id="problem">
        <Wrap>
          <div className="v8-split-sec">
            <div className="v8-stack--lg">
              <div className="v8-head">
                <span className="v8-eyebrow">The problem</span>
                <h2 className="v8-h2">An approval says what should run, not what does.</h2>
              </div>
              <p className="v8-lead">In our recorded run, cpu-2 was approved while the runtime kept serving cpu-1 until an explicit reload. Then the worker stopped, and nothing reported what was loaded.</p>
              <p className="v8-body">{CONTOUR.name} keeps every observation in order, including the one that confirmed nothing.</p>
            </div>
            <Capture name="app-destination-pending" small caption="Observation 02: cpu-2 approved, cpu-1 still loaded. Read-only evidence app, inside the controlled ONNX reference experiment." />
          </div>
        </Wrap>
      </Section>

      <Section rule id="built">
        <Wrap>
          <div className="v8-stack--lg">
            <div className="v8-head">
              <span className="v8-eyebrow">What is built</span>
              <h2 className="v8-h2">One controlled experiment, working end to end.</h2>
            </div>
            <div className="cmp-built">
              <div className="v8-stack">
                <Tag kind="impl" />
                <ul className="cmp-list">{STATUS.working.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
              <div className="v8-stack">
                <Tag kind="meas" />
                <p className="cmp-measure"><b>{FACTS.tests.value}</b> {FACTS.tests.label}.</p>
              </div>
            </div>
            <div className="cmp-limits">
              <div className="v8-stack">
                <h3 className="v8-h3">Not built yet</h3>
                <ul className="cmp-list cmp-list--muted">{STATUS.building.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
              <div className="v8-stack">
                <h3 className="v8-h3">Not claimed</h3>
                <ul className="cmp-list cmp-list--muted">{STATUS.notClaimed.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
            </div>
            <p className="v8-small">{CONTOUR.scope}</p>
          </div>
        </Wrap>
      </Section>

      <Section rule id="partners">
        <Wrap>
          <div className="v8-stack--lg">
            <div className="v8-head">
              <span className="v8-eyebrow">Partners</span>
              <h2 className="v8-h2">{new Intl.ListFormat("en", { type: "conjunction" }).format(PARTNERS.map((p) => p.name))}.</h2>
              <p className="v8-body">{PARTNERS_NOTE}</p>
            </div>
            <div className="cmp-partners">
              {PARTNERS.map((p) => (
                <Link key={p.slug} href={href(`/partners/${p.slug}`)} className="pt-card" aria-label={`${p.title}: the partnership record`}>
                  <LogoCard p={p} />
                  <p className="pt-meta"><span>{p.focus}</span></p>
                </Link>
              ))}
            </div>
          </div>
        </Wrap>
      </Section>
    </div>
  );
}
