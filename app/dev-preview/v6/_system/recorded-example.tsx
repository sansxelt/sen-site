"use client";

import { useState } from "react";
import { evaluateRecording, type Source } from "@/lib/recorded-verification/evaluate";
import { EXAMPLE_REQUIREMENT, exampleRecording } from "@/lib/recorded-verification/examples";

const CASES = [
  { key: "broken", label: "Wrong result" },
  { key: "missing", label: "Missing report" },
  { key: "corrected", label: "After the change" },
] as const;
const EXAMPLES = CASES.map(item => {
  const recording = exampleRecording(item.key);
  return { ...item, recording, result: evaluateRecording(recording, EXAMPLE_REQUIREMENT) };
});
const SOURCES: { key: Source; label: string }[] = [
  { key: "control", label: "Control panel" },
  { key: "service", label: "Task service" },
  { key: "device", label: "Robot A report" },
];
const OUTCOMES = { passed: "Reports meet the requirement", failed: "Reports do not meet the requirement", inconclusive: "Not enough evidence" };

/** Real evaluator output on explicitly simulated reports; never a physical outcome claim. */
export function RecordedExample() {
  const [selected, setSelected] = useState(0);
  const { recording, result } = EXAMPLES[selected];
  const unchanged = result.findings.find(finding => finding.id === "unchanged:Robot B")!;
  return <div className="recorded-example">
    <p className="recorded-example__label">Simulated task reports</p>
    <p className="recorded-example__requirement">Robot A must finish within 10 seconds.<br />Robot B must stay unchanged.</p>
    <div className="recorded-example__choices" role="group" aria-label="Choose a recording example">
      {EXAMPLES.map((item, index) => <button key={item.key} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>{item.label}</button>)}
    </div>
    <div aria-live="polite" aria-atomic="true">
      <dl className="recorded-example__reports">
        {SOURCES.map(source => {
          const event = recording.events.filter(e => e.assetId === EXAMPLE_REQUIREMENT.assetId && e.taskId === EXAMPLE_REQUIREMENT.taskId && e.source === source.key).at(-1);
          return <div key={source.key}><dt>{source.label}</dt><dd>{event ? <><span>{event.state === "completed" ? "Completed" : "Accepted"}</span><span>{((event.timeMs - recording.window.startMs) / 1000).toFixed(1)} s</span></> : <span>{recording.coverage.some(c => c.source === source.key) ? "No completion recorded" : "Not captured"}</span>}</dd></div>;
        })}
      </dl>
      <p className="recorded-example__other">{unchanged.verdict === "failed" ? "Robot B changed to the requested task." : unchanged.verdict === "passed" ? "Robot B stayed unchanged in the supplied reports." : "Robot B’s report was not captured."}</p>
      <p className="recorded-example__result">{OUTCOMES[result.verdict]}</p>
    </div>
    <p className="recorded-example__footnote">Times are from the recording start. This example uses the app’s evaluator.</p>
  </div>;
}
