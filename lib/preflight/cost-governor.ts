// Cost governor + velocity cap + circuit breaker (revenue-protection blocker 3). Server-only. Tracks
// estimated PROVIDER cost (never customer price/revenue), enforces global $/hour + $/day ceilings that
// AUTO-PAUSE new runs (DB-durable, survives redeploys), a per-account per-hour session-velocity cap, and
// a per-account circuit breaker on provider/infra failures. All thresholds are env-configurable; the
// defaults are the private-beta values (founder ruling).
//
// Escalation ladder (per ceiling): warn at 50%, founder alert at 80%, AUTO-PAUSE at 100%. Auto-pause
// pauses NEW runs only — in-flight finishes but is never auto-retried. The global trip is reset ONLY by
// an audited operator action (this module never clears paused on its own).

import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";

function norm(e: string): string { return e.trim().toLowerCase(); }
function db() { return getSupabaseAdminClient(); }
function envInt(name: string, dflt: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : dflt;
}

// ── Provider cost estimation (PROVIDER cost in CENTS; env-configurable rates) ─────────────────────────
// Rough, deliberately conservative estimates — the governor only needs to bound spend, not bill it.
// Rates are in micro-cents to keep the math in integers where useful, but we expose plain cents helpers.
const BROWSERBASE_CENTS_PER_MIN = () => envInt("COST_BROWSERBASE_CENTS_PER_MIN", 2); // ~$0.02/min default
const AI_CENTS_PER_1K_TOKENS = () => envInt("COST_AI_CENTS_PER_1K_TOKENS", 1);       // ~$0.01/1k default
const ARTIFACT_CENTS_PER_MB = () => envInt("COST_ARTIFACT_CENTS_PER_MB", 0);         // storage ~free/default 0

export function estimateProviderCents(input: { browserbaseSeconds?: number; aiTokens?: number; artifactBytes?: number }): number {
  const bbMin = Math.ceil(Math.max(0, input.browserbaseSeconds ?? 0) / 60);
  const aiK = Math.ceil(Math.max(0, input.aiTokens ?? 0) / 1000);
  const mb = Math.ceil(Math.max(0, input.artifactBytes ?? 0) / (1024 * 1024));
  return bbMin * BROWSERBASE_CENTS_PER_MIN() + aiK * AI_CENTS_PER_1K_TOKENS() + mb * ARTIFACT_CENTS_PER_MB();
}

