// Phase 3 — settings-page authorization: gate the WRITES, not the page.
//
// THE FINDING. Two pages passed minRole "editor" to requirePreflightAppAccess:
//   app/rank/app/systems/[id]/settings/page.tsx
//   app/rank/app/systems/[id]/settings/connections/page.tsx
// Both already contain a complete read-only branch for every mutating control — the edit form falls back
// to a facts card, delete sits behind canDeleteApplication, the connection controls behind canManage. The
// page gate made all of it unreachable: requirePreflightAppAccess returns null on an insufficient role, the
// page then reads with owner "", and a viewer was told "System not found" for a system they can open
// everywhere else in the product.
//
// CLASSIFICATION, which is what was actually asked for:
//   * AVAILABILITY / UX defect — the page gate. It fails closed, so it protects nothing that the route
//     gates do not already protect; it only withholds content the page was built to show. Fixed by
//     lowering both pages to the default viewer minimum.
//   * SECURITY defect — one read on the connections page. listAccountConnections is ACCOUNT-scoped: it
//     returns every provider the owner has authorized, with account labels, across applications the member
//     may not belong to. The editor gate was incidentally masking it. Lowering the page without moving
//     that read would have converted a UX fix into a disclosure. Fixed by fetching it only for the role
//     that can act on it.
//   * INTENTIONAL — client_viewer still gets nothing here. It is a side role excluded from the ladder by
//     hasAtLeastRole, and these are not shared-report surfaces.
//
// Lowering a page gate is only safe if the writes are gated on their own. This asserts that against the
// route files themselves, per HTTP method, rather than trusting the comment that says so.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { capabilities, atLeast, type PreflightRole } from "../lib/preflight/role-capabilities";
import { hasAtLeastRole, type Role } from "../lib/v-workspace";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const read = (p: string) => readFileSync(p, "utf8").replace(/\r/g, "");

const SETTINGS = "app/rank/app/systems/[id]/settings/page.tsx";
const CONNECTIONS = "app/rank/app/systems/[id]/settings/connections/page.tsx";

/**
 * The minRole each exported HTTP method actually gates on.
 *
 * Extracts, per method body, the first gate call and the role literal it passes — so a route that gates
 * one method and forgets another is visible, which a whole-file search for the word "editor" would miss.
 */
