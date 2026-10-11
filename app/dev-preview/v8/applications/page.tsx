import { Button, Head, JoinBand, PageHero, PhotoCard, Section, Wrap } from "../_kit/blocks";
import { v8meta } from "../_kit/meta";
import { APPLICATIONS, APPLICATIONS_NOTE, COMPANY_LINE, CONTOUR } from "../_kit/site";
import "../research/research.css";
import "./applications.css";

export const metadata = v8meta({
  title: "Applications",
  description: `${COMPANY_LINE} Intended application areas, not deployments: where models ship as updates into systems someone else operates.`,
  path: "/applications",
});

const MAIN = APPLICATIONS.slice(0, 3);
const ORGS = APPLICATIONS.slice(3);

/** What the areas have in common: the three reasons each area page develops in its own terms. */
const SHARED = [
  { title: "Updates to systems others operate", body: "Models ship as updates into systems that a customer, an operator or a public body runs." },
  { title: "A wrong release is a security event", body: "A release other than the approved one, or one that reached the wrong destination, changes what the system does." },
  { title: "Evidence reviewers can read", body: "Someone outside the engineering team should be able to read what was approved and what the runtime reports." },
];

export default function ApplicationsOverview() {
  return (
    <div className="v8-rx v8-rx--apps">
      <PageHero
        eyebrow="Applications"
        title="Intended for defense, critical infrastructure and autonomous systems."
        lead={`${COMPANY_LINE} In each area, models ship as updates into systems someone else operates, and a wrong or unapproved release is a security event. These are intended application areas, not deployments.`}
        actions={<><Button to="/contact?topic=contour" arrow>Join us</Button><Button to="/contour" kind="soft">{CONTOUR.name}</Button></>}
      />

      <section aria-label="Main application areas" className="rx-areas-sec">
        <Wrap>
          <div className="v8-areas-grid">
            {MAIN.map((a) => <PhotoCard key={a.slug} photoKey={a.photo} to={`/applications/${a.slug}`} title={a.title} line={a.line} />)}
          </div>
        </Wrap>
      </section>

      <Section rule>
        <Wrap>
          <div className="v8-stack--lg">
            <Head eyebrow="Organizations" title="The people who review and ship these systems." lead="Public bodies that oversee AI systems, and the suppliers and integrators who ship model updates into them." />
            <div className="rx-orgs">
              {ORGS.map((a) => <PhotoCard key={a.slug} photoKey={a.photo} to={`/applications/${a.slug}`} title={a.title} line={a.line} />)}
            </div>
          </div>
        </Wrap>
      </Section>

      <Section rule>
        <Wrap>
          <div className="v8-stack--lg">
            <Head eyebrow="What the areas share" title="Why model release integrity matters in all of them." />
            <div className="v8-grid-3 rx-shared">
              {SHARED.map((s, i) => (
                <div key={s.title}>
                  <span className="rx-n" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="v8-h3">{s.title}</h3>
                  <p className="v8-body">{s.body}</p>
                </div>
              ))}
            </div>
            <p className="v8-note"><b>{APPLICATIONS_NOTE}</b> No page here describes a deployment, a customer or a partner. Photographs are licensed editorial context, not product evidence.</p>
          </div>
        </Wrap>
      </Section>

      <Section tight>
        <Wrap>
          <JoinBand />
        </Wrap>
      </Section>
    </div>
  );
}
