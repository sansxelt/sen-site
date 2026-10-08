export function ReleaseDetail({ kind }: { kind: number }) {
  return <div className={`v7-detail-visual v7-detail-visual--${kind}`} aria-label={[
    "Illustrative package containing model, preprocessing and configuration",
    "Illustrative approval binding release R42 to test cell 17",
    "Illustrative disagreement: requested R42, reported R41",
    "Illustrative event record with an absent service report",
  ][kind]}>
    <p className="v7-visual-label">Illustrative records</p>
    {kind === 0 && <div className="v7-manifest"><header><span>Release package</span><b>R42</b></header>{[["01", "vision.onnx", "Model artifact"], ["02", "normalize-v3", "Preprocessing"], ["03", "camera-a", "Configuration"]].map(([n, name, label]) => <div key={n}><span>{n}</span><div><strong>{name}</strong><small>{label}</small></div><svg className="v7-file-binding" aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 3v9h10m-4-4 4 4-4 4" stroke="currentColor" /></svg></div>)}<footer>One manifest · Three bound components</footer></div>}
    {kind === 1 && <div className="v7-binding"><div className="v7-binding__authority">release-team<span>Approval authority</span></div><div className="v7-binding__line" aria-hidden="true" /><div className="v7-binding__pair"><div><small>Release</small><strong>R42</strong></div><span aria-hidden="true">↔</span><div><small>Destination</small><strong>test-cell-17</strong></div></div><p>This approval names both.</p></div>}
    {kind === 2 && <div className="v7-version-pair"><div><small>Requested release</small><strong>R42</strong><span>Approved for this destination</span></div><div><small>Service reports</small><strong>R41</strong><span>Different loaded version</span></div><p><i aria-hidden="true" />Disagreement requires review</p></div>}
    {kind === 3 && <div className="v7-record-timeline">{[["Release identified", "R42"], ["Destination approved", "test-cell-17"], ["Service report", "Not received"]].map(([name, value], i) => <div key={name} data-missing={i === 2}><span aria-hidden="true" /><div><strong>{name}</strong><small>{value}</small></div></div>)}<footer>Unknown stays unknown.</footer></div>}
  </div>;
}

export function ScopeVisual({ kind }: { kind: number }) {
  return <svg className="v7-scope-visual" viewBox="0 0 240 120" fill="none" aria-hidden="true">
    <defs><pattern id={`scope-grid-${kind}`} width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" stroke="currentColor" opacity=".09" /></pattern></defs>
    <rect width="240" height="120" fill={`url(#scope-grid-${kind})`} />
    {kind === 0 && <g stroke="currentColor"><path d="m120 20 35 20v40l-35 20-35-20V40Z" /><path d="m85 40 35 20 35-20M120 60v40" opacity=".45" /><path d="M40 60h35m90 0h35" strokeDasharray="3 5" /><circle cx="35" cy="60" r="4" /><circle cx="205" cy="60" r="4" /></g>}
    {kind === 1 && <g stroke="currentColor"><path d="M25 60h45l12-17 15 34 17-57 19 79 17-47 13 8h52" /><path d="M25 40h190M25 80h190" opacity=".15" /><circle cx="132" cy="60" r="28" opacity=".35" /></g>}
    {kind === 2 && <g stroke="currentColor"><rect x="96" y="37" width="48" height="46" rx="9" /><path d="M108 60h24m-12-12v24M40 30l46 22m-46 38 46-22M200 30l-46 22m46 38-46-22" opacity=".6" /><circle cx="34" cy="27" r="7" /><circle cx="34" cy="93" r="7" /><circle cx="206" cy="27" r="7" /><circle cx="206" cy="93" r="7" /></g>}
    {kind === 3 && <g stroke="currentColor"><path d="M45 29h150M45 60h150M45 91h100" opacity=".4" /><circle cx="45" cy="29" r="4" fill="currentColor" /><circle cx="45" cy="60" r="4" fill="currentColor" /><circle cx="45" cy="91" r="4" /><rect x="167" y="78" width="28" height="26" rx="5" /><path d="m174 91 5 5 9-10" /></g>}
  </svg>;
}