function routeRoles(path: string): Record<string, string> {
  const src = read(path);

  // These routes come in two shapes: some pass the minimum at the call site — gate(ctx.params, "editor") —
  // and some call a local helper that hardcodes it. Reading only the call site reports the second shape as
  // UNGATED, which is a FALSE ALARM on correctly-gated code, and a checker that cries wolf gets ignored.
  // So resolve the helper too, and use it only when the call site supplies no role of its own.
  const helper = src.match(/async function gate\([\s\S]*?\n\}/);
  const helperRole = helper
    ? (helper[0].match(/gatePreflightApp\([^)]*?["'](owner|admin|editor|viewer)["']/)?.[1]
       ?? helper[0].match(/hasAtLeastRole\([^,]+,\s*["'](owner|admin|editor|viewer)["']\)/)?.[1]
       ?? null)
    : null;

  const out: Record<string, string> = {};
  const methods = [...src.matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)\b/g)];
  for (let i = 0; i < methods.length; i += 1) {
    const start = methods[i].index ?? 0;
    const end = i + 1 < methods.length ? (methods[i + 1].index ?? src.length) : src.length;
    const body = src.slice(start, end);
    const atCallSite = body.match(/gate(?:PreflightApp)?\([^)]*?["'](owner|admin|editor|viewer)["']/)?.[1];
    const direct = body.match(/hasAtLeastRole\([^,]+,\s*["'](owner|admin|editor|viewer)["']\)/)?.[1];
    // A method that calls no gate at all is UNGATED even when the file defines a helper — the helper only
    // counts for a method that actually invokes it.
    const usesHelper = /await gate\(/.test(body);
    out[methods[i][1]] = atCallSite ?? direct ?? (usesHelper ? helperRole ?? "UNGATED" : "UNGATED");
  }
  return out;
}

// ── 1. The two pages no longer raise their own gate ────────────────────────
console.log("── the page gates ──");
{
  for (const [label, file] of [["settings", SETTINGS], ["connections", CONNECTIONS]] as const) {
    const s = read(file);
    const call = s.match(/requirePreflightAppAccess\(([^;]*?)\);/);
    ok(`${label}: the guard call was located`, Boolean(call), call?.[1]?.replace(/\s+/g, " ").slice(0, 90));
    ok(`${label}: no longer raises the page to editor`, Boolean(call) && !/["']editor["']/.test(call![1]));
    // Still guarded — lowering the minimum must not become removing the guard.
    ok(`${label}: is still access-guarded`, s.includes("requirePreflightAppAccess("));
    ok(`${label}: still renders read-only affordances from capabilities`, s.includes("capabilities(access?.role)"));
  }
  ok("settings: the edit form has a read-only alternative", /caps\.canEditSettings \? \([\s\S]{0,400}\) : \(/.test(read(SETTINGS)));
  ok("settings: delete stays behind the admin capability", read(SETTINGS).includes("caps.canDeleteApplication ?"));
  ok("connections: controls stay behind the manage capability",
    (read(CONNECTIONS).match(/canManage=\{caps\.canManageConnections\}/g) ?? []).length === 2);
}

// ── 2. The account-scoped read does NOT follow the gate down ───────────────
console.log("── the account-scoped read ──");
{
  const s = read(CONNECTIONS);
  ok("the account-level fetch is conditioned on the manage capability",
    /const accountConns = caps\.canManageConnections \? await listAccountConnections\(owner\) : \[\]/.test(s));
  // It must not ALSO sit in the unconditional Promise.all — a leftover copy there would run the query for
  // every viewer regardless of what the conditional below it says.
  const all = s.match(/await Promise\.all\(\[([\s\S]*?)\]\);/);
  ok("the unconditional batch was located", Boolean(all));
  ok("the account-level fetch is not in the unconditional batch", Boolean(all) && !all![1].includes("listAccountConnections"));
  ok("only app-scoped reads remain unconditional",
    Boolean(all) && ["listConnections", "recentConnectionEvents", "listAppLinks"].every((f) => all![1].includes(f)));
}

// ── 3. Every write these pages expose is gated at the route ────────────────
console.log("── the routes behind each control ──");
{
  const app = routeRoles("app/api/preflight/apps/[id]/route.ts");
  ok("PATCH /apps/[id] (save settings) requires editor", app.PATCH === "editor", app.PATCH);

  const apps = routeRoles("app/api/preflight/apps/route.ts");
  ok("DELETE /apps (remove application) requires admin", apps.DELETE === "admin", apps.DELETE);

  const conns = routeRoles("app/api/preflight/apps/[id]/connections/route.ts");
  ok("GET  /connections is readable by a viewer", conns.GET === "viewer", conns.GET);
  ok("POST /connections (add) requires editor", conns.POST === "editor", conns.POST);

  const link = routeRoles("app/api/preflight/apps/[id]/connections/link/route.ts");
  ok("GET    /connections/link is readable by a viewer", link.GET === "viewer", link.GET);
  ok("POST   /connections/link (link) requires editor", link.POST === "editor", link.POST);
  ok("DELETE /connections/link (unlink) requires editor", link.DELETE === "editor", link.DELETE);

  const one = routeRoles("app/api/preflight/apps/[id]/connections/[connId]/route.ts");
  for (const m of Object.keys(one)) {
    ok(`${m} /connections/[connId] requires editor`, one[m] === "editor", one[m]);
  }
  const verify = routeRoles("app/api/preflight/apps/[id]/connections/[connId]/verify/route.ts");
  for (const m of Object.keys(verify)) ok(`${m} /connections/[connId]/verify requires editor`, verify[m] === "editor", verify[m]);

  const secrets = routeRoles("app/api/preflight/apps/[id]/secrets/route.ts");
  ok("POST   /secrets requires editor", secrets.POST === "editor", secrets.POST);
  ok("DELETE /secrets requires editor", secrets.DELETE === "editor", secrets.DELETE);

  const oauth = routeRoles("app/api/preflight/apps/[id]/connections/oauth/[provider]/route.ts");
  for (const m of Object.keys(oauth)) ok(`${m} /connections/oauth requires editor`, oauth[m] === "editor", oauth[m]);

  // No method anywhere in this set may be ungated.
  const files = [
    "app/api/preflight/apps/[id]/route.ts",
    "app/api/preflight/apps/[id]/connections/route.ts",
    "app/api/preflight/apps/[id]/connections/link/route.ts",
    "app/api/preflight/apps/[id]/connections/[connId]/route.ts",
    "app/api/preflight/apps/[id]/connections/[connId]/verify/route.ts",
    "app/api/preflight/apps/[id]/secrets/route.ts",
  ];
  const ungated = files.flatMap((f) => Object.entries(routeRoles(f)).filter(([, r]) => r === "UNGATED").map(([m]) => `${m} ${f}`));
  ok("no method in the settings write surface is ungated", ungated.length === 0, ungated.join(", "));
}

// ── 4. The policy the UI branches on agrees with the server ladder ─────────
console.log("── capability policy ──");
{
  const ROLES: PreflightRole[] = ["owner", "admin", "editor", "viewer", "client_viewer"];
  for (const r of ROLES) {
    const c = capabilities(r);
    // The UI predicate and the server predicate must not disagree, or a control appears that the route
    // refuses — or, worse, a role is shown a read-only page while the route would have allowed the write.
    ok(`${r}: UI editor predicate matches the server ladder`,
      c.canEditSettings === hasAtLeastRole(r as Role, "editor"));
    ok(`${r}: UI admin predicate matches the server ladder`,
      c.canDeleteApplication === hasAtLeastRole(r as Role, "admin"));
  }
  ok("a viewer sees a read-only settings page, not a broken one",
    capabilities("viewer").isReadOnly && !capabilities("viewer").canEditSettings && !capabilities("viewer").canManageConnections);
  ok("a viewer cannot cause the account-scoped query", capabilities("viewer").canManageConnections === false);
  ok("client_viewer remains excluded from the ladder entirely",
    !atLeast("client_viewer", "viewer") && !hasAtLeastRole("client_viewer" as Role, "viewer"));
  ok("an unresolved role is treated as the most restrictive", capabilities(null).isReadOnly && capabilities(undefined).isReadOnly);
}

// ── 5. No OTHER page silently raises its gate ──────────────────────────────
console.log("── every remaining page gate ──");
{
  const listed = execFileSync("git", ["ls-files", "app/rank/**/page.tsx"], { encoding: "utf8" }).split("\n").filter(Boolean);
  const raised = listed.filter((f) => /requirePreflightAppAccess\([^;]*?["'](editor|admin|owner)["']/.test(read(f)));
  ok("no application page raises its own minimum above viewer", raised.length === 0, raised.join(", "));
  const guarded = listed.filter((f) => read(f).includes("requirePreflightAppAccess("));
  ok("the guarded pages were actually found (the scan is not vacuous)", guarded.length >= 10, `${guarded.length} guarded pages`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
