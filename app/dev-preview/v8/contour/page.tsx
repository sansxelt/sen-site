import Link from "next/link";
import { Chapters, RiseWords } from "../_kit/client";
import { Button, CAPTURES, Faq, Terms, JoinBand, Ledger, PageHero, Section, Tag, TextLink, Wrap, captureSrc, type CaptureName } from "../_kit/blocks";
import { v8meta } from "../_kit/meta";
import { CAPTURE_CAPTION, CONTOUR, KIND_LABEL, OBSERVATIONS, WORKFLOW, href, type Kind } from "../_kit/site";
import { HeroStage, ObservationTabs, type Lift, type ObservationView } from "./contour-client";
import "./contour.css";

export const metadata = v8meta({
  title: `${CONTOUR.name} | ${CONTOUR.headline.replace(/\.$/, "")}`,
  description: `${CONTOUR.line} ${CONTOUR.name} is in private development: today it runs inside a controlled ONNX reference experiment.`,
  path: "/contour",
});

// Gusto's way of showing a product (one central interface, a few details lifted out of it, readable workflow
// chapters, restrained motion) with x.ai's sticky chapters. Every product visual is a real capture of the
// read-only evidence app over the recorded trace; nothing on this page is a rebuilt interface.

/* Details lifted out of the hero recording, each shown only while the screen is on the observation it was
   cropped from (see HeroStage). Observation 02: cpu-2 approved, cpu-1 still loaded, policy satisfied.
   The policy strip is also true of 01 and 03; in 04 the policy cannot be checked, and the loaded card says so. */
const LIFTS: { name: CaptureName; slot: Lift["slot"]; during: string[] }[] = [
  { name: "crop-approved-cpu2", slot: "a", during: ["02"] },
  { name: "crop-loaded-cpu1", slot: "b", during: ["02"] },
  { name: "crop-loaded-unavailable", slot: "b", during: ["04"] },
  { name: "crop-policy", slot: "c", during: ["01", "02", "03"] },
];

/* Observation times and the reason code, as the captured app shows them (trace captured 2026-10-10). */
const RECORDED: Record<string, { time: string; reason?: string }> = {
  "01": { time: "07:41:29.606" },
  "02": { time: "07:41:29.613" },
  "03": { time: "07:41:29.619" },
  "04": { time: "07:41:29.723", reason: "RUNTIME_UNAVAILABLE" },
};

/** A workflow tag says its status in words: "Working in the experiment: signed bindings", "Proposed: ...". */
const tagText = (kind: Kind, label: string) => {
  const l = label.replace(/ in the experiment$/, "");
  return `${KIND_LABEL[kind]}: ${/^[A-Z][a-z]/.test(l) ? l.charAt(0).toLowerCase() + l.slice(1) : l}`;
};

/** One short line per workflow step; the tags under each carry what works and what is proposed. */
const STEP_LINE: Record<string, string> = {
  "01": "Model, preprocessing and configuration, by digest.",
  "02": "The exact release, where it may run, and an age limit.",
  "03": "The runtime checks the policy before it serves.",
  "04": "Approved beside reported loaded, field by field.",
  "05": "Every observation, including the ones that confirm nothing.",
};

const FOR = [
  { t: "Release engineers", b: "which model ships, and where" },
  { t: "Platform engineers", b: "the runtime that receives it" },
  { t: "Security engineers", b: "the record of what was approved and loaded" },
];
const NOT = [
  { t: "No verdict on model behaviour.", b: "A signature endorses bytes, not behaviour." },
  { t: "No permission to change a customer's system.", b: "That stays the customer's decision." },
];

