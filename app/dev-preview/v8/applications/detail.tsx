import { Band, Button, Capture, CAPTURES, Head, JoinBand, PageHero, Section, Tag, TextLink, Wrap, cx } from "../_kit/blocks";
import { APPLICATIONS, APPLICATIONS_NOTE, CONTOUR, WORKFLOW } from "../_kit/site";
import { FramedPhoto, NotList, RelatedResearch, Split } from "../research/parts";
import type { AppPage } from "./content";
import "./applications.css";

// One application area's page: hero with its photograph, the "intended, not deployed" note, why release integrity
// matters there, how Vraelis Contour is intended to apply (the five workflow steps, each tagged with what exists in
// the experiment), Vraelis's position (defense only), what we do not claim, related research, and Join us.
export function AppDetail({ page }: { page: AppPage }) {
  const area = APPLICATIONS.find((a) => a.slug === page.slug)!;
  const cap = CAPTURES[page.capture];
  // A full app screen or a strip-shaped crop reads best full width under the steps; other crops sit beside them.
  const wide = page.capture.startsWith("app-") || cap.w / cap.h > 3;
  const others = APPLICATIONS.filter((a) => a.slug !== page.slug);
  const contactTo = page.contact?.to ?? "/contact?topic=contour";
  return (
    <div className="v8-rx v8-rx--apps">
      <PageHero
        eyebrow={area.title}
        title={page.title}
        lead={page.lead}
        actions={<><Button to={contactTo} arrow>Join us</Button><Button to="/contour" kind="soft">{CONTOUR.name}</Button></>}
        aside={<FramedPhoto photoKey={area.photo} />}
      />

      <section className="rx-notebar" aria-label="About this page">
        <Wrap>
          <p className="v8-note"><b>{APPLICATIONS_NOTE}</b> Nothing on this page describes a deployment, a customer or a partner.</p>
        </Wrap>
      </section>

      <Section rule id="why">
        <Wrap>
          <div className="v8-stack--lg">
            <Head eyebrow="Why model release integrity matters here" title={page.whyTitle} />
            <div className="v8-grid-3 rx-why">
              {page.why.map((w, i) => (
                <div key={w.title} className="v8-box">
                  <span className="rx-n" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="v8-h3">{w.title}</h3>
                  <p className="v8-body">{w.body}</p>
                </div>
              ))}
            </div>
            {page.hypothesis ? (
              <p className="rx-hyp"><Tag kind="hyp" /><span>{page.hypothesis}</span></p>
            ) : null}
          </div>
        </Wrap>
      </Section>

      <Section rule id="contour">
        <Wrap>
          <div className="v8-stack--lg">
            <div className="v8-head--row v8-head">
              <Head
                eyebrow={`How ${CONTOUR.name} is intended to apply`}
                title="Five steps, from release identity to preserved evidence."
                lead={`Intended, not deployed. The labels mark what works today inside the controlled synthetic ONNX CPU experiment behind ${CONTOUR.name}, and what is only proposed.`}
              />
              <TextLink to="/contour#how">How {CONTOUR.name} works</TextLink>
            </div>
            <div className={cx("rx-apply", wide && "rx-apply--wide")}>
              <ol className="rx-steps">
                {WORKFLOW.map((w, i) => (
                  <li key={w.n}>
                    <span className="rx-n" aria-hidden="true">{w.n}</span>
                    <h3>{w.title}</h3>
                    <p>{page.steps[i]}</p>
                    <div className="rx-tags">
                      {w.kinds.map(([k, label]) => <Tag key={label} kind={k}>{label}</Tag>)}
                    </div>
                  </li>
                ))}
              </ol>
              <div className="rx-apply__media">
                <Capture name={page.capture} />
              </div>
            </div>
          </div>
        </Wrap>
      </Section>

      {page.stance ? (
        <Section rule id="position">
          <Wrap>
            <div className="v8-stack--lg">
              <Head eyebrow="Our position" title={page.stance.title} lead={page.stance.lead} />
              <div className="v8-grid-3">
                {page.stance.cards.map((c) => (
                  <div key={c.title} className="v8-box rx-stance">
                    <h3 className="v8-h3">{c.title}</h3>
                    <p className="v8-body">{c.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </Wrap>
        </Section>
      ) : null}

      <Section rule id="limits">
        <Wrap>
          <Split head={<Head eyebrow="Limits" title="What we do not claim." lead={`${CONTOUR.name} is in private development, and product access is closed.`} />}>
            <NotList items={page.notClaimed} />
            <div className="v8-actions" style={{ marginTop: 22 }}>
              <TextLink to="/contour/status">Development status</TextLink>
            </div>
          </Split>
        </Wrap>
      </Section>

      <Section rule>
        <Wrap>
          <div className="v8-stack--lg">
            <RelatedResearch slugs={page.related} />
            <nav className="rx-others" aria-label="Other application areas">
              <span className="v8-small">Other application areas</span>
              <div className="rx-links">
                {others.map((o) => <TextLink key={o.slug} to={`/applications/${o.slug}`} muted>{o.title}</TextLink>)}
              </div>
            </nav>
          </div>
        </Wrap>
      </Section>

      <Section tight>
        <Wrap>
          {page.contact ? (
            <Band title={page.contact.title} lead={page.contact.lead} actions={<><Button to={page.contact.to} arrow>Join us</Button><Button to="/contour/status" kind="soft">Development status</Button></>} />
          ) : (
            <JoinBand />
          )}
        </Wrap>
      </Section>
    </div>
  );
}