// Record a run's estimated provider cost. Best-effort: a governor write must never break settlement.
export async function recordProviderCost(input: {
  owner: string | null; runId: string | null;
  browserbaseSeconds?: number; aiTokens?: number; artifactBytes?: number; estimatedCents?: number;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const cents = input.estimatedCents ?? estimateProviderCents(input);
  try {
    await db().from("v_cost_ledger" as never).insert({
      user_id: input.owner ? norm(input.owner) : null, run_id: input.runId,
      browserbase_seconds: Math.max(0, Math.round(input.browserbaseSeconds ?? 0)),
      ai_tokens: Math.max(0, Math.round(input.aiTokens ?? 0)),
      artifact_bytes: Math.max(0, Math.round(input.artifactBytes ?? 0)),
      estimated_cents: Math.max(0, Math.round(cents)),
    } as never);
  } catch { /* governor accounting never breaks a run */ }
}

// ── Global ceilings + auto-pause ─────────────────────────────────────────────────────────────────────
export const HOURLY_CEILING_CENTS = () => envInt("COST_HOURLY_CEILING_CENTS", 200); // $2.00/rolling hour
export const DAILY_CEILING_CENTS = () => envInt("COST_DAILY_CEILING_CENTS", 800);   // $8.00/UTC day
const WARN_PCT = () => envInt("COST_WARN_PCT", 50);
const ALERT_PCT = () => envInt("COST_ALERT_PCT", 80);

async function sumCostSince(iso: string): Promise<number | null> {
  if (!isDatabaseConfigured()) return null;
  const { data, error } = await db().from("v_cost_ledger" as never)
    .select("estimated_cents").gte("created_at", iso).limit(100000);
  if (error) return null;
  return ((data as { estimated_cents?: number }[] | null) ?? []).reduce((s, r) => s + (Number(r.estimated_cents) || 0), 0);
}

// Is the runs governor currently paused (DB-durable auto-pause OR operator pause)? Read on the launch hot
// path. FAIL-OPEN on a read error (return false): the env kill switch VRAELIS_RUNS_DISABLED remains the
// hard manual brake, and the ledger-sum recompute in maybeTripGlobalBudget re-pauses on the next check —
// a transient read blip does not durably unpause anything (nothing here writes paused=false).
export async function isRunsGovernorPaused(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const { data, error } = await db().from("v_runs_governor" as never)
    .select("paused").eq("id", "global").maybeSingle();
  if (error || !data) return false;
  return Boolean((data as { paused?: boolean }).paused);
}

export type GovernorStatus = {
  paused: boolean; pausedBy: string | null; reason: string | null;
  thresholdCents: number | null; usageCents: number | null;
  hourlyUsageCents: number | null; dailyUsageCents: number | null;
  hourlyCeilingCents: number; dailyCeilingCents: number;
  resetGraceUntil: string | null;
};

export async function governorStatus(): Promise<GovernorStatus> {
  const hourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  const [row, hourly, daily] = await Promise.all([
    isDatabaseConfigured() ? db().from("v_runs_governor" as never).select("paused, paused_by, last_reason, last_threshold_cents, last_usage_cents, reset_grace_until").eq("id", "global").maybeSingle() : Promise.resolve({ data: null }),
    sumCostSince(hourAgo), sumCostSince(dayStart.toISOString()),
  ]);
  const r = (row as { data?: Record<string, unknown> | null }).data ?? null;
  return {
    paused: Boolean(r?.paused), pausedBy: (r?.paused_by as string) ?? null, reason: (r?.last_reason as string) ?? null,
    thresholdCents: (r?.last_threshold_cents as number) ?? null, usageCents: (r?.last_usage_cents as number) ?? null,
    hourlyUsageCents: hourly, dailyUsageCents: daily,
    hourlyCeilingCents: HOURLY_CEILING_CENTS(), dailyCeilingCents: DAILY_CEILING_CENTS(),
    resetGraceUntil: (r?.reset_grace_until as string) ?? null,
  };
}

// Evaluate both ceilings and AUTO-PAUSE at 100%. Called after a run settles (records cost). Warn/alert
// are logged (operator alerting channel); the pause is the durable brake. Never UNpauses (reset is
// operator-only). Returns what it did for the caller's log.
export async function maybeTripGlobalBudget(): Promise<{ tripped: boolean; scope?: "hourly" | "daily" }> {
  if (!isDatabaseConfigured()) return { tripped: false };
  // Reset grace (Finding 4): an operator reset stamps reset_grace_until. While it is in the future, the
  // auto-trip is suppressed so the already-counted in-window spend does not instantly re-pause a governor
  // the operator just deliberately un-paused. (The env kill switch + a manual re-pause remain available.)
  {
    const { data: g } = await db().from("v_runs_governor" as never)
      .select("reset_grace_until, paused").eq("id", "global").maybeSingle();
    const row = g as { reset_grace_until?: string | null; paused?: boolean } | null;
    if (row?.paused) return { tripped: false }; // already paused — nothing to do (reset is operator-only)
    if (row?.reset_grace_until && new Date(row.reset_grace_until).getTime() > Date.now()) return { tripped: false };
  }
  const hourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  const [hourly, daily] = await Promise.all([sumCostSince(hourAgo), sumCostSince(dayStart.toISOString())]);
  const checks: { scope: "hourly" | "daily"; usage: number | null; ceiling: number }[] = [
    { scope: "hourly", usage: hourly, ceiling: HOURLY_CEILING_CENTS() },
    { scope: "daily", usage: daily, ceiling: DAILY_CEILING_CENTS() },
  ];
  for (const c of checks) {
    if (c.usage == null || c.ceiling <= 0) continue;
    const pct = (c.usage / c.ceiling) * 100;
    if (pct >= 100) {
      await pauseRunsGovernor(`cost_governor:${c.scope}`, `${c.scope} provider-cost ceiling reached`, c.ceiling, c.usage);
      console.error(`[cost-governor] AUTO-PAUSE: ${c.scope} usage ${c.usage}c >= ceiling ${c.ceiling}c — new runs paused.`);
      return { tripped: true, scope: c.scope };
    }
    if (pct >= ALERT_PCT()) console.error(`[cost-governor] ALERT: ${c.scope} usage ${c.usage}c is ${pct.toFixed(0)}% of ${c.ceiling}c ceiling (founder alert threshold).`);
    else if (pct >= WARN_PCT()) console.warn(`[cost-governor] WARN: ${c.scope} usage ${c.usage}c is ${pct.toFixed(0)}% of ${c.ceiling}c ceiling.`);
  }
  return { tripped: false };
}

// Set the durable pause. Idempotent-ish: only stamps paused_at/reason when transitioning to paused so a
// repeat trip does not churn the row. NEVER clears paused (reset is operator-only via resetRunsGovernor).
async function pauseRunsGovernor(by: string, reason: string, thresholdCents: number, usageCents: number): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    await db().from("v_runs_governor" as never).update({
      paused: true, paused_at: new Date().toISOString(), paused_by: by,
      last_reason: reason, last_threshold_cents: thresholdCents, last_usage_cents: usageCents, updated_at: new Date().toISOString(),
    } as never).eq("id", "global").eq("paused", false); // only the FIRST trip stamps the reason
  } catch { /* best-effort; the env kill switch is the manual backstop */ }
}

