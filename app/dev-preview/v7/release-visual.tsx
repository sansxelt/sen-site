"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";

const scenarios = [
  { name: "Records agree", state: "Consistent", tone: "consistent", loaded: "R42", detail: "The release, approval and managed-service report name the same version." },
  { name: "Version mismatch", state: "Disputed", tone: "disputed", loaded: "R41", detail: "R42 was approved. The managed service reports R41. Keep the disagreement visible." },
  { name: "Missing report", state: "Unknown", tone: "unknown", loaded: "No report", detail: "An approval is present, but the service has not reported a loaded version." },
] as const;

/** Fictional records explain the product direction; this never calls a runtime. */
export function ReleaseExplorer() {
  const [selected, setSelected] = useState(0);
  const id = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const scenario = scenarios[selected];
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % scenarios.length : event.key === "ArrowLeft" ? (index + scenarios.length - 1) % scenarios.length : event.key === "Home" ? 0 : event.key === "End" ? scenarios.length - 1 : null;
    if (next === null) return;
    event.preventDefault(); setSelected(next); tabs.current[next]?.focus();
  }
  return <section className="v7-explorer" aria-label="Illustrative release comparison">
    <div className="v7-explorer__bar"><span><i aria-hidden="true" />Contour / Release review</span><small>Product concept</small></div>
    <div className="v7-scenario-tabs" role="tablist" aria-label="Choose an illustrative scenario">{scenarios.map((s, i) => <button key={s.name} ref={el => { tabs.current[i] = el; }} id={`${id}-tab-${i}`} role="tab" aria-selected={selected === i} aria-controls={`${id}-panel`} tabIndex={selected === i ? 0 : -1} onClick={() => setSelected(i)} onKeyDown={event => navigate(event, i)}>{s.name}</button>)}</div>
    <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${selected}`} tabIndex={0} className="v7-explorer__panel">
      <div className="v7-records">
        <article><span className="v7-record-label">01 / Release manifest</span><strong>R42</strong><dl><div><dt>Model</dt><dd>vision.onnx</dd></div><div><dt>Preprocessing</dt><dd>normalize-v3</dd></div><div><dt>Configuration</dt><dd>camera-a</dd></div></dl></article>
        <article><span className="v7-record-label">02 / Destination approval</span><strong>R42</strong><dl><div><dt>Destination</dt><dd>test-cell-17</dd></div><div><dt>Approver</dt><dd>release-team</dd></div><div><dt>Scope</dt><dd>This release only</dd></div></dl></article>
        <article data-state={scenario.tone}><span className="v7-record-label">03 / Service report</span><strong>{scenario.loaded}</strong><dl><div><dt>Source</dt><dd>managed runtime</dd></div><div><dt>Requested</dt><dd>R42</dd></div><div><dt>Reported</dt><dd>{scenario.loaded}</dd></div></dl></article>
      </div>
      <div className="v7-record-result" data-state={scenario.tone}><span className="v7-result-dot" aria-hidden="true" /><div><strong>{scenario.state}</strong><p>{scenario.detail}</p></div></div>
    </div>
    <p className="v7-explorer__caption">Fictional records. A service report does not establish the state of a compromised host.</p>
  </section>;
}

