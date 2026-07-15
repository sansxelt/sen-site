// Preflight team/workspace access — safety proof (pure/offline: no network, no DB, no spend). Proves the
// cross-tenant access model that lets a workspace SHARE an application with owner-anchored billing:
//   - the pure access-decision core (owner path / member path / revoked / no-workspace / cross-workspace)
//   - the role ladder (viewer<editor<admin<owner; client_viewer is report-only, never a rung)
//   - the gate reason -> HTTP response mapping (uniform 404 for non-access, 403 only for a view-only member)
//   - STRUCTURAL wiring: every mutating Preflight route resolves via a team-access resolver AND role-gates,
//     and billing/data always flow to the resolved app OWNER (owner-anchored), never the caller.
// These are the leak-check assertions from the team blueprint, made executable.

import { resolveAccessDecision } from "../lib/preflight/team-access";
import { hasAtLeastRole, type Role } from "../lib/v-workspace";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = "") { if (cond) { pass++; console.log(`PASS  ${name}`); } else { fail++; console.log(`FAIL  ${name}${detail ? `  — ${detail}` : ""}`); } }

const OWNER = "owner@x.com", MEMBER = "member@y.com", STRANGER = "mallory@z.com";
const WS = "ws_1";

function main() {
  console.log("── pure access-decision core (the tenancy boundary) ──");
  // Owner always passes as owner, even with no workspace (solo / pre-migration fast path).
  ok("owner gets role=owner with NO workspace (single-user path)", (() => { const a = resolveAccessDecision(OWNER, OWNER, null, null); return a?.owner === OWNER && a?.role === "owner" && a?.level === "owner"; })());
  ok("owner gets role=owner WITH a workspace too", (() => { const a = resolveAccessDecision(OWNER, OWNER, WS, null); return a?.role === "owner" && a?.level === "owner"; })());
  ok("owner match is case-insensitive/trimmed", (() => { const a = resolveAccessDecision("  OWNER@X.com ", OWNER, WS, null); return a?.role === "owner"; })());

  // A non-owner needs BOTH a shared workspace AND an active membership role.
  ok("a member of the app's workspace gets THEIR role + owner as the data-plane key", (() => { const a = resolveAccessDecision(MEMBER, OWNER, WS, "editor"); return a?.owner === OWNER && a?.role === "editor" && a?.level === "workspace"; })());
  ok("a non-owner with NO workspace on the app -> NO access (owner-only, single-user)", resolveAccessDecision(MEMBER, OWNER, null, "editor") === null);
  ok("a non-owner who is NOT a member (never invited) -> NO access", resolveAccessDecision(STRANGER, OWNER, WS, null) === null);
  ok("a REVOKED member (membershipFor returns null) -> NO access immediately", resolveAccessDecision(MEMBER, OWNER, WS, null) === null);
  ok("the resolved owner is ALWAYS the app owner, never the caller (owner-anchored billing key)", (() => { const a = resolveAccessDecision(MEMBER, OWNER, WS, "admin"); const resolvedOwner: string = a?.owner ?? ""; return resolvedOwner === OWNER && resolvedOwner !== (MEMBER as string); })());

  console.log("\n── role ladder: viewer < editor < admin < owner; client_viewer is report-only ──");
  const ladder: Array<[Role, Exclude<Role, "client_viewer">, boolean]> = [
    ["owner", "admin", true], ["owner", "editor", true], ["owner", "viewer", true],
    ["admin", "admin", true], ["admin", "editor", true], ["admin", "viewer", true],
    ["editor", "editor", true], ["editor", "viewer", true], ["editor", "admin", false],
    ["viewer", "viewer", true], ["viewer", "editor", false], ["viewer", "admin", false],
    ["client_viewer", "viewer", false], ["client_viewer", "editor", false], ["client_viewer", "admin", false],
  ];
  for (const [role, min, want] of ladder) ok(`${role} >= ${min} is ${want}`, hasAtLeastRole(role, min) === want);
  ok("a null role (no membership) satisfies NO minimum", hasAtLeastRole(null, "viewer") === false && hasAtLeastRole(undefined, "viewer") === false);
  // The critical gate: a viewer can never launch/mutate (min 'editor'); a client_viewer can never touch app internals.
  ok("VIEWER cannot launch/mutate (blocked at min editor)", hasAtLeastRole("viewer", "editor") === false);
  ok("CLIENT_VIEWER cannot even read app internals (blocked at min viewer)", hasAtLeastRole("client_viewer", "viewer") === false);
  ok("EDITOR can launch/mutate", hasAtLeastRole("editor", "editor") === true);
  ok("only OWNER/ADMIN can manage/delete (min admin)", hasAtLeastRole("editor", "admin") === false && hasAtLeastRole("admin", "admin") === true && hasAtLeastRole("owner", "admin") === true);
}

