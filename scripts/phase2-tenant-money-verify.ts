// Phase 2 — tenant isolation and money authorization.
//
// TENANT ISOLATION. Two findings shared one root cause: the PAGE guard
// (requirePreflightAppAccess) granted access on membership alone, while the API gate (gatePreflightApp)
// applied hasAtLeastRole(minRole) to the same resources. client_viewer is a SIDE role — report-only,
// deliberately excluded from the role ladder — so hasAtLeastRole rejects it and every /systems/[id] page
// rendered internal state to a role the API refuses to serve. Separately, workspaceProjectSummaries listed
// every project in a workspace to a client_viewer.
//
// MONEY. The agent could name a payment amount: for kind "full" the value came straight from the model and
// went to Stripe, with no server-side anchor to disagree with it.
//
// Behavioural against the real exported functions, plus source assertions for the wiring the DB cannot show.
import { readFileSync } from "node:fs";
import { hasAtLeastRole, isWorkspaceClientSafeOnly, canViewWorkspaceDashboard, type Role } from "../lib/v-workspace";
import {
  autoCeilingCents,
  authorizeAgentPayment,
  AUTO_MAX_CENTS,
  AUTO_FLOOR_CENTS,
  AUTO_MULTIPLE,
  MIN_CHARGE_CENTS,
  leadFacingRefusal,
} from "../lib/vraelis-payment-authz";
import type { VraelisWorkspace } from "../lib/vraelis-db";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const read = (p: string) => readFileSync(p, "utf8");

// ── 1. client_viewer is never "at least" any ladder role ───────────────────
console.log("── role ladder rejects the side role ──");
const LADDER: Exclude<Role, "client_viewer">[] = ["owner", "admin", "editor", "viewer"];
for (const min of LADDER) {
  ok(`client_viewer is not at least ${min}`, hasAtLeastRole("client_viewer", min) === false);
  ok(`null role is not at least ${min}`, hasAtLeastRole(null, min) === false);
  ok(`undefined role is not at least ${min}`, hasAtLeastRole(undefined, min) === false);
  ok(`"revoked" is not at least ${min}`, hasAtLeastRole("revoked" as Role, min) === false);
}
// Real roles keep working — the fix must not lock out legitimate members.
ok("owner is at least viewer", hasAtLeastRole("owner", "viewer") === true);
ok("admin is at least editor", hasAtLeastRole("admin", "editor") === true);
ok("editor is at least viewer", hasAtLeastRole("editor", "viewer") === true);
ok("editor is NOT at least admin", hasAtLeastRole("editor", "admin") === false);
ok("viewer is at least viewer", hasAtLeastRole("viewer", "viewer") === true);
ok("viewer is NOT at least editor", hasAtLeastRole("viewer", "editor") === false);
ok("client_viewer is flagged client-safe-only", isWorkspaceClientSafeOnly("client_viewer") === true);
ok("client_viewer cannot view the workspace dashboard", canViewWorkspaceDashboard("client_viewer") === false);
ok("viewer CAN view the workspace dashboard", canViewWorkspaceDashboard("viewer") === true);

// ── 2. The page guard now applies the ladder, and states its minimum ───────
console.log("── page guard wiring ──");
{
  const g = read("lib/v-preflight-guard.ts");
  ok("guard imports hasAtLeastRole", g.includes("hasAtLeastRole"));
  ok("guard takes a minRole defaulting to viewer", /minRole:\s*Exclude<Role,\s*"client_viewer">\s*=\s*"viewer"/.test(g));
  ok("guard denies when the ladder check fails", /if \(!hasAtLeastRole\(access\.role, minRole\)\) return null;/.test(g));
  ok("guard returns null rather than redirecting (honest empty state)", g.includes("return null;"));
  // SUPERSEDED IN PHASE 3. This used to assert the two settings pages raise their own gate to "editor".
  // That was the availability defect, not the protection: both pages already build a read-only branch for
  // every mutating control, and gating the PAGE made all of it unreachable — a viewer was told the system
  // did not exist. Raising a page gate never secured the writes; the routes do that, per method.
  //
  // The invariant that actually matters is asserted here instead, and in full by
  // scripts/phase3-settings-authz-verify.ts: the pages stay guarded at the read minimum, and no page
  // silently raises its own.
  for (const p of ["app/rank/app/systems/[id]/settings/page.tsx", "app/rank/app/systems/[id]/settings/connections/page.tsx"]) {
    ok(`${p.split("/").slice(-2).join("/")} is guarded at the read minimum, not raised`,
      /requirePreflightAppAccess\(/.test(read(p)) && !/requirePreflightAppAccess\([^)]*"editor"\)/.test(read(p)));
  }
}

