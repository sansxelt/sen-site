// Server-side audit export controls. Each link hits GET /api/v/audit/export, which enforces
// permission and returns ONLY sanitized AuditEntry rows (no secrets/tokens/ids/payloads), with a
// formula-injection-safe CSV and an attachment content-disposition so the browser downloads it.

const linkStyle = { padding: "6px 13px", fontSize: 12.5 } as const;

function ExportRow({ scope, label }: { scope: "workspace" | "organization"; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, color: "var(--fg-2)", minWidth: 110 }}>{label}</span>
      <a href={`/api/v/audit/export?scope=${scope}&format=csv`} className="btn btn--ghost" style={linkStyle}>Export CSV</a>
      <a href={`/api/v/audit/export?scope=${scope}&format=json`} className="btn btn--ghost" style={linkStyle}>Export JSON</a>
    </div>
  );
}

export function AuditExport({ showOrg }: { showOrg: boolean }) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <ExportRow scope="workspace" label="Workspace" />
      {showOrg && <ExportRow scope="organization" label="Organization" />}
      <p style={{ fontSize: 11.5, color: "var(--fg-5)", margin: 0, lineHeight: 1.6 }}>Exports include sanitized governance activity only. Secrets, tokens, payment identifiers, and raw payloads are never included. Broader enterprise audit scheduling and retention controls are planned.</p>
    </div>
  );
}
