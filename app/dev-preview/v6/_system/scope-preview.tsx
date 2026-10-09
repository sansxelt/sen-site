/** Fictional research views, decorative companions to the accessible card copy. */
export function ScopePreview({ kind }: { kind: number }) {
  return <div className="scope-preview" aria-hidden="true">
    <div className="scope-preview__bar"><span>{["Artifact manifest", "Input comparison", "Workload policy", "Evidence trace"][kind]}</span><span>0{kind + 1}</span></div>
    {kind === 0 && <div className="scope-preview__artifact"><strong>vision.onnx</strong><span>8f2a ··· c91e</span><div><span>Model</span><span>Preprocess</span><span>Config</span></div></div>}
    {kind === 1 && <div className="scope-preview__signals"><div><span>Baseline</span><span>Modified input</span></div><svg viewBox="0 0 200 58" fill="none"><path d="M0 16h200M0 40h200" className="scope-preview__grid" /><path d="M0 30h19l7-6 9 12 11-18 9 20 10-8h27l8-9 11 17 9-13 8 5h72" /><path d="M0 30h19l7-6 9 12 11-18 9 20 10-8h27l8-9 9 29 14-41 12 31 8-10h57" className="scope-preview__modified" /></svg></div>}
    {kind === 2 && <div className="scope-preview__policy"><div><span>telemetry / read</span><strong>Allow</strong></div><div><span>actuator / write</span><strong data-denied>Deny</strong></div></div>}
    {kind === 3 && <div className="scope-preview__trace">{["Source observation", "Reviewed criteria", "Missing source"].map((name, index) => <div key={name} data-missing={index === 2 || undefined}><i /><span>{name}</span><b>{index === 2 ? "—" : "Recorded"}</b></div>)}</div>}
  </div>;
}