// ── gate reason -> HTTP response (uniform 404 for non-access; 403 only for a real view-only member) ──────
function gateResponseTests() {
  console.log("\n── gate reason -> HTTP status (posture) ──");
  // Import lazily so a missing next/server never blocks the pure tests above.
  const { gateReasonResponse } = require("../lib/preflight/team-access") as typeof import("../lib/preflight/team-access");
  const status = (r: import("../lib/preflight/team-access").GateReason) => (gateReasonResponse(r) as { status: number }).status;
  ok("disabled -> 404 (surface indistinguishable from not existing)", status("disabled") === 404);
  ok("not_found -> 404 (non-member / non-existent app indistinguishable)", status("not_found") === 404);
  ok("forbidden -> 403 (a real view-only MEMBER who already knows the app exists)", status("forbidden") === 403);
  ok("signin -> 401 (only for a genuinely unauthenticated caller)", status("signin") === 401);
  ok("setup -> 503 (DB not migrated)", status("setup") === 503);
  // The security-critical property: a non-member and a disabled surface BOTH return 404 (no existence leak).
  ok("non-access is a UNIFORM 404 (disabled === not_found status)", status("disabled") === status("not_found"));
}

// ── structural wiring: every mutating route resolves via team-access AND role-gates; billing -> owner ───
function wiringTests() {
  console.log("\n── every Preflight app-scoped route resolves access + role-gates (owner-anchored) ──");

  // WEB routes that MUTATE must require editor+ (or admin for manage/delete). They must resolve via a
  // team-access resolver/gate and pass the resolved OWNER (never the caller email) to the data layer.
  const RESOLVERS = ["gatePreflightApp", "gateApiRuntimeApp", "applicationAccess", "applicationAccessForRun", "applicationAccessForContract", "applicationAccessForRequirement", "applicationAccessForFlow"];
  const usesResolver = (src: string) => RESOLVERS.some((r) => src.includes(r));

  // (route, must-role-gate?) — a mutating route must contain a hasAtLeastRole/editor|admin gate somewhere,
  // OR delegate role entirely to gatePreflightApp/gateApiRuntimeApp (which role-gate internally via minRole).
  const MUTATING = [
    "app/api/preflight/apps/[id]/runs/route.ts",
    "app/api/preflight/apps/[id]/route.ts",
    "app/api/preflight/apps/[id]/connections/route.ts",
    "app/api/preflight/apps/[id]/connections/[connId]/route.ts",
    "app/api/preflight/apps/[id]/connections/[connId]/verify/route.ts",
    "app/api/preflight/apps/[id]/secrets/route.ts",
    "app/api/preflight/apps/[id]/deployments/route.ts",
    "app/api/preflight/apps/[id]/contract/draft/route.ts",
    "app/api/preflight/apps/[id]/discover/route.ts",
    "app/api/preflight/apps/[id]/runtime-targets/route.ts",
    "app/api/preflight/apps/[id]/api-credentials/route.ts",
    "app/api/preflight/apps/[id]/api-flows/route.ts",
    "app/api/preflight/apps/[id]/api-runs/route.ts",
    "app/api/preflight/requirements/route.ts",
    "app/api/preflight/flows/route.ts",
    "app/api/preflight/runs/[runId]/cancel/route.ts",
    "app/api/preflight/runs/[runId]/rerun/route.ts",
    "app/api/preflight/apps/route.ts",
  ];
  for (const f of MUTATING) {
    const src = readFileSync(f, "utf8");
    const resolved = usesResolver(src);
    // role gating present: an explicit hasAtLeastRole("editor"|"admin"), a gate call carrying a non-default
    // minRole ("editor"/"admin"), OR a local gate-helper (gate(...)/ctx(...)) that forwards "editor"/"admin"
    // to the resolver (some routes wrap gateApiRuntimeApp/gatePreflightApp in a per-file helper).
    const roleGated = /hasAtLeastRole\([^)]*,\s*"(editor|admin)"\)/.test(src)
      || /gate\w*\([^)]*,\s*"(editor|admin)"\)/.test(src)
      || /\b(gate|ctx)\([^)]*,\s*"(editor|admin)"\)/.test(src);
    ok(`${f.split("/").slice(-2).join("/")} resolves access + gates editor/admin`, resolved && roleGated, resolved ? "no role gate" : "no resolver");
  }

  console.log("\n── owner-anchored billing: the launch/rerun paths key billing to the resolved OWNER ──");
  for (const f of ["app/api/preflight/apps/[id]/runs/route.ts", "app/api/preflight/runs/[runId]/rerun/route.ts"]) {
    const src = readFileSync(f, "utf8");
    // owner must be assigned FROM the resolver's access.owner, and the billing calls must use `owner`.
    const ownerFromAccess = /const owner = access\.owner;/.test(src);
    const holdsOnOwner = /hold\(owner,/.test(src) && /gatePassLaunch\(owner,/.test(src) && /createRun\(owner,/.test(src);
    ok(`${f.split("/").slice(-2).join("/")} sets owner = access.owner and bills the owner`, ownerFromAccess && holdsOnOwner, ownerFromAccess ? "billing not on owner" : "owner not from access");
    // The caller email must NOT be the billing key: no `const owner = email.toLowerCase()` remains.
    ok(`${f.split("/").slice(-2).join("/")} never bills the caller (no owner = email.toLowerCase())`, !/const owner = email\.toLowerCase\(\)/.test(src));
  }

  console.log("\n── the API runs route bills the app owner (not the caller) via gateApiRuntimeApp ──");
  const apiRun = readFileSync("app/api/preflight/apps/[id]/api-runs/route.ts", "utf8");
  ok("api-runs resolves owner via gateApiRuntimeApp + sets owner = g.owner", apiRun.includes("gateApiRuntimeApp") && /const owner = g\.owner;/.test(apiRun));
  ok("api-runs no longer keys billing to the raw caller (apiBetaOwner removed as the owner source)", !/const owner = await apiBetaOwner\(\)/.test(apiRun));

  console.log("\n── run-scoped READ routes exclude client_viewer (regression: adversarial finding) ──");
  // These read routes resolve access via applicationAccessForRun (NOT gatePreflightApp, which would exclude
  // client_viewer automatically), so they MUST add an explicit hasAtLeastRole(access.role, "viewer") gate —
  // otherwise a report-only client_viewer member reads the full run report / downloads Playwright traces.
  // A viewer+ read via the shared gatePreflightApp already excludes client_viewer, so only the hand-rolled
  // run-scoped reads need this explicit check.
  const RUN_READS = [
    "app/api/preflight/runs/[runId]/route.ts",
    "app/api/preflight/runs/[runId]/artifacts/[artifactId]/route.ts",
  ];
  for (const f of RUN_READS) {
    const src = readFileSync(f, "utf8");
    // Must resolve via applicationAccessForRun AND gate the role rung at viewer (which excludes client_viewer).
    const gated = /applicationAccessForRun\(/.test(src) && /hasAtLeastRole\(access\.role,\s*"viewer"\)/.test(src);
    ok(`${f.split("/").slice(-2).join("/")} excludes client_viewer (hasAtLeastRole viewer)`, gated, "missing the viewer role gate — client_viewer would read app internals");
  }

  console.log("\n── degradation: the resolver is null-safe for empty inputs (no crash pre-migration) ──");
  ok("resolveAccessDecision with owner==caller still resolves regardless of workspace state", resolveAccessDecision("a@b.com", "a@b.com", null, null)?.role === "owner");
  // Directly assert the role model that the two routes above rely on.
  ok("a client_viewer FAILS hasAtLeastRole(viewer) — the property the run-read gate depends on", hasAtLeastRole("client_viewer", "viewer") === false);
}

function run() {
  main();
  gateResponseTests();
  wiringTests();
  console.log(`\n${pass}/${pass + fail} passed`);
  if (fail > 0) process.exit(1);
}
run();
