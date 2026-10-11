import { Head, PageHero, PhotoCard, Section, Terms, TextLink, Wrap, Button } from "../_kit/blocks";
import { v8meta } from "../_kit/meta";
import { CONTOUR, RESEARCH, WORK_LINE } from "../_kit/site";
import { ResearchBand } from "./parts";

export const metadata = v8meta({
  title: "Research",
  description: `${WORK_LINE} Four research workstreams, not products, and how they connect to ${CONTOUR.name}.`,
  path: "/research",
});

/** How each area feeds Vraelis Contour. "main" areas it draws on directly; "informs" areas shape it. */
const MAP: { slug: string; rel: "main" | "informs"; text: string }[] = [
  { slug: "model-integrity", rel: "main", text: "Release identity, bound approval, approved against reported" },
  { slug: "security-evidence", rel: "main", text: "Ordered observations, including unavailable evidence" },
  { slug: "machine-trust", rel: "informs", text: "Separate approval roles, a policy checked where it serves" },
  { slug: "adversarial-threats", rel: "informs", text: "Which supply paths a release check covers" },
];

export default function ResearchOverview() {
  return (
    <div className="v8-rx v8-rx--research">
      <PageHero
        eyebrow="Research"
        title="Research in four areas of AI security."
        lead={`${WORK_LINE} Workstreams, not products.`}
        actions={<><Button to="/contact?topic=research" arrow>Research collaboration</Button><Button to="/contour" kind="soft">Vraelis Contour</Button></>}
      />

      <section aria-label="Research areas" className="rx-areas-sec">
        <Wrap>
          <div className="rx-areas">
            {RESEARCH.map((r) => (
              <PhotoCard key={r.slug} photoKey={r.photo} to={`/research/${r.slug}`} title={r.title} line={r.line} />
            ))}
          </div>
        </Wrap>
      </section>

      <Section rule>
        <Wrap>
          <div className="v8-split-sec rx-connect">
            <div className="v8-stack--lg">
              <Head eyebrow="Research and product" title={`How the research connects to ${CONTOUR.name}.`} />
              <div className="v8-actions">
                <TextLink to="/contour">Explore {CONTOUR.name}</TextLink>
              </div>
            </div>
            <figure className="rx-map">
              <div className="rx-map__box">
                <div className="rx-map__root"><span>{CONTOUR.name}</span><small>In private development</small></div>
                <ul>
                  {MAP.map((m) => {
                    const r = RESEARCH.find((x) => x.slug === m.slug)!;
                    return (
                      <li key={m.slug} data-rel={m.rel}>
                        <div>
                          <b>{r.title}</b>
                          <small>{m.rel === "main" ? "Draws on directly" : "Informs"}</small>
                        </div>
                        <p>{m.text}</p>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <figcaption>Diagram, not a product architecture.</figcaption>
            </figure>
          </div>
        </Wrap>
      </Section>

      <Section rule label="Terms">
        <Wrap>
          <div className="v8-stack--lg">
            <div className="v8-head"><span className="v8-eyebrow">Terms</span><h2 className="v8-h2">What each check means, and where it stands.</h2></div>
            <Terms />
          </div>
        </Wrap>
      </Section>

      <Section tight>
        <Wrap>
          <ResearchBand />
        </Wrap>
      </Section>
    </div>
  );
}
