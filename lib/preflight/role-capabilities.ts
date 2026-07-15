// Client-safe capability predicates for Preflight team roles. PURE — no server imports (no crypto, no
// supabase, no DB), so this module is safe to import into "use client" components AND server components alike.
//
// These predicates decide what AFFORDANCES to show a member; they are NOT a security boundary. Every server
// route independently enforces the same policy via hasAtLeastRole in lib/v-workspace.ts (which is the real
// gate). The role string here is always the one the server already resolved (requirePreflightAppAccess ->
// applicationAccess), so the UI and the server agree by construction. Hiding a button never replaces the
// server check — a direct request from a viewer/client_viewer still gets the existing 403/404.
//
// Role ladder (most-privileged first): owner > admin > editor > viewer. client_viewer is a SIDE role
// (report-only): it can VIEW shared reports but is treated as read-only for every action, and is excluded
// from the ladder exactly like v-workspace.hasAtLeastRole excludes it.

export type PreflightRole = "owner" | "admin" | "editor" | "viewer" | "client_viewer";

// Mirror of v-workspace.hasAtLeastRole (kept in sync deliberately; a verifier asserts they agree). A null
// role (no membership) and client_viewer never satisfy any ladder minimum.
const RANK: Record<Exclude<PreflightRole, "client_viewer">, number> = { owner: 4, admin: 3, editor: 2, viewer: 1 };
export function atLeast(role: PreflightRole | null | undefined, min: Exclude<PreflightRole, "client_viewer">): boolean {
  if (!role || role === "client_viewer") return false;
  return RANK[role] >= RANK[min];
}

// ── The capability set for a role. Every affordance derives from one of these, and each flag mirrors the
// EXACT server min-role of the route that action calls (so the UI never shows a control the server would
// reject, and never hides one the server would allow). The server min-roles (the source of truth):
//   PATCH /apps/[id] (settings)            -> editor
//   contract draft / requirements / flows  -> editor
//   /runs, /runs/[id]/rerun, .../cancel    -> editor
//   connections + secrets + verify         -> editor
//   /deployments (record)                  -> editor
//   api target / credentials / flows / runs-> editor
//   DELETE /apps (delete application)       -> admin
//   /apps/[id]/members (manage team)        -> admin
export type Capabilities = {
  role: PreflightRole;
  // EDITOR+ : author/edit the contract, requirements, flows; connections + credentials; deployments; launch.
  canEditContract: boolean;      // contract draft + requirements + flows routes (editor)
  canLaunch: boolean;            // /runs + rerun + cancel (editor)
  canManageConnections: boolean; // connections + secrets + verify + api credentials (editor)
  canManageDeployments: boolean; // record deployment (editor)
  canEditSettings: boolean;      // PATCH /apps/[id] name/url/env/description (editor)
  // ADMIN+ : delete the application, and invite/manage team members.
  canDeleteApplication: boolean; // DELETE /apps (admin)
  canManageTeam: boolean;        // /apps/[id]/members (admin)
  // Everyone with access can READ reports/evidence (client_viewer included, on shared-report surfaces).
  canViewReports: boolean;
  // Convenience flags the UI reads for copy/empty-states.
  isReadOnly: boolean;      // true for viewer + client_viewer (no mutating affordance at all)
  isClientViewer: boolean;  // report-only side role
};

export function capabilities(role: PreflightRole | null | undefined): Capabilities {
  const r: PreflightRole = role ?? "viewer"; // no resolved role -> treat as most-restrictive read-only
  const editor = atLeast(r, "editor");
  const admin = atLeast(r, "admin");
  return {
    role: r,
    canEditContract: editor,
    canLaunch: editor,
    canManageConnections: editor,
    canManageDeployments: editor,
    canEditSettings: editor,      // server gates PATCH /apps/[id] at editor+, so the UI must too
    canDeleteApplication: admin,
    canManageTeam: admin,
    canViewReports: true,
    isReadOnly: !editor,             // viewer + client_viewer
    isClientViewer: r === "client_viewer",
  };
}

// A short, honest read-only banner message per role, for surfaces that would otherwise show edit controls.
export function readOnlyReason(role: PreflightRole | null | undefined): string | null {
  const r: PreflightRole = role ?? "viewer";
  if (r === "client_viewer") return "You have client access to this application: shared reports only.";
  if (r === "viewer") return "You have view-only access to this application. Ask an editor or the owner to make changes.";
  return null; // editor/admin/owner: not read-only
}
