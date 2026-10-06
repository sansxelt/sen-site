import { EXAMPLE_REQUIREMENT } from "@/lib/recorded-verification/examples";
import type { Requirement } from "@/lib/recorded-verification/evaluate";
import "./evidence-model.css";

// The same requirement used by the interactive report example and local evaluator.
const sources = [
  { name: "Control panel", detail: "Requested and displayed state" },
  { name: "Task service", detail: "Accepted and reported state" },
  { name: "Device report", detail: "Recorded device state" },
];

export function EvidenceModel({ requirement = EXAMPLE_REQUIREMENT }: { requirement?: Requirement }) {
  return <figure className="evidence-model" aria-label="Recorded-report evaluation: a requirement and captured source events lead to a verdict linked to source events.">
    <div className="evidence-model__head"><span>Recorded evidence</span><span>JSON / MCAP</span></div>
    <div className="evidence-model__requirement">
      <p className="evidence-model__label">01 / Define the requirement</p>
      <dl>
        <div><dt>Intended asset</dt><dd>{requirement.assetId}</dd></div>
        <div><dt>Task</dt><dd>{requirement.taskId}</dd></div>
        <div><dt>Completion window</dt><dd>{requirement.completionWithinMs / 1000} seconds</dd></div>
        <div><dt>Keep unchanged</dt><dd>{requirement.untouchedAssetIds.join(", ")}</dd></div>
      </dl>
    </div>
    <div className="evidence-model__sources">
      <p className="evidence-model__label">02 / Bring the captured reports</p>
      <ul>{sources.map(source => <li key={source.name}>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true"><path d="M4 4h14v14H4zM7 8h8M7 11h8M7 14h5" stroke="currentColor" strokeWidth="1"/></svg>
        <strong>{source.name}</strong><span>{source.detail}</span>
      </li>)}</ul>
    </div>
    <div className="evidence-model__connector" aria-hidden="true"><i/><i/><i/></div>
    <div className="evidence-model__compare">
      <p className="evidence-model__label">03 / Compare against the requirement</p>
      <strong>Same task. Intended asset. Declared coverage.</strong>
      <p>Check source events on a shared timestamp basis, within the captured intervals.</p>
    </div>
    <div className="evidence-model__outcomes">
      <span><i aria-hidden="true">✓</i>Passed</span>
      <span><i aria-hidden="true">×</i>Failed</span>
      <span><i aria-hidden="true">?</i>Inconclusive</span>
    </div>
    <figcaption>Illustrative requirement. Findings link to supplied source events. Missing evidence remains explicit. Files stay in your browser; reports do not establish physical ground truth. Live device connections are not available.</figcaption>
  </figure>;
}
