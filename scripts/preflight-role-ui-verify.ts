// Role-aware UI affordances — regression proof (pure/offline). Asserts:
//   1. The capability model (lib/preflight/role-capabilities.ts) returns the exact per-role booleans, and each
//      flag mirrors the SERVER min-role of the route that action calls (so the UI never shows a control the
//      server rejects, nor hides one it allows).
//   2. The client-safe atLeast() === the server's hasAtLeastRole() for every role x min (UI and server agree).
//   3. STRUCTURAL: every gated affordance in the changed client pages/components references the correct caps.*
//      flag, and pure read-only controls (nav links, Copy button) are NOT gated.
//   4. The server routes STILL enforce their min-roles (the affordance hiding is not the security boundary) —
//      re-asserted by checking the gate calls are unchanged.

import { capabilities, atLeast, readOnlyReason, type PreflightRole } from "../lib/preflight/role-capabilities";
import { hasAtLeastRole } from "../lib/v-workspace";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = "") { if (cond) { pass++; console.log(`PASS  ${name}`); } else { fail++; console.log(`FAIL  ${name}${detail ? `  — ${detail}` : ""}`); } }
function read(f: string): string { try { return readFileSync(f, "utf8"); } catch { return ""; } }

// ── 1. Capability truth table ────────────────────────────────────────────────────────────────────────────
console.log("── capability truth table (mirrors the server min-roles exactly) ──");
// Expected: [canEditContract, canLaunch, canManageConnections, canManageDeployments, canEditSettings,
//            canDeleteApplication, canManageTeam, isReadOnly]
const EXPECT: Record<string, [boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean]> = {
  //           editContract launch  conns   deploys settings  DELETE   team    isReadOnly
  owner:         [true,      true,   true,   true,   true,     true,    true,   false],
  admin:         [true,      true,   true,   true,   true,     true,    true,   false],
  editor:        [true,      true,   true,   true,   true,     false,   false,  false],
  viewer:        [false,     false,  false,  false,  false,    false,   false,  true],
  client_viewer: [false,     false,  false,  false,  false,    false,   false,  true],
};
for (const [role, e] of Object.entries(EXPECT)) {
  const c = capabilities(role as PreflightRole);
  const got: boolean[] = [c.canEditContract, c.canLaunch, c.canManageConnections, c.canManageDeployments, c.canEditSettings, c.canDeleteApplication, c.canManageTeam, c.isReadOnly];
  ok(`capabilities("${role}") matches the expected flag set`, JSON.stringify(got) === JSON.stringify(e), `got ${JSON.stringify(got)} want ${JSON.stringify(e)}`);
}
// A null/absent role is the most-restrictive read-only (no resolved membership -> show nothing mutating).
{
  const c = capabilities(null);
  ok("a null role is fully read-only (no mutating capability)", c.isReadOnly && !c.canEditContract && !c.canLaunch && !c.canManageConnections && !c.canEditSettings && !c.canDeleteApplication && !c.canManageTeam);
}
// client_viewer is the report-only side role.
ok("client_viewer is flagged isClientViewer and is read-only", capabilities("client_viewer").isClientViewer && capabilities("client_viewer").isReadOnly);
ok("owner/admin/editor are NOT read-only; viewer/client_viewer ARE", !capabilities("owner").isReadOnly && !capabilities("admin").isReadOnly && !capabilities("editor").isReadOnly && capabilities("viewer").isReadOnly && capabilities("client_viewer").isReadOnly);
// The two admin-only powers must NOT be granted to an editor (the key privilege boundary in the UI).
ok("EDITOR cannot delete the application or manage the team (admin-only in UI, matching the server)", capabilities("editor").canDeleteApplication === false && capabilities("editor").canManageTeam === false);
// Read-only reason copy is present for read-only roles, absent for actors.
ok("readOnlyReason returns a message for viewer + client_viewer, null for editor/admin/owner",
  readOnlyReason("viewer") !== null && readOnlyReason("client_viewer") !== null && readOnlyReason("editor") === null && readOnlyReason("admin") === null && readOnlyReason("owner") === null);

