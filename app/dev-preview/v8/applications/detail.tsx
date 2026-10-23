import { Band, Button, Capture, CAPTURES, Head, JoinBand, PageHero, Section, Tag, TextLink, Wrap, cx } from "../_kit/blocks";
import { APPLICATIONS, CONTOUR, KIND_LABEL, WORKFLOW, type Kind } from "../_kit/site";
import { FramedPhoto, NotList, RelatedResearch, Split } from "../research/parts";
import type { AppPage } from "./content";
import { DefensePhoto } from "./defense-media";
import "./applications.css";

// One application area's page: a concise hero, optional contextual photograph, why release integrity
// matters there, how Vraelis Contour is intended to apply (the five workflow steps, each tagged with what exists in
// the experiment), Vraelis's position (defense only), what we do not claim, related research, and Join us.
/** Step tags say their status in words ("Proposed: customer runtime adapters"), so no legend is needed. */
const tagText = (kind: Kind, label: string) => {
  const l = label.replace(/ in the experiment$/, "");
  return `${KIND_LABEL[kind]}: ${/^[A-Z][a-z]/.test(l) ? l.charAt(0).toLowerCase() + l.slice(1) : l}`;
};

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
        actions={<><Button to={contactTo} arrow>Join Us</Button><Button to="/contour" kind="soft">{CONTOUR.name}</Button></>}
        aside={page.slug === "defense" ? <DefensePhoto /> : page.handoff ? (
          // The handoff takes the hero media's place, stacked under the introduction (founder, 2026-10-17: option A).
          <div id="contour" className="rx-handoff-wrap">
            <div className="v8-head--row v8-head">
              <Head eyebrow="The handoff" title={page.handoff.title} lead={page.handoff.lead} />
              <TextLink to="/contour#how">How {CONTOUR.name} works</TextLink>
            </div>
            <ol className="rx-handoff">
              {page.handoff.steps.map((s, i) => (
                <li key={s.title}>
                  <span className="rx-n" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="v8-h3">{s.title}</h3>
                  <div className="rx-handoff__shot">
                    {s.shots.map((n) => <Capture key={n} name={n} caption={false} style={{ maxWidth: CAPTURES[n].w }} />)}
                  </div>
                  <p className="v8-body">{s.body}</p>
                  <p className="rx-handoff__decides"><b>{s.term}:</b> {s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        ) : page.heroCapture ? (
          <div className="rx-hero-capture">
            <Capture name={page.heroCapture.wide} caption={false} />
            <Capture name={page.heroCapture.narrow} caption={false} />
          </div>
        ) : <FramedPhoto photoKey={"heroPhoto" in area ? area.heroPhoto : area.photo} />}
      />

      <Section rule id="why">
        <Wrap>
          <div className="v8-stack--lg">
            <Head eyebrow="Why it matters" title={page.whyTitle} />
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

      {page.handoff ? null : <Section rule id="contour">
        <Wrap>
          <div className="v8-stack--lg">
            <div className="v8-head--row v8-head">
              <Head eyebrow={`How ${CONTOUR.name} would apply`} title={page.review?.title ?? "Five steps, release to record."} lead={page.review?.lead} />
              <TextLink to="/contour#how">How {CONTOUR.name} works</TextLink>
            </div>
            <div className={cx("rx-apply", wide && "rx-apply--wide")}>
              <ol className="rx-steps">
                {page.review ? page.review.steps.map((step, i) => (
                  <li key={step.title}>
                    <span className="rx-n" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </li>
                )) : WORKFLOW.map((w, i) => (
                  <li key={w.n}>
                    <span className="rx-n" aria-hidden="true">{w.n}</span>
                    <h3>{w.title}</h3>
                    {page.steps[i] ? <p>{page.steps[i]}</p> : null}
                    <div className="rx-tags">
                      {w.kinds.map(([k, label]) => <Tag key={label} kind={k}>{tagText(k, label)}</Tag>)}
                    </div>
                  </li>
                ))}
              </ol>
              <div className="rx-apply__media">
                {/* Never wider than its own pixels: a small crop beside the steps stays sharp. */}
                <Capture name={page.capture} style={{ maxWidth: cap.w }} />
              </div>
            </div>
            {page.phone ? (
              // Phones: the capture above is unreadable there, so legible crops of the same screen and its values as text.
              <div className="rx-phone">
                {page.phone.shots.map((n) => <Capture key={n} name={n} caption={false} style={{ maxWidth: CAPTURES[n].w }} />)}
                <dl className="rx-values">
                  {page.phone.values.map((v) => <div key={v.term}><dt>{v.term}</dt><dd>{v.text}</dd></div>)}
                </dl>
              </div>
            ) : null}
          </div>
        </Wrap>
      </Section>}

      {page.stance ? (
        <Section rule id="position">
          <Wrap>
            <div className="v8-stack--lg">
              <Head eyebrow="Our position" title={page.stance.title} lead={page.stance.lead || undefined} />
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
          <Split head={<Head eyebrow="Limits" title="What we do not claim." />}>
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
            <Band title={page.contact.title} lead={page.contact.lead} actions={<><Button to={page.contact.to} arrow>Join Us</Button><Button to="/contour/status" kind="soft">Development status</Button></>} />
          ) : (
            <JoinBand />
          )}
        </Wrap>
      </Section>
    </div>
  );
}