// Operator-only reset of the global trip (audited by the caller). Returns true if a paused row flipped.
// Stamps reset_grace_until (env COST_RESET_GRACE_MIN, default 15m) so the already-counted in-window spend
// does not instantly re-pause — otherwise a manual reset looks broken (one launch re-trips it). During the
// grace the auto-trip is suppressed; the operator can still manually re-pause and the env kill switch works.
export async function resetRunsGovernor(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const graceMin = envInt("COST_RESET_GRACE_MIN", 15);
  const graceUntil = new Date(Date.now() + graceMin * 60 * 1000).toISOString();
  const { data, error } = await db().from("v_runs_governor" as never)
    .update({ paused: false, paused_at: null, paused_by: null, last_reason: null, reset_grace_until: graceUntil, updated_at: new Date().toISOString() } as never)
    .eq("id", "global").eq("paused", true).select("id");
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

// Operator-only MANUAL pause (audited by the caller) — the durable equivalent of the env kill switch.
export async function operatorPauseRunsGovernor(operator: string, reason: string): Promise<void> {
  await pauseRunsGovernor(operator, reason || "operator manual pause", 0, 0);
}

// Global in-flight concurrency brake (Finding 2): the cost auto-pause is check-then-write, so a burst can
// slip through between the pause read and the pause write. A hard cap on the TOTAL number of in-flight
// runs across all accounts bounds how far a burst can outrun the pause (and bounds provider concurrency
// spend directly). Env COST_GLOBAL_MAX_ACTIVE_RUNS (default 12); 0 disables. Fails OPEN on a read error
// (the per-account cap + billing hold remain). Returns true when the global cap is reached (refuse).
export const GLOBAL_MAX_ACTIVE_RUNS = () => envInt("COST_GLOBAL_MAX_ACTIVE_RUNS", 12);

export async function globalActiveRunsAtCap(): Promise<boolean> {
  const cap = GLOBAL_MAX_ACTIVE_RUNS();
  if (cap <= 0 || !isDatabaseConfigured()) return false;
  const { count, error } = await db().from("v_preflight_runs" as never)
    .select("id", { count: "exact", head: true }).in("state", ["queued", "discovering", "running", "analyzing"]);
  if (error) return false;
  return (count ?? 0) >= cap;
}

// ── Per-account velocity cap + circuit breaker ───────────────────────────────────────────────────────
export const SESSIONS_PER_HOUR = () => envInt("COST_SESSIONS_PER_HOUR", 8);
const BREAKER_FAILS = () => envInt("COST_BREAKER_FAILS", 3);
const BREAKER_WINDOW_MIN = () => envInt("COST_BREAKER_WINDOW_MIN", 15);
const BREAKER_COOLDOWN_MIN = () => envInt("COST_BREAKER_COOLDOWN_MIN", 60);

// Record a provider session attempt (outcome 'session' normally, 'infra_failure' when the provider/infra
// failed). On an infra failure, evaluate the breaker (3 fails / 15 min -> OPEN, 60-min cooldown).
export async function recordProviderAttempt(owner: string, runId: string | null, outcome: "session" | "infra_failure"): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const uid = norm(owner);
  try {
    await db().from("v_provider_attempts" as never).insert({ user_id: uid, run_id: runId, outcome } as never);
    if (outcome === "infra_failure") await maybeTripBreaker(uid);
  } catch { /* best-effort */ }
}