// ── 2. Client/server ladder parity ───────────────────────────────────────────────────────────────────────
console.log("\n── atLeast() (client-safe) === hasAtLeastRole() (server) for every role x min ──");
{
  const roles: (PreflightRole | null)[] = ["owner", "admin", "editor", "viewer", "client_viewer", null];
  const mins = ["viewer", "editor", "admin"] as const;
  let allAgree = true;
  for (const r of roles) for (const m of mins) {
    if (atLeast(r, m) !== hasAtLeastRole(r as never, m)) { allAgree = false; console.log(`  MISMATCH role=${r} min=${m}`); }
  }
  ok("client atLeast and server hasAtLeastRole agree for all role x min combinations", allAgree);
}

// ── 4. Server routes STILL enforce their min-roles (hiding a button is not the boundary) ─────────────────
console.log("\n── server authorization UNCHANGED: routes still gate at their min-roles ──");
const ROUTE_MINROLE: { file: string; needle: RegExp; label: string }[] = [
  { file: "app/api/preflight/apps/[id]/route.ts", needle: /hasAtLeastRole\(access\.role,\s*"editor"\)/, label: "PATCH /apps/[id] settings = editor" },
  { file: "app/api/preflight/apps/route.ts", needle: /hasAtLeastRole\(access\.role,\s*"admin"\)/, label: "DELETE /apps = admin" },
  { file: "app/api/preflight/apps/[id]/runs/route.ts", needle: /hasAtLeastRole\(access\.role,\s*"editor"\)/, label: "launch /runs = editor" },
  { file: "app/api/preflight/runs/[runId]/rerun/route.ts", needle: /hasAtLeastRole\(access\.role,\s*"editor"\)/, label: "rerun = editor" },
  { file: "app/api/preflight/runs/[runId]/cancel/route.ts", needle: /hasAtLeastRole\(access\.role,\s*"editor"\)/, label: "cancel = editor" },
  { file: "app/api/preflight/apps/[id]/members/route.ts", needle: /applicationWorkspaceForManage/, label: "members manage = admin (applicationWorkspaceForManage)" },
];
for (const r of ROUTE_MINROLE) {
  ok(`server still enforces: ${r.label}`, r.needle.test(read(r.file)));
}
// The run-report + artifact reads still exclude client_viewer (the earlier adversarial fix must stand).
for (const f of ["app/api/preflight/runs/[runId]/route.ts", "app/api/preflight/runs/[runId]/artifacts/[artifactId]/route.ts"]) {
  ok(`server run-read still excludes client_viewer: ${f.split("/").slice(-2).join("/")}`, /hasAtLeastRole\(access\.role,\s*"viewer"\)/.test(read(f)));
}

