import { Button, Capture, JoinBand, PageHero, Section, Tag, Wrap } from "../../_kit/blocks";
import { v8meta } from "../../_kit/meta";
import { CONTOUR, FACTS, STATUS, type Kind } from "../../_kit/site";
import "../contour.css";

export const metadata = v8meta({
  title: `${CONTOUR.name} development status`,
  description: `What works in the ${CONTOUR.name} reference experiment, what is being built, what we do not claim, and the source for every line.`,
  path: "/contour/status",
});

// Replaces the old /beta and /limitations pages. Every row reads from STATUS and FACTS in _kit/site.ts, so this
// table cannot drift from the ledger on the homepage and /contour; only the sources live here.

const SOURCES = {
  brief: { label: "Founder brief, 10 October 2026", line: "The founder's statement of what is implemented, what is unfinished, and what Vraelis never claims." },
  qaTests: { label: "Startup QA reply d9815366", line: "Startup QA reproduced the 131 internal tests offline on its own pinned Docker build, and checked the runtime policy enforcement." },
  qaApp: { label: "Startup QA reply 8a2173c7", line: "Startup QA reviewed the read-only evidence app and reported five findings. The current version of the app addresses each of them." },
  spec: { label: "Specification v1.3", line: "An internal proposal for the next stage of the work, including the Kubernetes collector. Proposed, not applied, not frozen." },
} as const;
type Source = keyof typeof SOURCES;

type Row = { status: { kind?: Kind; text?: string }; sources: Source[] };
// Keyed by the STATUS lines themselves: if a line changes in site.ts, this file stops type checking until its
// source is set again.
const WORKING: Record<(typeof STATUS.working)[number], Row> = {
  "Signed release and approval bindings": { status: { kind: "impl" }, sources: ["brief", "qaTests"] },
  "Runtime policy enforcement: ONNX Runtime 1.23.2, CPUExecutionProvider only": { status: { kind: "impl" }, sources: ["brief", "qaTests"] },
  "Real CPU inference on the approved bytes": { status: { kind: "impl" }, sources: ["brief", "qaTests"] },
  "Desired against reported loaded observations, in baseline and reconcile modes": { status: { kind: "impl" }, sources: ["brief", "qaTests"] },
  "A read-only evidence app over the recorded trace": { status: { kind: "impl" }, sources: ["brief", "qaApp"] },
};
const BUILDING: Record<(typeof STATUS.building)[number], Row> = {
  "A Kubernetes collector (proposed in specification v1.3)": { status: { kind: "prop", text: "Proposed, not applied" }, sources: ["spec", "brief"] },
  "Heartbeat freshness for runtime reports": { status: { text: "Not done yet" }, sources: ["brief"] },
  "Live fault runs": { status: { text: "Not done yet" }, sources: ["brief"] },
  "A latency study": { status: { text: "Not done yet" }, sources: ["brief"] },
  "Adapters for customer runtimes": { status: { text: "Not done yet" }, sources: ["brief"] },
};
const NOT_CLAIMED: Record<(typeof STATUS.notClaimed)[number], Row> = {
  "Hardware attestation": { status: { kind: "not" }, sources: ["brief"] },
  "Customer deployments or adoption": { status: { kind: "not" }, sources: ["brief"] },
  "Certification or regulatory compliance": { status: { kind: "not" }, sources: ["brief"] },
  "Pricing or general availability": { status: { kind: "not" }, sources: ["brief"] },
};
const GROUPS: { title: string; rows: [string, Row][] }[] = [
  { title: "Working in the experiment", rows: Object.entries(WORKING) },
  { title: "Measured", rows: [[`${FACTS.tests.value} ${FACTS.tests.label}`, { status: { kind: FACTS.tests.kind }, sources: ["qaTests"] }]] },
  { title: "Being built", rows: Object.entries(BUILDING) },
  { title: "Not claimed", rows: Object.entries(NOT_CLAIMED) },
];

/* The recorded toolchain, as the evidence app's Policy screen shows it (the capture beside it). */
const TOOLCHAIN = [
  { what: "ONNX Runtime", value: "1.23.2", bound: "Part of the signed runtime policy. Also pinned by the test harness." },
  { what: "Execution provider", value: "CPUExecutionProvider", bound: "Part of the signed runtime policy, exactly this provider and no other." },
  { what: "Node.js", value: "24.19.0", bound: "Pinned by the test harness. Not part of the signed policy." },
  { what: "Python", value: "3.12.14", bound: "Recorded and pinned by the harness. Not part of the signed policy." },
];

const LIMITS = [
  { t: "Self-reports", b: "The loaded identity comes from the worker inside the managed session. The host and the worker are trusted. Nothing observes the runtime independently." },
  { t: "Structural checks, not signatures", b: "When the evidence app opens a trace it checks structure and internal consistency. It does not verify signatures, so a self-consistent edited trace passes. Opened files are labelled imported, not verified." },
  { t: "No attestation", b: "There is no hardware attestation. No report on this site is presented as proof of what a machine runs." },
  { t: "Synthetic models", b: "The models are synthetic ONNX models made for the experiment. No production or customer model has been through it." },
  { t: "One CPU runtime", b: "ONNX Runtime 1.23.2 with CPUExecutionProvider and nothing else. No GPU provider, no other runtime, no customer runtime adapter." },
  { t: "One recorded run, in a lab", b: "The captures come from one recorded run in a non-actuating lab environment that controls no equipment. Live fault runs and heartbeat freshness are not done." },
];

