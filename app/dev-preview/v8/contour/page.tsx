import Link from "next/link";
import { Chapters, RiseWords } from "../_kit/client";
import { Button, CAPTURES, Faq, JoinBand, Ledger, PageHero, Section, Tag, TextLink, Wrap, captureSrc, type CaptureName } from "../_kit/blocks";
import { v8meta } from "../_kit/meta";
import { CAPTURE_CAPTION, CAPTURE_SCOPE, CONTOUR, KIND_LABEL, OBSERVATIONS, WORKFLOW, href, type Kind } from "../_kit/site";
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

const FOR = [
  "Release engineers who decide which model, preprocessing and configuration ship, and where.",
  "Platform engineers who own the runtime that receives a release.",
  "Security engineers who need a record of what was approved, what was reported loaded, and what could not be confirmed.",
];
const NOT = [
  { t: "It does not attest hardware.", b: "There is no hardware attestation. The host and the worker are trusted." },
  { t: "It does not independently observe a cluster.", b: "Runtime reports are worker self-reports from the managed session." },
  { t: "It does not establish that a model behaves well.", b: "A signature authenticates an endorsement of particular bytes, not benign behaviour." },
  { t: "It does not grant a supplier permission to change a customer's system.", b: "A supplier's signature says who endorsed a release. Whether it may change a customer's system is the customer's decision." },
  { t: "It does not support other runtimes.", b: "In the experiment, only ONNX Runtime 1.23.2 on CPU. Adapters for customer runtimes are not built." },
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
        lead={<>{CONTOUR.line} {CONTOUR.name} is in private development, and product access is closed.</>}
        actions={<>
          <Button to="/contact?topic=contour" size="lg" arrow>Join us</Button>
          <Button to="/docs" kind="soft" size="lg">Read the documentation</Button>
        </>}
      />

      <section aria-label="The Vraelis Contour evidence app" className="ct-hero-stage">
        <Wrap>
          <div className="v8-fade" style={{ ["--d" as string]: ".45s" }}>
            <HeroStage
              video={{
                src: "/v8/contour/contour-observations.mp4",
                webm: "/v8/contour/contour-observations.webm",
                poster: "/v8/contour/contour-observations-poster.webp",
                label: "Recording of the Vraelis Contour evidence app stepping through the four recorded observations: matched, reload pending, matched after an explicit reload, and evidence unavailable.",
              }}
              lifts={LIFTS.map((l) => ({ src: captureSrc(l.name), w: CAPTURES[l.name].w, h: CAPTURES[l.name].h, slot: l.slot, during: l.during }))}
              caption={<><span>{CAPTURE_CAPTION}</span><TextLink to="/contour#observations" muted>The four observations</TextLink></>}
            />
          </div>
        </Wrap>
      </section>

      <Section id="how" rule>
        <Wrap>
          <div className="v8-stack--lg">
            <div className="v8-head">
              <span className="v8-eyebrow">Workflow</span>
              <h2 className="v8-h2">How it works</h2>
              <p className="v8-lead">Five steps, from naming the exact release to keeping the record of what happened. Each step says what works in the experiment and what is only proposed.</p>
            </div>
            <Chapters
              caption={<span>{CAPTURE_CAPTION}</span>}
              items={WORKFLOW.map((s) => {
                const c = CAPTURES[s.shot];
                return {
                  n: s.n,
                  title: s.title,
                  body: s.body,
                  tags: <>{s.kinds.map(([k, label]) => <Tag key={label} kind={k}>{tagText(k, label)}</Tag>)}</>,
                  image: { src: captureSrc(s.shot), alt: c.alt, w: c.w, h: c.h },
                };
              })}
            />
          </div>
        </Wrap>
      </Section>

      <Section id="observations" rule>
        <Wrap>
          <div className="v8-stack--lg">
            <div className="v8-head">
              <span className="v8-eyebrow">Recorded evidence</span>
              <h2 className="v8-h2">Four recorded observations</h2>
              <p className="v8-lead">One captured run of the reference experiment, as the read-only evidence app shows it. These are recorded worker self-reports from the experiment: not hardware attestation, and not a customer deployment.</p>
            </div>
            <ObservationTabs items={observations} label="Recorded observations" />
            <p className="v8-small">{CAPTURE_SCOPE} Captured 10 October 2026 at 07:41:29 UTC.</p>
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
                <p className="v8-lead">Release, platform and security engineers at suppliers and system integrators who ship model updates into systems other people operate.</p>
              </div>
              <ul className="ct-list">
                {FOR.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <p className="ct-aside"><Tag kind="hyp" /> This is our working hypothesis about who needs it, not a list of customers.</p>
            </div>
            <div className="ct-col">
              <div className="v8-head">
                <span className="v8-eyebrow">Scope</span>
                <h2 className="v8-h2">What it does not do</h2>
                <p className="v8-lead">The limits of what the experiment shows, in plain terms.</p>
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
                <h2 className="v8-h2">What works today, and where.</h2>
                <p className="v8-lead">The first column runs inside the controlled experiment, and nowhere else.</p>
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
              { q: `Is ${CONTOUR.name} available?`, a: <>No. {CONTOUR.name} is in private development and product access is closed. If you release models into systems other people operate, <Link className="v8-under" href={href("/contact?topic=contour")}>join us</Link> and tell us how you do it today.</> },
              { q: "Which runtimes does it support?", a: "In the experiment, ONNX Runtime 1.23.2 with CPUExecutionProvider only. Adapters for customer runtimes are not built." },
              { q: "Is a runtime report proof of what is loaded?", a: "No. It is a worker self-report from the managed session: the worker states which release it loaded. It is not hardware attestation and not independent observation." },
              { q: "What happens when the runtime stops reporting?", a: <>The observation is recorded as evidence unavailable, with its reason code (<span className="v8-mono">RUNTIME_UNAVAILABLE</span> in the captured run). The approved release stays on record. Nothing is inferred about what is loaded.</> },
              { q: "Does it roll back automatically?", a: "In baseline mode the runtime keeps serving what it loaded until an explicit reload. The experiment also has a reconcile mode. Recovery is an explicit, recorded action: in the captured run, the reload to cpu-2 is its own observation." },
              { q: "Where is the source?", a: "The experiment's source code is private. This site shows recorded evidence from the experiment and captures of the read-only evidence app." },
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