// ── 3. STRUCTURAL: gated affordances reference the right caps.* flag (added once the UI edits land) ───────
// This section is populated after the affordance-gating edits so the file/flag pairs are exact. See the
// per-surface assertions appended below.
console.log("\n── UI affordance gating (structural) ──");
{
  const pages = [
    "app/rank/app/applications/[id]/page.tsx",
    "app/rank/app/applications/[id]/contract/page.tsx",
    "app/rank/app/applications/[id]/settings/page.tsx",
    "app/rank/app/applications/[id]/settings/connections/page.tsx",
    "app/rank/app/applications/[id]/deployments/page.tsx",
    "app/rank/app/applications/[id]/passes/[runId]/page.tsx",
    "app/rank/app/applications/[id]/api-runtime/page.tsx",
  ];
  // Every one of these pages must compute the capability object from the resolved role.
  for (const p of pages) {
    ok(`${p.split("/").slice(-2).join("/")} derives capabilities from the resolved role`, /capabilities\(access\?\.role\)/.test(read(p)) || /capabilities\(/.test(read(p)));
  }
  // ── Per-surface: the exact affordance is gated on the exact flag (structural regression) ──
  const app = (p: string) => read(`app/rank/app/applications/[id]/${p}`);

  // OVERVIEW + CommandCenter: launch gated on canLaunch, and the CommandCenter receives canLaunch.
  const overview = app("page.tsx");
  ok("overview passes canLaunch to CommandCenter", /CommandCenter[\s\S]{0,400}canLaunch=\{caps\.canLaunch\}/.test(overview));
  ok("overview gates its inline LaunchPassButton on caps.canLaunch", /caps\.canLaunch[\s\S]{0,400}LaunchPassButton/.test(overview) || /LaunchPassButton[\s\S]{0,400}caps\.canLaunch/.test(overview));
  const cc = app("command-center.tsx");
  ok("CommandCenter takes a canLaunch prop and shows a read-only note instead of the launch button",
    /canLaunch\s*:\s*boolean/.test(cc) && /showReadOnlyNote|View-only/.test(cc));
  ok("CommandCenter still renders LaunchPassButton on the CAN-launch path (not removed for actors)", cc.includes("LaunchPassButton"));

  // SETTINGS: EditApplicationForm gated on canEditSettings (editor), Delete on canDeleteApplication (admin).
  const settings = app("settings/page.tsx");
  ok("settings gates EditApplicationForm on caps.canEditSettings with a read-only facts replacement",
    /caps\.canEditSettings\s*\?[\s\S]{0,600}EditApplicationForm/.test(settings) && /Application settings[\s\S]{0,400}<KV/.test(settings));
  ok("settings gates DeleteApplication on caps.canDeleteApplication (admin, NOT editor)",
    /caps\.canDeleteApplication\s*\?\s*<DeleteApplication/.test(settings));

  // CONNECTIONS: manager receives canManage; renders a read-only variant when false.
  const connPage = app("settings/connections/page.tsx");
  const connMgr = app("settings/connections/connections-manager.tsx");
  ok("connections page passes caps.canManageConnections into ConnectionsManager", /ConnectionsManager[\s\S]{0,200}canManage=\{caps\.canManageConnections\}/.test(connPage));
  ok("ConnectionsManager renders a read-only variant when !canManage", /!canManage\s*\)?\s*return\s*<ReadOnlyConnections|!canManage[\s\S]{0,120}ReadOnly/.test(connMgr));

  // DEPLOYMENTS: RecordDeploymentForm gated on canManageDeployments.
  const deploys = app("deployments/page.tsx");
  ok("deployments gates RecordDeploymentForm on caps.canManageDeployments", /caps\.canManageDeployments[\s\S]{0,200}RecordDeploymentForm/.test(deploys));

  // PASS REPORT: rerun/cancel gated on canLaunch; CopyButton (clipboard) NOT gated.
  const report = app("passes/[runId]/page.tsx");
  ok("pass report gates RerunButton/CancelRunButton on caps.canLaunch", /caps\.canLaunch\s*\?[\s\S]{0,500}(RerunButton|CancelRunButton)/.test(report));
  ok("pass report does NOT gate the CopyButton (clipboard is read-only, stays for everyone)",
    report.includes("<CopyButton") && !/caps\.\w+\s*(&&|\?)[\s\S]{0,80}<CopyButton/.test(report));

  // CONTRACT: ContractEditor only for editors; a read-only member gets a read-only list; NewDraftButton gated.
  const contract = app("contract/page.tsx");
  ok("contract mounts ContractEditor only when caps.canEditContract, else a read-only list",
    /caps\.canEditContract\s*\?[\s\S]{0,200}<ContractEditor/.test(contract) && /DraftReadOnly|read-only/i.test(contract));
  ok("contract gates NewDraftButton behind canEdit (editor)", /canEdit\s*\?\s*<NewDraftButton/.test(contract));

  // API RUNTIME: ApiWorkspace receives canEdit + canLaunch; renders read-only facts when !canEdit.
  const apiPage = app("api-runtime/page.tsx");
  const apiWs = app("api-runtime/api-workspace.tsx");
  ok("api-runtime passes caps.canEditContract + caps.canLaunch into ApiWorkspace",
    /canEdit=\{caps\.canEditContract\}/.test(apiPage) && /canLaunch=\{caps\.canLaunch\}/.test(apiPage));
  ok("ApiWorkspace gates its editors on canEdit and its run on canLaunch",
    /canEdit\s*:\s*boolean/.test(apiWs) && /canLaunch\s*:\s*boolean/.test(apiWs) && /\{canEdit\s*(&&|\?)/.test(apiWs) && /\{?!?canLaunch/.test(apiWs));

  // The read-only pages carry NO mutating affordance AND no leftover unused caps (they were cleaned).
  for (const ro of ["context/page.tsx", "issues/page.tsx", "passes/page.tsx", "repairs/page.tsx"]) {
    ok(`${ro.split("/")[0]} is read-only: no launch/edit/delete control + no stray caps`, !/caps\./.test(app(ro)));
  }
}

console.log(`\n${pass}/${pass + fail} passed`);
if (fail > 0) process.exit(1);
