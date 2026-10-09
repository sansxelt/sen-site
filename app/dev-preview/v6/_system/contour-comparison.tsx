"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";

const scenarios = [
  { label: "Records agree", report: "R42", state: "Consistent", detail: "The release, approval and service report name the same version." },
  { label: "Version mismatch", report: "R41", state: "Disputed", detail: "R42 was approved. The service reports R41. The disagreement stays visible." },
  { label: "Missing report", report: "Not received", state: "Unknown", detail: "An approval is present. A loaded version has not been reported." },
] as const;

/** Fictional records. No API call, runtime connection or security decision. */
export function ContourComparison() {
  const [selected, setSelected] = useState(0);
  const id = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const scenario = scenarios[selected];
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % scenarios.length : event.key === "ArrowLeft" ? (index + scenarios.length - 1) % scenarios.length : event.key === "Home" ? 0 : event.key === "End" ? scenarios.length - 1 : null;
    if (next === null) return;
    event.preventDefault(); setSelected(next); tabs.current[next]?.focus();
  }
  return <div className="contour-comparison" aria-label="Illustrative Contour release comparison">
    <header><span>Contour / Release review</span><span>Illustrative example</span></header>
    <div className="contour-comparison__tabs" role="tablist" aria-label="Release scenarios">
      {scenarios.map((item, index) => <button key={item.label} type="button" role="tab" ref={el => { tabs.current[index] = el; }} id={`${id}-tab-${index}`} aria-selected={selected === index} aria-controls={`${id}-panel`} tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={event => navigate(event, index)}>{item.label}</button>)}
    </div>
    <div className="contour-comparison__panel" role="tabpanel" tabIndex={0} id={`${id}-panel`} aria-labelledby={`${id}-tab-${selected}`}>
      <div className="contour-comparison__destination"><span>Destination</span><strong>test-cell-17</strong></div>
      <dl>
        <div><dt><span aria-hidden="true">01</span>Release manifest</dt><dd>R42</dd></div>
        <div><dt><span aria-hidden="true">02</span>Destination approval</dt><dd>R42</dd></div>
        <div><dt><span aria-hidden="true">03</span>Service reports loading</dt><dd>{scenario.report}</dd></div>
      </dl>
      <div className="contour-comparison__result"><span className="contour-comparison__state"><i aria-hidden="true" />{scenario.state}</span><p>{scenario.detail}</p></div>
    </div>
    <p className="contour-comparison__note">Fictional records. Consistency does not prove safe model behavior or the state of a compromised host.</p>
  </div>;
}
