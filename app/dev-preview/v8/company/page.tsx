import Link from "next/link";
import type { ReactNode } from "react";
import { Button, Capture, JoinBand, PageHero, PhotoCard, Section, Tag, TextLink, Wrap } from "../_kit/blocks";
import { RiseWords } from "../_kit/client";
import { v8meta } from "../_kit/meta";
import { COMPANY_LINE, CONTOUR, FACTS, FOREMAKE, FOUNDER, RESEARCH, WORK_LINE, href } from "../_kit/site";
import { formatDay } from "../_content/news";
import { CURRENT, DIRECTION_DAY, EARLIER, longDay } from "../changelog/history";
import "./company.css";

export const metadata = v8meta({
  title: "Vraelis | Company and founder Nishanth Dasari",
  description: `${COMPANY_LINE} Founded by ${FOUNDER}. Part of Foremake, the holding company behind Vraelis and Overlym.`,
  path: "/company",
});

// x.ai's /company order: mission h1, proof cards, what we do, people, values ("At our core"), then the year-grouped
// history ("Our path of progress") fed from the same record as /changelog. One h1: the company line. The founder
// keeps the #nishanth-dasari anchor that lib/entity.ts publishes as his schema.org @id. Founder facts and profile
// links are only those already on the live /company page.
const LINKEDIN = "https://www.linkedin.com/in/beamed/";
const FOREMAKE_PROFILE = "https://foremake.com/nishanth";

const PROOF = [
  { title: CONTOUR.name, line: "Model release security, from approval to reported runtime state. In private development.", to: "/contour" },
  { title: "Research", line: "Four workstreams: model integrity, adversarial threats, machine trust and security evidence.", to: "/research" },
  { title: "Applications", line: "Defense, critical infrastructure and autonomous systems, as intended application areas.", to: "/applications" },
  { title: "Changelog", line: "Every dated entry, newest first, with the earlier record kept as history.", to: "/changelog" },
];

const PRINCIPLES = [
  {
    n: "01",
    title: "Implemented and proposed stay apart.",
    body: "Every claim says what it is: working in the experiment, measured, proposed, or a hypothesis. A proposal is never written up as built, and a result inside the experiment is never written up as production readiness.",
    tags: true,
  },
  {
    n: "02",
    title: "Records are kept in order.",
    body: "Observations keep their order and their time, including the ones that could not confirm anything. The changelog keeps its earlier entries too, labelled for what they describe.",
  },
  {
    n: "03",
    title: "The builder is not the only judge.",
    body: `Our own tests are not the last word: ${FACTS.tests.value} ${FACTS.tests.label}. That shows the experiment behaves as specified, not production readiness. A runtime's report of what it loaded is a self-report, and we label it as one.`,
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
        lead={<>Founded by {FOUNDER} and part of Foremake. {CONTOUR.name}, our first product, is in private development.</>}
        actions={<><Button to="/contact?topic=contour" arrow>Join us</Button><Button to="/contact" kind="soft">Contact</Button></>}
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
                <p className="v8-lead">These four are research areas and workstreams, not products. Each has different proof requirements, and the research has to establish where a proposed control works and where it stops.</p>
                <p className="v8-body">Defense, critical infrastructure and autonomous systems are intended application areas. Vraelis has no customer deployments in them.</p>
              </div>
            </div>
            <div className="cmp-areas">
              {RESEARCH.map((r) => <PhotoCard key={r.slug} photoKey={r.photo} to={`/research/${r.slug}`} title={r.title} line={r.line} />)}
            </div>
            <p className="v8-small">Research areas, not products. Photographs are licensed editorial context.</p>
          </div>
        </Wrap>
      </Section>

      <Section rule id="first-product">
        <Wrap>
          <div className="v8-split-sec cmp-product">
            <div className="v8-stack--lg">
              <div className="v8-head">
                <span className="v8-eyebrow">Our first product, in private development</span>
                <h2 className="v8-h2">{CONTOUR.name}</h2>
                <p className="v8-lead">{CONTOUR.headline} {CONTOUR.line}</p>
                <p className="v8-body">Today it is a controlled synthetic ONNX CPU experiment with signed release and approval bindings, runtime policy enforcement and a read-only evidence app over the recorded trace. Our buyer hypothesis is release, platform and security engineers at suppliers and system integrators.</p>
              </div>
              <div className="v8-tags cmp-tags">
                <Tag kind="impl">Working in the experiment: signed bindings, ONNX Runtime 1.23.2 on CPU</Tag>
                <Tag kind="meas">Measured: {FACTS.tests.value} internal tests offline</Tag>
                <Tag kind="prop">Proposed: a Kubernetes collector</Tag>
                <Tag kind="hyp">Hypothesis: who buys it</Tag>
              </div>
              <div className="v8-actions">
                <Button to="/contour" arrow>Explore {CONTOUR.name}</Button>
                <Button to="/contour/status" kind="soft">Development status</Button>
              </div>
            </div>
            <Capture name="app-destination-pending" small />
          </div>
        </Wrap>
      </Section>

      <Section rule id="people">
        <Wrap>
          <div className="v8-stack--lg">
            <div className="v8-head">
              <span className="v8-eyebrow">People and ownership</span>
              <h2 className="v8-h2">Founded by {FOUNDER}. Part of Foremake.</h2>
            </div>
            <div className="cmp-people">
              <div id="nishanth-dasari" className="v8-box cmp-person">
                <span className="v8-eyebrow">Founder</span>
                <h3 className="v8-h3 cmp-person__name">{FOUNDER}</h3>
                <p className="v8-body">{FOUNDER} is the founder of Vraelis. {COMPANY_LINE}</p>
                <ul className="cmp-links">
                  <li><External to={LINKEDIN}>Nishanth on LinkedIn</External></li>
                  <li><External to={FOREMAKE_PROFILE}>Nishanth Dasari&apos;s Foremake profile</External></li>
                </ul>
              </div>
              <div id="foremake" className="v8-box cmp-person">
                <span className="v8-eyebrow">Holding company</span>
                <h3 className="v8-h3 cmp-person__name">Foremake</h3>
                <p className="v8-body">{FOREMAKE}</p>
                <ul className="cmp-links cmp-links--plain">
                  <li><span>Vraelis</span><small>This company</small></li>
                  <li><span>Overlym</span><small>A separate Foremake company</small></li>
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
              <p className="v8-body">Every dated entry, newest first. Entries before {longDay(DIRECTION_DAY)} describe the earlier browser-testing product and are kept as history.</p>
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
                    <h4 className="cmp-earlier__t">Earlier direction</h4>
                    <p className="v8-small">These entries describe the earlier browser-testing product.</p>
                  </div>
                  <ol className="cmp-rows cmp-rows--earlier">
                    {EARLIER.map((e) => (
                      <li key={e.id}>
                        <Link href={href(`/changelog#${e.id}`)} className="cmp-row">
                          <span className="cmp-row__t">{e.title}</span>
                          <time dateTime={e.date}>{formatDay(e.date)}</time>
                        </Link>
                      </li>
                    ))}
                  </ol>
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
