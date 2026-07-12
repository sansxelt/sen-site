// Discovery card: surfaces workspaces/projects shared WITH the signed-in user on
// owner analytics pages, so members reach read-only shared analytics/reports.
// Client-safe links: shared project routes gate analytics by role themselves.
type Role = "owner" | "admin" | "editor" | "viewer" | "client_viewer";
const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", editor: "Editor", viewer: "Viewer", client_viewer: "Client viewer" };

export function SharedWithYou({
  shared, sharedProjects,
}: {
  shared: { workspace_id: string; name: string; role: Role }[];
  sharedProjects: { project_id: string; name: string; workspace_name: string; role: Role }[];
}) {
  if (!shared.length && !sharedProjects.length) return null;
  const link = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 0", textDecoration: "none", color: "var(--fg-1)", borderTop: "1px solid var(--line-1)" } as const;
  return (
    <div className="card" style={{ marginBottom: 22, background: "var(--bg-2)" }}>
      <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 6 }}>Shared with you</div>
      <p style={{ fontSize: 13, color: "var(--fg-3)", margin: "0 0 6px" }}>You are viewing analytics for projects and workspaces shared with you. Client viewers see client-safe reports only.</p>
      {sharedProjects.map((p) => (
        <a key={p.project_id} href={`/shared/projects/${p.project_id}`} style={link}>
          <span style={{ fontSize: 13.5 }}>{p.name} <span style={{ fontSize: 11.5, color: "var(--fg-4)" }}>| {p.workspace_name} | {ROLE_LABEL[p.role]}</span></span>
          <span style={{ fontSize: 12, color: "var(--acc-deep)" }}>{p.role === "client_viewer" ? "Reports →" : "Analytics →"}</span>
        </a>
      ))}
      {shared.map((w) => (
        <a key={w.workspace_id} href="/team" style={link}>
          <span style={{ fontSize: 13.5 }}>{w.name} <span style={{ fontSize: 11.5, color: "var(--fg-4)" }}>| workspace | {ROLE_LABEL[w.role]}</span></span>
          <span style={{ fontSize: 12, color: "var(--acc-deep)" }}>Open →</span>
        </a>
      ))}
    </div>
  );
}
