"use client";

// Owner/admin CSV export of the SAFE audit rows. Operates only on already-sanitized AuditEntry
// fields (label / when / actor / context) — the same data rendered on the page — so it can never
// export anything the audit view itself doesn't already show. No server round-trip, no new surface.
type Entry = { label: string; when: string; actor: string; context: string };

function csvCell(v: string) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

export function AuditExport({ workspace, organization }: { workspace: Entry[]; organization: Entry[] }) {
  function download() {
    const rows = [
      ["scope", "event", "when", "actor", "context"],
      ...workspace.map((e) => ["workspace", e.label, e.when, e.actor, e.context]),
      ...organization.map((e) => ["organization", e.label, e.when, e.actor, e.context]),
    ];
    const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vraelis-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  const total = workspace.length + organization.length;
  return (
    <button onClick={download} disabled={total === 0} className="btn btn--ghost" style={{ opacity: total === 0 ? 0.5 : 1 }} title={total === 0 ? "No activity to export yet" : `Export ${total} events`}>
      Export CSV
    </button>
  );
}
