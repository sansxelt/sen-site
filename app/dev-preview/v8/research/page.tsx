import { Head, PageHero, PhotoCard, Section, Tag, TextLink, Wrap, Button } from "../_kit/blocks";
import { v8meta } from "../_kit/meta";
import { CONTOUR, FACTS, RESEARCH, STATUS, WORK_LINE, type Kind } from "../_kit/site";
import { ResearchBand } from "./parts";

export const metadata = v8meta({
  title: "Research",
  description: `${WORK_LINE} Four research workstreams, not products, and how they connect to ${CONTOUR.name}.`,
  path: "/research",
});

/** How each area feeds Vraelis Contour. "main" areas it draws on directly; "informs" areas shape it. */
const MAP: { slug: string; rel: "main" | "informs"; text: string }[] = [
  { slug: "model-integrity", rel: "main", text: "Release identity by digest, approval bound to the release and its destination, and the comparison with what the runtime reports loading." },
  { slug: "security-evidence", rel: "main", text: "Recorded observations kept in order, including unavailable evidence and the explicit reload that followed." },
  { slug: "machine-trust", rel: "informs", text: "Separate approval roles, and a policy checked where the model is served." },
  { slug: "adversarial-threats", rel: "informs", text: "Which supply paths a release check covers, and which it does not." },
];

/** How every research page labels a statement. One sentence per kind, examples from the status ledger. */
const LEGEND: { kind: Kind; text: string }[] = [
  { kind: "impl", text: "Runs today inside the controlled synthetic ONNX CPU experiment behind Vraelis Contour. Not a deployment." },
  { kind: "meas", text: `A number with its conditions. For example, ${FACTS.tests.value} ${FACTS.tests.label}.` },
  { kind: "prop", text: `Specified or planned, not built. For example, ${STATUS.building[0].charAt(0).toLowerCase()}${STATUS.building[0].slice(1)}.` },
  { kind: "hyp", text: "What we believe and are testing. A hypothesis is not evidence." },
  { kind: "not", text: "What we do not claim: deployments, customers, certification or hardware attestation." },
];

export default function ResearchOverview() {
  return (
    <div className="v8-rx v8-rx--research">
      <PageHero
        eyebrow="Research"
        title="Research in four areas of AI security."
        lead={`${WORK_LINE} They are research workstreams, not products. Each page says what we study, what exists today and what is still open.`}
        actions={<><Button to="/contact?topic=research" arrow>Research collaboration</Button><Button to="/contour" kind="soft">Vraelis Contour</Button></>}
      />

      <section aria-label="Research areas" className="rx-areas-sec">
        <Wrap>
          <div className="rx-areas">
            {RESEARCH.map((r) => (
              <PhotoCard key={r.slug} photoKey={r.photo} to={`/research/${r.slug}`} title={r.title} line={r.line} />
            ))}
          </div>
          <p className="v8-small" style={{ marginTop: 14 }}>Four research areas, not products. Photographs are licensed editorial context, not product evidence.</p>
        </Wrap>
      </section>

      <Section rule>
        <Wrap>
          <div className="v8-split-sec rx-connect">
            <div className="v8-stack--lg">
              <Head eyebrow="Research and product" title={`How the research connects to ${CONTOUR.name}.`} />
              <div className="rx-prose">
                <p>{CONTOUR.name} is our first product, in private development. It draws mainly on model integrity and security evidence: naming exactly which release was approved, and keeping a record a person can read of what the runtime reported.</p>
                <p>Adversarial threats and machine trust inform it. They shape which supply paths a release check should cover, and where approval and permission boundaries belong. Neither is built into a product.</p>
              </div>
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
              <figcaption>Diagram. A solid connector means {CONTOUR.name} draws on the area directly; a dashed one means the area informs it. Not a product architecture.</figcaption>
            </figure>
          </div>
        </Wrap>
      </Section>

      <Section rule>
        <Wrap>
          <div className="v8-stack--lg">
            <Head
              eyebrow="How to read these pages"
              title="Research topics are not claims of deployed protection."
              lead="Where something runs today, it runs inside one controlled synthetic experiment in private development. Each page labels what exists with one of these."
            />
            <div className="rx-legend">
              {LEGEND.map((l) => (
                <div key={l.kind}>
                  <Tag kind={l.kind} />
                  <p>{l.text}</p>
                </div>
              ))}
            </div>
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
