import Link from "next/link";
import { AutoVideo } from "../_kit/client";
import { Button, Head, JoinBand, PageHero, PhotoCard, Section, Wrap } from "../_kit/blocks";
import { v8meta } from "../_kit/meta";
import { APPLICATIONS, COMPANY_LINE, CONTOUR, href } from "../_kit/site";
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
  "Updates to systems others operate",
  "An unexpected release can create security and operational risk",
  "Evidence reviewers can read",
];

export default function ApplicationsOverview() {
  return (
    <div className="v8-rx v8-rx--apps">
      <PageHero
        eyebrow="Applications"
        title="Intended for defense, critical infrastructure and autonomous systems."
        lead="Model integrity and release evidence across the systems people depend on."
        actions={<><Button to="/contact?topic=contour" arrow>Join us</Button><Button to="/contour" kind="soft">{CONTOUR.name}</Button></>}
        aside={
          // Existing civilian context film; source and licensing records remain at /image-sources.
          <figure className="rx-film">
            <div className="rx-film__frame">
              <AutoVideo src="/home/systems-film-civil.mp4" poster="/home/systems-poster-civil.jpg" label="Editorial footage: factory robots, a power substation, a civilian drone, a solar farm and software on screen." />
            </div>
          </figure>
        }
      />

      <section aria-label="Main application areas" className="rx-areas-sec">
        <Wrap>
          <div className="v8-areas-grid">
            {MAIN.map((a) => a.slug === "defense" ? (
              <Link key={a.slug} href={href(`/applications/${a.slug}`)} className="v8-box rx-area-text">
                <b className="v8-h3">{a.title}</b>
                <span className="v8-body">{a.line}</span>
                <span className="v8-under">Explore defense →</span>
              </Link>
            ) : <PhotoCard key={a.slug} photoKey={a.photo} to={`/applications/${a.slug}`} title={a.title} line={a.line} />)}
          </div>
        </Wrap>
      </section>

      <Section rule>
        <Wrap>
          <div className="v8-stack--lg">
            <Head eyebrow="Organizations" title="The people who review and ship these systems." />
            <div className="rx-orgs">
              {ORGS.map((a) => <PhotoCard key={a.slug} photoKey={a.photo} to={`/applications/${a.slug}`} title={a.title} line={a.line} />)}
            </div>
          </div>
        </Wrap>
      </Section>

      <Section rule>
        <Wrap>
          <div className="v8-stack--lg">
            <Head eyebrow="What the areas share" title="Why release integrity matters in each." />
            <div className="v8-grid-3 rx-shared">
              {SHARED.map((s, i) => (
                <div key={s}>
                  <span className="rx-n" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="v8-h3">{s}</h3>
                </div>
              ))}
            </div>
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
