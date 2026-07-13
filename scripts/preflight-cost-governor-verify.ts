// Cost governor + velocity cap + circuit breaker, verified (revenue-protection blocker 3). Pure tests of
// the cost-estimation + env-threshold math, plus STATIC source checks of the security-critical contracts
// that need a live DB to exercise: auto-pause is DB-durable and reset is operator-only, launches fail
// BEFORE billing while paused, the breaker trips only on provider/infra failures (not app defects), and
// the admin surface exposes reason/threshold/usage/reset + a SEPARATE emergency halt. No DB, no network.
import fs from "node:fs";
import path from "node:path";
import { estimateProviderCents, HOURLY_CEILING_CENTS, DAILY_CEILING_CENTS, SESSIONS_PER_HOUR } from "../lib/preflight/cost-governor";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");

function main(): void {
  // ── Cost estimation: PROVIDER cost, integer cents, conservative rounding UP (never under-counts spend). ──
  ok("browserbase minutes round UP (a partial minute still counts toward the ceiling)",
    estimateProviderCents({ browserbaseSeconds: 61 }) === estimateProviderCents({ browserbaseSeconds: 120 }));
  ok("zero usage is zero cost", estimateProviderCents({}) === 0);
  ok("estimate combines browserbase + ai + artifact components", estimateProviderCents({ browserbaseSeconds: 60, aiTokens: 1000, artifactBytes: 0 }) >= estimateProviderCents({ browserbaseSeconds: 60 }));
  ok("negative inputs never produce negative cost", estimateProviderCents({ browserbaseSeconds: -100, aiTokens: -5 }) === 0);

  // ── Env-configurable thresholds default to the private-beta values ($2/hr, $8/day, 8 sessions/hr). ──
  delete process.env.COST_HOURLY_CEILING_CENTS; delete process.env.COST_DAILY_CEILING_CENTS; delete process.env.COST_SESSIONS_PER_HOUR;
  ok("default hourly ceiling is $2.00 (200c)", HOURLY_CEILING_CENTS() === 200);
  ok("default daily ceiling is $8.00 (800c)", DAILY_CEILING_CENTS() === 800);
  ok("default session velocity is 8/hour", SESSIONS_PER_HOUR() === 8);
  process.env.COST_HOURLY_CEILING_CENTS = "500";
  ok("hourly ceiling is env-configurable", HOURLY_CEILING_CENTS() === 500);
  delete process.env.COST_HOURLY_CEILING_CENTS;

  const cg = read("lib", "preflight", "cost-governor.ts");
  // ── Auto-pause is DB-durable and reset is OPERATOR-ONLY (the module never clears paused on its own). ──
  ok("maybeTripGlobalBudget AUTO-PAUSES at >=100% of a ceiling", /if \(pct >= 100\)[\s\S]*?pauseRunsGovernor/.test(cg));
  ok("the escalation ladder is warn 50% -> alert 80% -> pause 100%", /ALERT_PCT\(\)/.test(cg) && /WARN_PCT\(\)/.test(cg) && /pct >= 100/.test(cg));
  // Scope to the pauseRunsGovernor body (up to the next 'export') so the check doesn't leak into
  // resetRunsGovernor, which legitimately clears paused.
  const pauseBody = cg.slice(cg.indexOf("async function pauseRunsGovernor"), cg.indexOf("export async function resetRunsGovernor"));
  ok("pauseRunsGovernor only ever SETS paused=true (never clears it)", /paused: true/.test(pauseBody) && !/paused: false/.test(pauseBody));
  ok("resetRunsGovernor is the ONLY path that clears paused (operator-only)", /resetRunsGovernor[\s\S]*?paused: false[\s\S]*?\.eq\("paused", true\)/.test(cg));
  ok("the pause is read from the DB (durable, survives redeploys), not an env var", /isRunsGovernorPaused[\s\S]*?from\("v_runs_governor"[\s\S]*?\.select\("paused"\)/.test(cg));
  // The COST SUM must draw from the provider-cost ledger's estimated_cents column — assert the source
  // positively (a header comment mentioning "price/revenue" is fine; the query column is what matters).
  ok("ceilings track PROVIDER cost (v_cost_ledger.estimated_cents), never price/revenue", /sumCostSince[\s\S]*?from\("v_cost_ledger"[\s\S]*?estimated_cents/.test(cg) && !/\.select\("(price|amount_paid|revenue)/.test(cg));

  // ── Breaker trips ONLY on provider/infra failures within the window; velocity is a rolling-hour count. ──
  ok("the breaker trips at BREAKER_FAILS infra failures within BREAKER_WINDOW_MIN", /maybeTripBreaker[\s\S]*?outcome", "infra_failure"[\s\S]*?fails >= BREAKER_FAILS\(\)/.test(cg));
  ok("the breaker opens with a cooldown (breaker_until)", /breaker_open: true, breaker_until: until/.test(cg));
  ok("checkAccountVelocity refuses when the breaker is open AND still cooling down", /breaker_open && b\.breaker_until[\s\S]*?untilMs > Date\.now\(\)[\s\S]*?reason: "circuit_open"/.test(cg));
  ok("checkAccountVelocity refuses over the rolling-hour session cap", /count \?\? 0\) >= SESSIONS_PER_HOUR\(\)[\s\S]*?reason: "session_velocity"/.test(cg));

  // ── Launches fail BEFORE billing while paused / throttled (both routes). ──
  for (const route of [["app", "api", "preflight", "apps", "[id]", "runs", "route.ts"], ["app", "api", "preflight", "runs", "[runId]", "rerun", "route.ts"]]) {
    const src = read(...route);
    const label = route.includes("rerun") ? "rerun route" : "app run route";
    const iPause = src.indexOf("isRunsGovernorPaused");
    const iVelocity = src.indexOf("checkAccountVelocity");
    const iHold = src.indexOf("gatePassLaunch("); // billing decision
    ok(`${label}: auto-pause + velocity are checked BEFORE the billing gate`, iPause >= 0 && iVelocity >= 0 && iHold >= 0 && iPause < iHold && iVelocity < iHold);
    ok(`${label}: a paused governor returns 503 runs_paused (same as the kill switch)`, /isRunsGovernorPaused\(\)\) \{[\s\S]*?runs_paused[\s\S]*?503/.test(src));
    ok(`${label}: velocity refusal returns 429 with Retry-After`, /checkAccountVelocity\(owner\)[\s\S]*?status: 429, headers: \{ "Retry-After"/.test(src));
    ok(`${label}: records the provider attempt + launch cost + evaluates the ceiling after queueing`, /recordProviderAttempt\(owner, created\.runId, "session"\)[\s\S]*?recordProviderCost[\s\S]*?maybeTripGlobalBudget\(\)/.test(src));
  }

  // ── The worker records provider/infra failures for the breaker; NOT app-defect failures. ──
  const store = read("worker", "preflight", "run-store-postgres.ts");
  ok("the worker records an infra_failure attempt ONLY for provider/infra failure codes",
    /PROVIDER_INFRA_FAILURE\.has\(code\)[\s\S]*?outcome: "infra_failure"/.test(store));
  // Scope to the PROVIDER_INFRA_FAILURE Set literal only (up to its closing bracket) so we check that
  // specific set, not the whole file (auth_rejected_by_app appears elsewhere in worker code legitimately).
  const infraSetLiteral = store.slice(store.indexOf("const PROVIDER_INFRA_FAILURE"), store.indexOf("]);", store.indexOf("const PROVIDER_INFRA_FAILURE")));
  ok("the infra-failure set excludes app-defect failures (auth_rejected_by_app / a broken journey are NOT infra)",
    /"provider_infra_failure"/.test(infraSetLiteral) && /"worker_vault_failure"/.test(infraSetLiteral) && !/auth_rejected_by_app/.test(infraSetLiteral) && !/target_mismatch/.test(infraSetLiteral));

  // ── Admin surface: status (reason/threshold/usage) + operator reset + SEPARATE emergency halt. ──
  const admin = read("app", "api", "v", "admin", "governor", "route.ts");
  ok("admin governor route is admin-gated on both verbs", (admin.match(/if \(!isAdmin\(/g) ?? []).length >= 2);
  ok("GET returns the status (reason/threshold/usage) via governorStatus", /governorStatus\(\)/.test(admin));
  ok("operator reset is audited (governor_reset event)", /action === "reset"[\s\S]*?governor_reset/.test(admin));
  ok("the emergency halt is a SEPARATE action that cancels in-flight (not the auto-trip)", /action === "emergency_halt"[\s\S]*?cancel_requested_at[\s\S]*?governor_emergency_halt/.test(admin));

  // ── FIX F1 (CRITICAL): the breaker allowlist must match EVERY code classifyProviderError emits, or the
  //    most common failures (429 capacity, timeout, run_error) silently bypass the breaker. ──
  const classifier = read("worker", "preflight", "provider-errors.ts");
  const classifierCodes = [...classifier.matchAll(/code: "([a-z_]+)"/g)].map((m) => m[1]);
  const uniqueClassifierCodes = [...new Set(classifierCodes)];
  ok("the classifier emits >=6 distinct provider codes (sanity)", uniqueClassifierCodes.length >= 6);
  const infraSetFull = store.slice(store.indexOf("const PROVIDER_INFRA_FAILURE"), store.indexOf("]);", store.indexOf("const PROVIDER_INFRA_FAILURE")));
  ok("EVERY classifier code is in the breaker's PROVIDER_INFRA_FAILURE set (no allowlist drift)",
    uniqueClassifierCodes.every((c) => infraSetFull.includes(`"${c}"`)), uniqueClassifierCodes.filter((c) => !infraSetFull.includes(`"${c}"`)).join(",") || "all present");
  ok("the breaker set specifically includes provider_capacity (429) + session_timeout + run_error",
    infraSetFull.includes('"provider_capacity"') && infraSetFull.includes('"session_timeout"') && infraSetFull.includes('"run_error"'));

  // ── FIX F2: a global in-flight brake bounds how far a burst outruns the auto-pause. ──
  ok("globalActiveRunsAtCap counts ALL in-flight runs against COST_GLOBAL_MAX_ACTIVE_RUNS", /globalActiveRunsAtCap[\s\S]*?GLOBAL_MAX_ACTIVE_RUNS\(\)[\s\S]*?in\("state", \["queued", "discovering", "running", "analyzing"\]\)/.test(cg));
  for (const route of [["app", "api", "preflight", "apps", "[id]", "runs", "route.ts"], ["app", "api", "preflight", "runs", "[runId]", "rerun", "route.ts"]]) {
    ok(`${route.includes("rerun") ? "rerun" : "app run"} route: the global brake is checked and returns 503 runs_busy`,
      /globalActiveRunsAtCap\(\)\) \{[\s\S]*?runs_busy[\s\S]*?503/.test(read(...route)));
  }

  // ── FIX F3: the worker records REAL provider cost at settlement (not only the launch estimate). ──
  ok("the worker records real executed provider time at settlement (recordRealProviderCost sums step ms)",
    /recordRealProviderCost[\s\S]*?from\("v_run_steps"\)\.select\("ms"\)[\s\S]*?insert\(\{[\s\S]*?browserbase_seconds: seconds/.test(store));
  ok("finalizeRun calls recordRealProviderCost (best-effort, after settlement)",
    /finalizeRun[\s\S]*?recordRealProviderCost\(runId\)/.test(store));

  // ── FIX F4: an operator reset gets a grace window so already-counted in-window spend doesn't re-trip. ──
  ok("resetRunsGovernor stamps reset_grace_until (COST_RESET_GRACE_MIN)", /resetRunsGovernor[\s\S]*?reset_grace_until: graceUntil/.test(cg));
  ok("maybeTripGlobalBudget suppresses the auto-trip during the reset grace window",
    /reset_grace_until[\s\S]*?new Date\(row\.reset_grace_until\)\.getTime\(\) > Date\.now\(\)\) return \{ tripped: false \}/.test(cg));
  ok("the migration adds reset_grace_until to v_runs_governor", /reset_grace_until timestamptz/.test(read("sql", "vraelis-preflight-11-cost-governor.sql")));

  // ── Migration is additive with the durable governor row + cost ledger + attempts/breaker tables. ──
  const mig = read("sql", "vraelis-preflight-11-cost-governor.sql");
  ok("v_runs_governor is a single durable row ('global') with paused + trip metadata", /create table if not exists public\.v_runs_governor[\s\S]*?id text primary key default 'global'[\s\S]*?paused boolean/.test(mig));
  ok("v_cost_ledger + v_provider_attempts + v_provider_breaker all exist",
    /create table if not exists public\.v_cost_ledger/.test(mig) && /create table if not exists public\.v_provider_attempts/.test(mig) && /create table if not exists public\.v_provider_breaker/.test(mig));

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
}

main();