// ── 3. Project listing is scoped for a client_viewer, and fails closed ────
console.log("── project listing scoping ──");
{
  const w = read("lib/v-workspace.ts");
  ok("summaries branch on the client-safe role", w.includes("isWorkspaceClientSafeOnly(selected.role)"));
  ok("summaries filter by explicit project membership", w.includes('.from("v_project_members" as never)'));
  ok("membership lookup is status-scoped", /\.eq\("status", "active"\)/.test(w));
  ok("a membership-lookup error shows NOTHING (fails closed)", /client_viewer project scoping failed[\s\S]{0,120}return empty;/.test(w));
  ok("the caller identity is carried on the selection", w.includes("viewerEmail: uid"));
  ok("SelectedWorkspace declares viewerEmail", /SelectedWorkspace = AvailableWorkspace & \{[^}]*viewerEmail: string/.test(w));
}

// ── 4. Cross-tenant lead writes are gated on ownership ────────────────────
console.log("── book route lead scoping ──");
{
  const b = read("app/api/vraelis/book/route.ts");
  const body = b.slice(b.indexOf("export async function POST")).replace(/^[ \t]*\/\/.*$/gm, "");
  ok("ownership is resolved before any use", body.includes("leadBelongsToOwner(workspace.owner_email, leadId)"));
  ok("createBooking receives the validated id", /leadId: ownedLeadId \|\| null,\s*[\r\n]+\s*slotIso/.test(body));
  ok("updateLeadContact receives the validated id", body.includes("updateLeadContact(ownedLeadId,"));
  ok("addMessage receives the validated id", body.includes("addMessage({ leadId: ownedLeadId,"));
  ok("setLeadStatus receives the validated id", body.includes("setLeadStatus(workspace.owner_email, ownedLeadId,"));
  ok("deposit metadata receives the validated id", body.includes("lead_id: ownedLeadId"));
  ok("no bare leadId reaches a write", !/updateLeadContact\(leadId|addMessage\(\{ leadId,|leadId: leadId \|\| null/.test(body));
  const d = read("lib/vraelis-db.ts");
  ok("the ownership check is owner-scoped", /leadBelongsToOwner[\s\S]{0,400}\.eq\("owner_email", normalizeEmail\(email\)\)/.test(d));
  ok("the ownership check fails closed on error", /leadBelongsToOwner[\s\S]{0,600}console\.error[\s\S]{0,80}return false;/.test(d));
}

// ── 5. Payment ceiling maths ──────────────────────────────────────────────
console.log("── payment ceiling ──");
const ws = (deposit: number | null): VraelisWorkspace =>
  ({ owner_email: "owner@example.com", deposit_amount_cents: deposit } as unknown as VraelisWorkspace);

ok("ceiling is deposit x multiple when that exceeds the floor",
  autoCeilingCents(ws(20_000)) === Math.min(20_000 * AUTO_MULTIPLE(), AUTO_MAX_CENTS()));
ok("ceiling falls back to the floor for a small deposit",
  autoCeilingCents(ws(2_500)) === AUTO_FLOOR_CENTS(), `got ${autoCeilingCents(ws(2_500))}`);
ok("ceiling is capped by the absolute maximum",
  autoCeilingCents(ws(10_000_000)) === AUTO_MAX_CENTS());
ok("a zero deposit still yields the floor", autoCeilingCents(ws(0)) === AUTO_FLOOR_CENTS());
ok("a null deposit still yields the floor", autoCeilingCents(ws(null)) === AUTO_FLOOR_CENTS());
ok("a negative deposit yields no ceiling (fails closed)", autoCeilingCents(ws(-1)) === null);
ok("the absolute maximum is never exceeded by any deposit",
  [0, 1, 2_500, 50_000, 1_000_000, 9_999_999].every((d) => (autoCeilingCents(ws(d)) ?? 0) <= AUTO_MAX_CENTS()));

// ── 6. Authorization refuses prompt-injected and malformed amounts ────────
// No DB is configured in this harness, so sumRecentPaymentCents returns null and the rolling-cap check
// fails closed. That IS the property under test for every case below: an amount can never be authorized
// when the ceiling cannot be established.
console.log("── authorization fails closed without a readable ledger ──");
(async () => {
  const INJECTED = [400_000, 1_000_000, 999_999_99, 250_000];
  for (const cents of INJECTED) {
    const r = await authorizeAgentPayment(ws(2_500), { kind: "full", proposedCents: cents });
    ok(`prompt-injected $${(cents / 100).toFixed(0)} is refused`, r.ok === false);
    if (!r.ok) ok(`  reason is a ceiling denial, not a silent clamp`, r.reason === "above_auto_ceiling" || r.reason === "ceiling_unavailable", r.reason);
  }
  // Above-ceiling must be refused, never clamped down to the ceiling.
  const above = await authorizeAgentPayment(ws(2_500), { kind: "full", proposedCents: AUTO_FLOOR_CENTS() + 1 });
  ok("an amount one cent over the ceiling is refused", above.ok === false);
  if (!above.ok) ok("  and is reported as above_auto_ceiling", above.reason === "above_auto_ceiling");
  ok("refusal never returns an amount to charge", !("amountCents" in above));

  for (const bad of [null, undefined, NaN, 0, -100, 1.5, Infinity]) {
    const r = await authorizeAgentPayment(ws(2_500), { kind: "full", proposedCents: bad as number });
    ok(`malformed amount ${String(bad)} is refused`, r.ok === false);
  }
  const tiny = await authorizeAgentPayment(ws(2_500), { kind: "full", proposedCents: MIN_CHARGE_CENTS - 1 });
  ok("below the provider minimum is refused", tiny.ok === false && tiny.reason === "below_minimum");

  // A deposit ignores the model entirely.
  const dep = await authorizeAgentPayment(ws(2_500), { kind: "deposit", proposedCents: 9_999_999 });
  ok("a deposit never uses the model's number", dep.ok === false || (dep.ok && dep.amountCents === 2_500));
  const noDep = await authorizeAgentPayment(ws(0), { kind: "deposit", proposedCents: 5_000 });
  ok("an unconfigured deposit is refused", noDep.ok === false && noDep.reason === "deposit_not_configured");

  // Fail-closed on an unreadable ledger, for an amount well inside the band.
  const inBand = await authorizeAgentPayment(ws(2_500), { kind: "full", proposedCents: 10_000 });
  ok("an in-band amount is still refused when the ledger cannot be read", inBand.ok === false);
  if (!inBand.ok) ok("  and the reason names the unavailable ceiling", inBand.reason === "ceiling_unavailable", inBand.reason);

  // The lead-facing message must not teach a manipulator where the line is.
  const msg = leadFacingRefusal();
  ok("the refusal message leaks no limit", !/\d/.test(msg) && !/ceiling|limit|cap|maximum/i.test(msg), msg);

  // ── 7. Wiring: every agent payment path goes through authorization ──────
  console.log("── all three agent payment paths ──");
  for (const f of [
    "app/api/vraelis/sms/inbound/route.ts",
    "app/api/vraelis/inbound/email/route.ts",
    "app/api/vraelis/intake/continue/route.ts",
  ]) {
    const s = read(f);
    const label = f.split("/").slice(-3, -1).join("/");
    ok(`${label} authorizes before charging`, s.includes("await authorizeAgentPayment("));
    ok(`${label} charges the authorized amount`, s.includes("amountCents: authz.amountCents"));
    ok(`${label} no longer computes the amount inline`, !/const amountCents = ai\.payment\.kind === "deposit"/.test(s));
    // The shorthand property `amountCents,` was the model value; `amountCents: authz.amountCents,` is
    // the authorized one, so match the shorthand form specifically.
    ok(`${label} passes no bare model amount (shorthand property)`, !/^[ \t]*amountCents,[ \t]*$/m.test(s));
    ok(`${label} clamps the model-written description`, s.includes(".trim().slice(0, 120)"));
    ok(`${label} carries no raw control characters`, !/[\u2028\u2029\0]/.test(s));
  }
})().then(() => {
  const pkg = read("package.json");
  ok("package.json exposes phase2:tenant:test", pkg.includes(`"phase2:tenant:test"`));
  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
});