async function maybeTripBreaker(uid: string): Promise<void> {
  const since = new Date(Date.now() - BREAKER_WINDOW_MIN() * 60 * 1000).toISOString();
  const { data, error } = await db().from("v_provider_attempts" as never)
    .select("id").eq("user_id", uid).eq("outcome", "infra_failure").gte("created_at", since).limit(100);
  if (error) return;
  const fails = ((data as unknown[]) ?? []).length;
  if (fails >= BREAKER_FAILS()) {
    const until = new Date(Date.now() + BREAKER_COOLDOWN_MIN() * 60 * 1000).toISOString();
    try {
      await db().from("v_provider_breaker" as never).upsert({
        user_id: uid, breaker_open: true, breaker_until: until,
        opened_reason: `${fails} provider failures in ${BREAKER_WINDOW_MIN()}m`, updated_at: new Date().toISOString(),
      } as never, { onConflict: "user_id" } as never);
      console.error(`[cost-governor] BREAKER OPEN for ${uid}: ${fails} infra failures in ${BREAKER_WINDOW_MIN()}m; cooldown ${BREAKER_COOLDOWN_MIN()}m.`);
    } catch { /* best-effort */ }
  }
}

// The per-account launch guard: is this account over the hourly session cap, or is its breaker OPEN and
// still cooling down? Returns a refusal reason or null (allowed). FAIL-OPEN on read error (null): these
// are velocity guards, not the hard spend limit (the billing hold + global governor are), so a transient
// blip must not lock a paying user out. The circuit breaker's cooldown self-clears by time (breaker_until).
export type VelocityRefusal = { reason: "session_velocity" | "circuit_open"; retryAfterSec: number; message: string };

export async function checkAccountVelocity(owner: string): Promise<VelocityRefusal | null> {
  if (!isDatabaseConfigured()) return null;
  const uid = norm(owner);
  // Breaker first (a tripped account is fully paused for the cooldown, cheaper than the count query).
  const { data: brk } = await db().from("v_provider_breaker" as never)
    .select("breaker_open, breaker_until").eq("user_id", uid).maybeSingle();
  const b = brk as { breaker_open?: boolean; breaker_until?: string | null } | null;
  if (b?.breaker_open && b.breaker_until) {
    const untilMs = new Date(b.breaker_until).getTime();
    if (untilMs > Date.now()) {
      return { reason: "circuit_open", retryAfterSec: Math.ceil((untilMs - Date.now()) / 1000),
        message: "Too many provider failures on this account. Automated runs are paused briefly; please try again shortly." };
    }
  }
  // Rolling-hour session velocity.
  const hourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
  const { count, error } = await db().from("v_provider_attempts" as never)
    .select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", hourAgo);
  if (error) return null;
  if ((count ?? 0) >= SESSIONS_PER_HOUR()) {
    return { reason: "session_velocity", retryAfterSec: 3600,
      message: "You've launched a lot of passes this hour. Please wait a bit before launching more." };
  }
  return null;
}
