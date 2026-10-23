import Link from "next/link";
import { Button, Capture, PageHero, Section, Tag, Wrap } from "../_kit/blocks";
import { RiseWords } from "../_kit/client";
import { v8meta } from "../_kit/meta";
import { COMPANY_LINE, WORK_LINE, CONTOUR, FACTS, RESEARCH, STATUS, FOREMAKE, href, TAB_NAMES } from "../_kit/site";
import "./company.css";

export const metadata = v8meta({
  title: "About Vraelis",
  description: `${COMPANY_LINE} ${CONTOUR.name}, its first product direction, is in private development.`,
  path: "/company",
  tab: TAB_NAMES.company,
});

// About explains the company and its work. Relationship details live on Partners.
export default function About() {
  return (
    <div className="cmp">
      <PageHero
        eyebrow="About"
        title={<RiseWords text="Security for AI in the physical world." />}
        lead={<>{COMPANY_LINE} {WORK_LINE}</>}
        actions={<><Button to="/contact" arrow>Join Us</Button><Button to="/contour/status" kind="soft">Development status</Button></>}
      />

      <Section rule id="company">
        <Wrap><div className="v8-stack--lg">
          <div className="v8-head"><span className="v8-eyebrow">Vraelis by Foremake, Inc</span><h2 className="v8-h2">A company built around AI security.</h2></div>
          <p className="v8-body">{FOREMAKE}</p>
          <p className="v8-body">Our first product, Vraelis Contour, has private access. We are researching public products with distinct user workflows; no additional product is available or named yet.</p>
          <p className="v8-body"><a className="v8-under" href="https://foremake.com/" target="_blank" rel="noopener noreferrer">About Foremake, Inc</a></p>
        </div></Wrap>
      </Section>

      <Section rule id="problem">
        <Wrap>
          <div className="v8-split-sec">
            <div className="v8-stack--lg">
              <div className="v8-head">
                <span className="v8-eyebrow">Our first product direction · Vraelis Contour</span>
                <h2 className="v8-h2">An approval says what should run, not what does.</h2>
              </div>
              <p className="v8-lead">In our recorded run, cpu-2 was approved while the runtime kept serving cpu-1 until an explicit reload. Then the worker stopped, and nothing reported what was loaded.</p>
              <p className="v8-body">{CONTOUR.name} keeps every observation in order, including the one that confirmed nothing.</p>
              <p className="v8-body">{CONTOUR.status} {CONTOUR.line} It is not available for public use.</p>
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
              <h2 className="v8-h2">A private reference experiment.</h2>
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
                <h3 className="v8-h3">Planned beyond the published experiment</h3>
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

      <Section rule id="research">
        <Wrap>
          <div className="v8-stack--lg">
            <div className="v8-head">
              <span className="v8-eyebrow">Research</span>
              <h2 className="v8-h2">The questions behind the work.</h2>
              <p className="v8-body">These research areas describe the problems we are exploring. They are not additional shipped products.</p>
            </div>
            <ul className="cmp-list">
              {RESEARCH.map((r) => <li key={r.slug}><Link className="v8-under" href={href(`/research/${r.slug}`)}>{r.title}</Link>: {r.line}</li>)}
            </ul>
          </div>
        </Wrap>
      </Section>

      <Section rule id="company-connections">
        <Wrap><div className="v8-stack">
          <h2 className="v8-h2">Our partnerships.</h2>
          <p className="v8-body">Explore our official relationships with ByteDance, Reddit, Stripe Startups and Cloudflare, with each partnership’s scope and milestones.</p>
          <Link className="v8-under" href={href("/partners")}>Meet our partners<span className="v8-arrow" aria-hidden="true" /></Link>
        </div></Wrap>
      </Section>
    </div>
  );
}
