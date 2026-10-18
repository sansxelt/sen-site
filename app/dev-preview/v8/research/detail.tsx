import { Button, Capture, CAPTURES, Head, PageHero, Section, TextLink, Wrap, cx } from "../_kit/blocks";
import { RESEARCH } from "../_kit/site";
import type { ResearchPage } from "./content";
import { Flow, FramedPhoto, KindList, OpenGrid, Questions, RelatedResearch, ResearchBand, Split } from "./parts";

// One research area's page: hero with its photograph, what we study, what exists today, open questions, related
// links, and the research band. The copy lives in content.ts.
export function ResearchDetail({ page }: { page: ResearchPage }) {
  const area = RESEARCH.find((r) => r.slug === page.slug)!;
  const ex = page.exists;
  // A full app screen or a strip-shaped crop reads best full width under the list; other crops sit beside it.
  const wide = ex.kind === "experiment" && (ex.capture.startsWith("app-") || CAPTURES[ex.capture].w / CAPTURES[ex.capture].h > 3);
  return (
    <div className="v8-rx v8-rx--research">
      <PageHero
        eyebrow={area.title}
        title={page.title}
        lead={page.lead}
        actions={<><Button to="/contact?topic=research" arrow>Research collaboration</Button><Button to="/research" kind="soft">All research areas</Button></>}
        aside={<FramedPhoto photoKey={area.heroPhoto} />}
      />

      <Section rule id="study">
        <Wrap>
          {page.studyAs === "flow" ? (
            <div className="v8-stack--lg">
              <Head eyebrow="What we study" title={page.studyTitle} />
              <Flow items={page.study} caption={page.studyCaption} />
            </div>
          ) : (
            <Split head={<Head eyebrow="What we study" title={page.studyTitle} />}>
              <Questions items={page.study} />
            </Split>
          )}
        </Wrap>
      </Section>

      <Section rule id="today">
        <Wrap>
          {ex.kind === "experiment" ? (
            <div className={cx("rx-exists", wide && "rx-exists--wide")}>
              <div className="v8-stack--lg">
                <Head eyebrow="What exists today" title={ex.title} lead={ex.lead} />
                <KindList items={ex.items} />
                <div className="v8-actions">
                  <TextLink to="/contour/status">Development status</TextLink>
                </div>
              </div>
              <div className="rx-exists__media">
                <Capture name={ex.capture} />
              </div>
            </div>
          ) : (
            <Split head={<Head eyebrow="What exists today" title={ex.title} />}>
              <div className="rx-prose">
                {ex.paragraphs.map((p) => <p key={p}>{p}</p>)}
                <div className="v8-actions">
                  <TextLink to="/contour/status">Vraelis Contour development status</TextLink>
                </div>
              </div>
            </Split>
          )}
        </Wrap>
      </Section>

      <Section rule id="open">
        <Wrap>
          <Split head={<Head eyebrow="Open questions" title="What is still open." />}>
            <OpenGrid items={page.open} />
          </Split>
        </Wrap>
      </Section>

      <Section rule>
        <Wrap>
          <RelatedResearch slugs={page.related} links={page.links} />
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
