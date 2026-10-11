import Link from "next/link";
import type { ReactNode } from "react";
import { Button, Capture, JoinBand, PageHero, PhotoCard, Section, Tag, TextLink, Wrap } from "../_kit/blocks";
import { RiseWords } from "../_kit/client";
import { v8meta } from "../_kit/meta";
import { COMPANY_LINE, CONTOUR, FACTS, FOUNDER, RESEARCH, WORK_LINE, href } from "../_kit/site";
import { formatDay } from "../_content/news";
import { CURRENT } from "../changelog/history";
import "./company.css";

export const metadata = v8meta({
  title: "Vraelis | Company and founder Nishanth Dasari",
  description: `${COMPANY_LINE} Founded by ${FOUNDER}. Foremake, Inc is the umbrella brand behind Vraelis and Overlym, a separate fintech venture in development.`,
  path: "/company",
});

// x.ai's /company order: mission h1, proof cards, what we do, people, values ("At our core"), then the year-grouped
// history ("Our path of progress") fed from the same record as /changelog. Only the current record (NEWS) is listed
// here: the earlier product's titles are in the present tense and read as claims without the changelog's context
// (2026-10-11 audit), so that record is one link to /changelog#earlier-direction. One h1: the company line. The founder
// keeps the #nishanth-dasari anchor that lib/entity.ts publishes as his schema.org @id. Founder facts and profile
// links are only those already on the live /company page.
const LINKEDIN = "https://www.linkedin.com/in/beamed/";
const FOREMAKE_PROFILE = "https://foremake.com/nishanth";

const PROOF = [
  { title: CONTOUR.name, line: CONTOUR.line, to: "/contour" },
  { title: "Research", line: "Four research workstreams.", to: "/research" },
  { title: "Applications", line: "Intended areas: defense, critical infrastructure, autonomous systems.", to: "/applications" },
  { title: "Changelog", line: "Every dated entry, newest first.", to: "/changelog" },
];

const PRINCIPLES = [
  {
    n: "01",
    title: "Implemented and proposed stay apart.",
    body: "Every claim carries one of these labels.",
    tags: true,
  },
  {
    n: "02",
    title: "Records are kept in order.",
    body: "Observations keep their order and time, including the ones that confirmed nothing.",
  },
  {
    n: "03",
    title: "Results are reproduced before we state them.",
    body: `${FACTS.tests.value} ${FACTS.tests.label}. Not production readiness and not independent review.`,
  },
];

function External({ to, children }: { to: string; children: ReactNode }) {
  return (
    <a className="cmp-ext" href={to} rel="noopener noreferrer" target="_blank">
      <span>{children}</span>
      <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3.5 2.5h6v6M9.5 2.5l-7 7" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
      <span className="v8-sr"> (opens in a new tab)</span>
    </a>
  );
}

