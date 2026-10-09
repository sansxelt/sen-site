"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";

const scenarios = [
  { label: "Records agree", report: "R42", state: "Consistent", detail: "The release, approval and service report name the same version." },
  { label: "Version mismatch", report: "R41", state: "Disputed", detail: "R42 was approved. The service reports R41. The disagreement stays visible." },
  { label: "Missing report", report: "Not received", state: "Unknown", detail: "An approval is present. A loaded version has not been reported." },
] as const;

/** Fictional records. No API call, runtime connection or security decision. */
export function ContourComparison() {
  const [selected, setSelected] = useState(1);
  const id = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const scenario = scenarios[selected];
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % scenarios.length : event.key === "ArrowLeft" ? (index + scenarios.length - 1) % scenarios.length : event.key === "Home" ? 0 : event.key === "End" ? scenarios.length - 1 : null;
    if (next === null) return;
    event.preventDefault(); setSelected(next); tabs.current[next]?.focus();
  }
  return <div className="contour-comparison" data-result={scenario.state.toLowerCase()} aria-label="Illustrative Contour release comparison">
    <header><span>Contour / Release review</span><span>Illustrative example</span></header>
    <div className="contour-comparison__tabs" role="tablist" aria-label="Release scenarios">
      {scenarios.map((item, index) => <button key={item.label} type="button" role="tab" ref={el => { tabs.current[index] = el; }} id={`${id}-tab-${index}`} aria-selected={selected === index} aria-controls={`${id}-panel`} tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={event => navigate(event, index)}>{item.label}</button>)}
    </div>
    <div className="contour-comparison__panel" role="tabpanel" tabIndex={0} id={`${id}-panel`} aria-labelledby={`${id}-tab-${selected}`}>
      <div className="contour-comparison__destination"><span>Destination</span><strong>test-cell-17</strong></div>
      <div className="contour-comparison__versions">
        <div className="contour-comparison__version"><p>Approved release</p><strong>R42</strong><span>Release manifest + approval</span></div>
        <span className="contour-comparison__relation" aria-hidden="true">{selected === 0 ? "=" : selected === 1 ? "≠" : "?"}</span>
        <div className="contour-comparison__version contour-comparison__runtime"><p>Service reports loading</p><strong className="contour-comparison__runtime-version" data-missing={selected === 2 || undefined}>{scenario.report}</strong><span>Managed runtime report</span></div>
      </div>
      <div className="contour-comparison__package"><span>Release package</span><span>Model · Preprocessing · Configuration</span></div>
      <div className="contour-comparison__result"><span className="contour-comparison__state"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d={selected === 0 ? "m3 8 3 3 7-7" : selected === 1 ? "M3 6h10M3 10h10M11 3 5 13" : "M6 5a2 2 0 1 1 3 2c-1 1-1 1-1 3M8 13v.1"} /></svg>{scenario.state}</span><p>{scenario.detail}</p></div>
    </div>
    <p className="contour-comparison__note">Fictional records. Consistency does not establish safe behavior or a trustworthy host.</p>
  </div>;
}