export default function ContourPage() {
  const observations: ObservationView[] = OBSERVATIONS.map((o) => {
    const c = CAPTURES[o.shot];
    return {
      n: o.n, title: o.title, state: o.state, tone: o.tone, line: o.line, ...RECORDED[o.n],
      img: { src: captureSrc(o.shot), srcSet: `${captureSrc(o.shot, true)} 1200w, ${captureSrc(o.shot)} 2400w`, alt: c.alt, w: c.w, h: c.h },
    };
  });

  return (
    <div className="ct-page">
      <PageHero
        center
        eyebrow={CONTOUR.name}
        title={<RiseWords text={CONTOUR.headline} />}
        lead={CONTOUR.line}
        actions={<>
          <Button to="/contact?topic=contour" size="lg" arrow>Join us</Button>
          <Button to="/docs" kind="soft" size="lg">Read the documentation</Button>
        </>}
      />

      <section aria-label="The Vraelis Contour evidence app" className="ct-hero-stage">
        <Wrap>
          <div className="v8-fade" style={{ ["--d" as string]: ".45s" }}>
            <HeroStage
              still={{ src: captureSrc("app-destination-pending"), srcSet: `${captureSrc("app-destination-pending", true)} 1200w, ${captureSrc("app-destination-pending")} 2400w`, alt: CAPTURES["app-destination-pending"].alt, w: CAPTURES["app-destination-pending"].w, h: CAPTURES["app-destination-pending"].h, obs: "02" }}
              lifts={LIFTS.map((l) => ({ src: captureSrc(l.name), w: CAPTURES[l.name].w, h: CAPTURES[l.name].h, slot: l.slot, during: l.during }))}
              caption={<><span>{CAPTURE_CAPTION}</span><TextLink to="/contour#observations" muted>The four observations</TextLink></>}
            />
          </div>
        </Wrap>
      </section>

      <Section id="how" rule>
        <Wrap>
            <Chapters
              head={<div className="v8-head"><span className="v8-eyebrow">Workflow</span><h2 className="v8-h2">How it works</h2></div>}
              items={WORKFLOW.map((s) => {
                const c = CAPTURES[s.shot];
                return {
                  n: s.n,
                  title: s.title,
                  body: STEP_LINE[s.n],
                  tags: <Tag kind={s.kinds[0][0]}>{tagText(s.kinds[0][0], s.kinds[0][1])}</Tag>,
                  image: { src: captureSrc(s.shot), alt: c.alt, w: c.w, h: c.h },
                };
              })}
            />
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

      <Section id="observations" rule>
        <Wrap>
          <div className="v8-stack--lg">
            <div className="v8-head">
              <span className="v8-eyebrow">Recorded evidence</span>
              <h2 className="v8-h2">Four recorded observations</h2>
              <p className="v8-lead">One captured run, 10 October 2026. Each report is a worker self-report.</p>
            </div>
            <ObservationTabs items={observations} label="Recorded observations" />
          </div>
        </Wrap>
      </Section>

      <Section rule>
        <Wrap>
          <div className="ct-two">
            <div className="ct-col">
              <div className="v8-head">
                <span className="v8-eyebrow">Audience</span>
                <h2 className="v8-h2">Who it is for</h2>
              </div>
              <ul className="ct-list">
                {FOR.map((f) => <li key={f.t}><b>{f.t}:</b> {f.b}</li>)}
              </ul>
              <p className="ct-aside"><Tag kind="hyp" /> At suppliers and system integrators. Not a customer list.</p>
            </div>
            <div className="ct-col">
              <div className="v8-head">
                <span className="v8-eyebrow">Scope</span>
                <h2 className="v8-h2">What it does not do</h2>
              </div>
              <ul className="ct-list ct-list--not">
                {NOT.map((n) => <li key={n.t}><b>{n.t}</b> {n.b}</li>)}
              </ul>
            </div>
          </div>
        </Wrap>
      </Section>

      <Section rule>
        <Wrap>
          <div className="v8-stack--lg">
            <div className="v8-head--row v8-head">
              <div className="v8-head" style={{ maxWidth: 640 }}>
                <span className="v8-eyebrow">Where we are</span>
                <h2 className="v8-h2">Where it stands</h2>
              </div>
              <TextLink to="/contour/status">Development status and sources</TextLink>
            </div>
            <Ledger />
          </div>
        </Wrap>
      </Section>

      <Section rule>
        <Wrap>
          <Faq
            title={<>Questions about {CONTOUR.name}</>}
            items={[
              { q: `Is ${CONTOUR.name} available?`, a: <>Not publicly. It is built for release, platform and security engineers at suppliers and system integrators. <Link className="v8-under" href={href("/contact?topic=contour")}>Join us</Link> to tell us how you release models.</> },
              { q: "Does it roll back automatically?", a: "No. Baseline mode serves what it loaded until an explicit, recorded reload. The experiment also has a reconcile mode." },
              { q: "Where is the source?", a: "Private. This site shows recorded evidence and captures of the evidence app." },
            ]}
          />
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