const SHOWS = [
  "131 of 131 internal tests pass offline.",
  "Startup QA reproduced that result on its own pinned Docker build.",
  "The experiment enforces its runtime policy: ONNX Runtime 1.23.2, exactly CPUExecutionProvider.",
  "The evidence app's 14 trace tests pass, including refusing to import a pending, wrong runtime or missing evidence observation as matched.",
];
const DOES_NOT = [
  "That Vraelis Contour is ready for production.",
  "That any customer needs it, or would pay for it.",
  "How it behaves with real models, other runtimes or other hardware.",
  "How it behaves under live faults, or how fast it is.",
  "What a machine actually runs, beyond what its worker reports.",
];

function StatusTag({ status }: { status: Row["status"] }) {
  return <Tag kind={status.kind}>{status.text}</Tag>;
}

export default function ContourStatusPage() {
  return (
    <div className="ct-page ct-status">
      <PageHero
        eyebrow="Development status"
        title={`Where ${CONTOUR.name} stands.`}
        lead={<>What works inside the controlled ONNX reference experiment, what is being built, and what we do not claim. Every line names its source. {CONTOUR.name} is in private development, and product access is closed.</>}
        actions={<>
          <Button to="/contact?topic=contour" arrow>Join us</Button>
          <Button to="/contour" kind="soft">{CONTOUR.name} overview</Button>
        </>}
      />

      <Section rule>
        <Wrap>
          <div className="v8-stack--lg">
            <div className="v8-head--row v8-head">
              <div className="v8-head" style={{ maxWidth: 680 }}>
                <span className="v8-eyebrow">Status</span>
                <h2 className="v8-h2">Line by line, with sources</h2>
              </div>
              <p className="ct-asof">As of 10 October 2026</p>
            </div>
            <div className="v8-table-wrap">
              <table className="v8-table ct-table">
                <caption className="v8-sr">{CONTOUR.name} development status, with the source of each line</caption>
                <thead>
                  <tr><th scope="col">What</th><th scope="col">Status</th><th scope="col">Source</th></tr>
                </thead>
                <tbody>
                  {GROUPS.flatMap((g) => [
                    <tr key={g.title} className="ct-table__group"><th colSpan={3} scope="colgroup">{g.title}</th></tr>,
                    ...g.rows.map(([what, row]) => (
                      <tr key={what}>
                        <td>{what}</td>
                        <td><StatusTag status={row.status} /></td>
                        <td><span className="ct-src">{row.sources.map((s) => <a key={s} href={`#src-${s}`}>{SOURCES[s].label}</a>)}</span></td>
                      </tr>
                    )),
                  ])}
                </tbody>
              </table>
            </div>
            <div className="ct-sources-wrap">
              <h3 className="v8-h3" id="sources">Sources</h3>
            <dl className="ct-sources" aria-labelledby="sources">
              {(Object.keys(SOURCES) as Source[]).map((s) => (
                <div key={s} id={`src-${s}`}>
                  <dt>{SOURCES[s].label}</dt>
                  <dd>{SOURCES[s].line}</dd>
                </div>
              ))}
            </dl>
            </div>
          </div>
        </Wrap>
      </Section>

      <Section rule>
        <Wrap>
          <div className="ct-split">
            <div className="v8-stack--lg">
              <div className="v8-head">
                <span className="v8-eyebrow">Recorded toolchain</span>
                <h2 className="v8-h2">What the experiment runs on</h2>
                <p className="v8-lead">Two values are part of the signed runtime policy. The rest are recorded and pinned by the test harness, which is not the same thing.</p>
              </div>
              <div className="v8-table-wrap">
                <table className="v8-table ct-data">
                  <caption className="v8-sr">The experiment&apos;s recorded toolchain</caption>
                  <thead><tr><th scope="col">Component</th><th scope="col">Version</th><th scope="col">How it is bound</th></tr></thead>
                  <tbody>
                    {TOOLCHAIN.map((t) => <tr key={t.what}><td>{t.what}</td><td>{t.value}</td><td>{t.bound}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
            <Capture name="app-policy" small />
          </div>
        </Wrap>
      </Section>

      <Section rule id="limits">
        <Wrap>
          <div className="v8-stack--lg">
            <div className="v8-head">
              <span className="v8-eyebrow">Limits</span>
              <h2 className="v8-h2">Limits of the evidence</h2>
              <p className="v8-lead">What the recorded evidence can and cannot carry. These limits apply to every capture and number on this site.</p>
            </div>
            <div className="ct-limits">
              {LIMITS.map((l) => (
                <div key={l.t} className="v8-box"><h3>{l.t}</h3><p>{l.b}</p></div>
              ))}
            </div>
          </div>
        </Wrap>
      </Section>

      <Section rule>
        <Wrap>
          <div className="v8-stack--lg">
            <div className="v8-head">
              <span className="v8-eyebrow">Tests</span>
              <h2 className="v8-h2">What the tests show and do not show</h2>
              <p className="v8-lead">131 of 131 is automated behaviour inside the experiment. It is not production readiness, and it is not customer demand.</p>
            </div>
            <div className="ct-tests">
              <div className="v8-box">
                <div className="v8-actions"><Tag kind="meas" /></div>
                <h3>What they show</h3>
                <ul className="ct-list ct-list--plain">{SHOWS.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
              <div className="v8-box">
                <div className="v8-actions"><Tag kind="not" /></div>
                <h3>What they do not show</h3>
                <ul className="ct-list ct-list--plain">{DOES_NOT.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
            </div>
          </div>
        </Wrap>
      </Section>

      <Section tight>
        <Wrap>
          <JoinBand secondary={{ to: "/contour", label: "Vraelis Contour" }} />
        </Wrap>
      </Section>
    </div>
  );
}
