import { Button, Capture, JoinBand, PageHero, Section, Tag, Wrap } from "../../_kit/blocks";
import { v8meta } from "../../_kit/meta";
import { CONTOUR, DIRECTION, FACTS, PROMPTO, STATUS, type Kind, STATUS_SOURCES, TAB_NAMES, href } from "../../_kit/site";
import Link from "next/link";
import "../contour.css";

export const metadata = v8meta({
  title: "Vraelis development status",
  description: `Where each Vraelis product stands: ${PROMPTO.name} (available), ${CONTOUR.name} (private development) and what comes next, with the source for every line.`,
  path: "/contour/status",
  tab: TAB_NAMES["contour-status"],
});

// Replaces the old /beta and /limitations pages. Every row reads from STATUS and FACTS in _kit/site.ts, so this
// table cannot drift from the ledger on the homepage and /contour; only the sources live here.

const SOURCES = STATUS_SOURCES;
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
  "Private collector prototype; host-checked": { status: { text: "Live-cluster validation of the current revision pending" }, sources: ["collector", "spec"] },
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
  { title: "Measured", rows: [
    [`${FACTS.tests.value} ${FACTS.tests.label}`, { status: { kind: FACTS.tests.kind }, sources: ["qaRejection"] }],
    [`Earlier: ${FACTS.testsEarlier.value} ${FACTS.testsEarlier.label}`, { status: { kind: FACTS.testsEarlier.kind }, sources: ["qaTests"] }],
  ] },
  { title: "Planned next", rows: Object.entries(BUILDING) },
  { title: "Not claimed", rows: Object.entries(NOT_CLAIMED) },
];

/* The recorded toolchain, as the evidence app's Policy screen shows it (the capture beside it). */
const TOOLCHAIN = [
  { what: "ONNX Runtime", value: "1.23.2", bound: "Signed runtime policy, also pinned by the harness" },
  { what: "Execution provider", value: "CPUExecutionProvider", bound: "Signed runtime policy, this provider only" },
  { what: "Node.js", value: "24.19.0", bound: "Harness pin, not in the signed policy" },
  { what: "Python", value: "3.12.14", bound: "Recorded and pinned by the harness, not in the signed policy" },
];

const LIMITS = [
  { t: "Self-reports", b: "The worker reports what it loaded. Host and worker are trusted." },
  { t: "Structure, not signatures", b: "Opening a trace checks structure only, so an edited, self-consistent trace passes. It is labelled imported." },
  { t: "Synthetic models", b: "No production or customer model has been through it." },
  { t: "One run, in a lab", b: "One recorded run, in a lab that controls no equipment." },
];

const DOES_NOT = [
  "Production readiness, a formal product milestone or independent human review",
  "External signature verification: receipt integrity is covered by signature tests inside the suite",
  "Heartbeat freshness: the policy's age limit bounds how old an approval may be, not how fresh a report is",
  "Customer need or demand",
  "Behaviour with real models, other runtimes or other hardware",
  "Behaviour under live faults, or speed",
  "What a machine runs, beyond its worker's report",
];

// Every product at a glance (founder, 2026-10-24: this page is the company's status page, linked from About, Docs and
// Applications). Steps 3 and 4 are plans and say so.
const GLANCE: { what: string; tag: string; line: string; to: string | null }[] = [
  { what: PROMPTO.name, tag: DIRECTION.steps[0].tag, to: "/prompto", line: `Version ${PROMPTO.version}, released ${PROMPTO.released}. Open source (Apache-2.0), alpha, with downloads for Windows, macOS and Linux. Testing so far is self-run; no outside user has run it yet.` },
  { what: CONTOUR.name, tag: DIRECTION.steps[1].tag, to: "/contour", line: "A private reference experiment, not a product release. Line by line below." },
  { what: DIRECTION.steps[2].title, tag: DIRECTION.steps[2].tag, to: null, line: "Planned: a signed record of which model was approved, for which machine, by whom. Not available." },
  { what: DIRECTION.steps[3].title, tag: DIRECTION.steps[3].tag, to: null, line: "Where the company is going. A plan, not a product." },
];

function StatusTag({ status }: { status: Row["status"] }) {
  return <Tag kind={status.kind}>{status.text}</Tag>;
}

export default function ContourStatusPage() {
  return (
    <div className="ct-page ct-status">
      <PageHero
        eyebrow="Development status"
        title="Where Vraelis stands."
        lead="Every product, what works today, and the source for every line."
        actions={<>
          <Button to="/contact?topic=contour" arrow>Join Us</Button>
          <Button to="/contour" kind="soft">{CONTOUR.name} overview</Button>
        </>}
      />

      <Section rule id="products">
        <Wrap>
          <div className="v8-stack--lg">
            <div className="v8-head--row v8-head">
              <div className="v8-head" style={{ maxWidth: 680 }}>
                <span className="v8-eyebrow">Products</span>
                <h2 className="v8-h2">At a glance</h2>
              </div>
              <p className="ct-asof">As of 23 October 2026</p>
            </div>
            <div className="v8-table-wrap">
              <table className="v8-table ct-table">
                <caption className="v8-sr">Each Vraelis product and where it stands</caption>
                <thead><tr><th scope="col">Product</th><th scope="col">Status</th><th scope="col">Where it stands</th></tr></thead>
                <tbody>
                  {GLANCE.map((g) => (
                    <tr key={g.what}>
                      <td>{g.to ? <Link className="v8-under" href={href(g.to)}>{g.what}</Link> : g.what}</td>
                      <td><Tag>{g.tag}</Tag></td>
                      <td>{g.line}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Wrap>
      </Section>

      <Section rule>
        <Wrap>
          <div className="v8-stack--lg">
            <div className="v8-head--row v8-head">
              <div className="v8-head" style={{ maxWidth: 680 }}>
                <span className="v8-eyebrow">{CONTOUR.name}</span>
                <h2 className="v8-h2">Line by line, with sources</h2>
              </div>
              <p className="ct-asof">As of 17 October 2026</p>
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
              <h2 className="v8-h2">What the tests do not show</h2>
              <p className="v8-lead">133 of 133 is the experiment&apos;s runtime rejection-diagnostics revision, run in a pinned, network-disabled harness and reproduced by internal automated testing on October 10, 2026 (Pacific). It supersedes the earlier 131 of 131 at the runtime-policy revision; it is not 133 additional tests. The evidence app&apos;s own tests are a separate suite, and no counts are added together.</p>
            </div>
            <ul className="ct-list ct-list--plain ct-notshown">{DOES_NOT.map((s) => <li key={s}>{s}</li>)}</ul>
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