export default function Company() {
  return (
    <div className="cmp">
      <PageHero
        eyebrow="Company"
        title={<RiseWords text={COMPANY_LINE} />}
        lead={<>Our first product direction is {CONTOUR.name}.</>}
        actions={<><Button to="/contact" arrow>Join us</Button><Button to="/contour" kind="soft">{CONTOUR.name}</Button></>}
      />

      <section aria-label="Where to go next" className="cmp-proof-sec">
        <Wrap>
          <div className="cmp-proof">
            {PROOF.map((p) => (
              <Link key={p.to} href={href(p.to)} className="v8-box v8-box--link cmp-proof__card">
                <b>{p.title}</b>
                <span>{p.line}</span>
                <span className="cmp-proof__go" aria-hidden="true"><span className="v8-arrow" /></span>
              </Link>
            ))}
          </div>
        </Wrap>
      </section>

      <Section rule id="what-we-do">
        <Wrap>
          <div className="v8-stack--lg">
            <div className="cmp-intro">
              <div className="v8-head">
                <span className="v8-eyebrow">What we do</span>
                <h2 className="v8-h2">{WORK_LINE}</h2>
              </div>
              <div className="cmp-intro__text">
                <p className="v8-lead">Research areas, not products.</p>
              </div>
            </div>
            <div className="cmp-areas">
              {RESEARCH.map((r) => <PhotoCard key={r.slug} photoKey={r.photo} to={`/research/${r.slug}`} title={r.title} line={r.line} />)}
            </div>
          </div>
        </Wrap>
      </Section>

      <Section rule id="first-product">
        <Wrap>
          <div className="v8-split-sec cmp-product">
            <div className="v8-stack--lg">
              <div className="v8-head">
                <span className="v8-eyebrow">Our first product</span>
                <h2 className="v8-h2">{CONTOUR.name}</h2>
                <p className="v8-lead">{CONTOUR.headline}</p>
              </div>
              <div className="v8-tags cmp-tags">
                <Tag kind="impl">Working in the experiment: signed bindings, ONNX Runtime 1.23.2 on CPU</Tag>
                <Tag kind="meas">Measured: {FACTS.tests.value} experiment tests, pinned network-disabled harness, reproduced by internal automated testing</Tag>
                <Tag kind="prop">Proposed: a Kubernetes collector</Tag>
                <Tag kind="hyp">Hypothesis: release, platform and security engineers</Tag>
              </div>
              <div className="v8-actions">
                <Button to="/contour" arrow>Explore {CONTOUR.name}</Button>
                <Button to="/contour/status" kind="soft">Development status</Button>
              </div>
            </div>
            <Capture name="app-destination-pending" small caption="Inside the controlled ONNX reference experiment. Read-only evidence app." />
          </div>
        </Wrap>
      </Section>

      <Section rule id="people">
        <Wrap>
          <div className="v8-stack--lg">
            <div className="v8-head">
              <span className="v8-eyebrow">People and brands</span>
              <h2 className="v8-h2">Founded by {FOUNDER}. Part of Foremake, Inc.</h2>
            </div>
            <div className="cmp-people">
              <div id="nishanth-dasari" className="v8-box cmp-person">
                <span className="v8-eyebrow">Founder</span>
                <h3 className="v8-h3 cmp-person__name">{FOUNDER}</h3>
                <ul className="cmp-links">
                  <li><External to={LINKEDIN}>Nishanth on LinkedIn</External></li>
                  <li><External to={FOREMAKE_PROFILE}>Nishanth Dasari&apos;s Foremake profile</External></li>
                </ul>
              </div>
              <div id="foremake" className="v8-box cmp-person">
                <span className="v8-eyebrow">Umbrella brand</span>
                <h3 className="v8-h3 cmp-person__name">Foremake, Inc</h3>
                <ul className="cmp-links cmp-links--plain">
                  <li><span>Vraelis</span><small>AI cybersecurity software; Vraelis Contour, its first product, is in private development</small></li>
                  <li><span>Overlym</span><small>A separate fintech venture, in development</small></li>
                </ul>
              </div>
            </div>
          </div>
        </Wrap>
      </Section>

      <Section rule id="how-we-work">
        <Wrap>
          <div className="v8-stack--lg">
            <div className="v8-head">
              <span className="v8-eyebrow">How we work</span>
              <h2 className="v8-h2">Three rules we hold our work to.</h2>
            </div>
            <ol className="cmp-rules">
              {PRINCIPLES.map((p) => (
                <li key={p.n}>
                  <span className="cmp-rules__n">{p.n}</span>
                  <h3 className="v8-h3">{p.title}</h3>
                  <p className="v8-body">{p.body}</p>
                  {p.tags ? (
                    <div className="v8-tags cmp-tags">
                      <Tag kind="impl" /><Tag kind="meas" /><Tag kind="prop" /><Tag kind="hyp" />
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </Wrap>
      </Section>

      <Section rule id="history">
        <Wrap>
          <div className="cmp-history">
            <div className="v8-head cmp-history__head">
              <span className="v8-eyebrow">History</span>
              <h2 className="v8-h2">Our path of progress</h2>
              <TextLink to="/changelog" muted>Open the changelog</TextLink>
            </div>
            <div className="cmp-years">
              <div className="cmp-year">
                <h3 className="cmp-year__label">2026</h3>
                <div>
                  <ol className="cmp-rows">
                    {CURRENT.map((n) => (
                      <li key={n.id}>
                        <Link href={href(`/changelog#${n.id}`)} className="cmp-row">
                          <span className="cmp-row__t">{n.title}</span>
                          <time dateTime={n.date}>{formatDay(n.date)}</time>
                        </Link>
                      </li>
                    ))}
                  </ol>
                  <div className="cmp-earlier">
                    <h4 className="cmp-earlier__t">Earlier product (retired)</h4>
                    <p className="v8-small">The record of the earlier browser-testing product is kept as history on the changelog.</p>
                    <TextLink to="/changelog#earlier-direction" muted>Read the earlier record</TextLink>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Wrap>
      </Section>

      <Section>
        <Wrap>
          <JoinBand />
        </Wrap>
      </Section>
    </div>
  );
}
