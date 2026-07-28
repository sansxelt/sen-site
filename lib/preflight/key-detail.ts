// EVERYTHING ABOUT ONE KEY, FOR THE PAGE YOU OPEN BY CLICKING IT.
//
// key-usage.ts answers "what has this key cost me" as four figures and a recent list, which is the right
// answer to that question and the wrong amount of page. A key is the thing a customer points their CI at,
// and when something looks wrong the questions are sharper than a total: is it spending more per run than
// it used to, is it failing more than it passes, when does it actually get used, and how long do its
// verifications take.
//
// This is that layer. It reuses key-usage for every money figure rather than recomputing one, for the
// reason stated at the top of that file: the number a customer reads about money must be the number the
// ceiling enforces, and a second implementation is how those two start disagreeing.
//
// WHAT THIS DELIBERATELY DOES NOT REPORT.
//
//   Tokens. There is no token metric. v_cost_ledger.ai_tokens is written by exactly one code path, the
//   agent client, which passes runId: null, and the customer verification path records none at all.
//   Production carries 0 tokens across 62 ledger rows and 43 runs. A per-key token figure would be
//   invented, and this product is the last one that should be inventing a number.
//
//   Browser minutes as the cost governor estimates them. estimateProviderCents derives them as
//   flow_units * 60, so a run whose real wall-clock duration is 9 seconds is booked as 60. That is a
//   deliberately conservative bound for capping spend and a lie on a customer's page. Duration here is
//   measured from started_at to completed_at, which production populates on 41 of 43 runs.
//
// INVALIDATED RUNS ARE COUNTED FOR MONEY AND EXCLUDED FROM VERDICTS. A run whose verdict was withdrawn
// through ops/invalidate-run.ts still charged what it charged; pretending otherwise would make the spend
// on this page disagree with the customer's card. But its CONCLUSION no longer stands, so counting it in a
// pass rate would be reporting a verdict the company has formally retracted. They are reported separately
// and by name.
import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";
import { keyUsage, chargedCentsOf, type KeyUsage, type RunRow } from "./key-usage";
import { runVerdict, type Tone } from "./home-verdict";

// Runs carry more than key-usage needs. Everything added here is a column production actually populates.
export type DetailRunRow = RunRow & {
  started_at: string | null;
  completed_at: string | null;
  invalidated_at: string | null;
  guarantee_id: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC day key, matching the ceiling's own UTC-midnight reset so a day here means the day it enforces. */
export function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * REAL duration, in seconds, or null.
 *
 * Null rather than zero when either end is missing: a run still in flight has no duration, and reporting
 * it as 0s would drag an average toward a number no run ever took. Production has both timestamps on 41 of
 * 43 runs, so this is a measurement and not a fallback.
 */
export function durationSecondsOf(r: Pick<DetailRunRow, "started_at" | "completed_at" | "created_at">): number | null {
  const start = Date.parse(r.started_at ?? r.created_at);
  const end = r.completed_at ? Date.parse(r.completed_at) : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const secs = (end - start) / 1000;
  return secs >= 0 ? secs : null;                       // a negative span is a clock artefact, not a duration
}

export type DurationStats = { count: number; medianSeconds: number | null; p95Seconds: number | null; longestSeconds: number | null };

/**
 * Median and p95, NOT mean. One 155-second run against a median of 9 drags a mean to something no run
 * resembles, and "typical" is the question being asked. p95 carries the tail that a mean would hide.
 */
export function durationStats(rows: DetailRunRow[]): DurationStats {
  const secs = rows.map(durationSecondsOf).filter((s): s is number => s != null).sort((a, b) => a - b);
  if (!secs.length) return { count: 0, medianSeconds: null, p95Seconds: null, longestSeconds: null };
  const at = (q: number) => secs[Math.min(secs.length - 1, Math.floor(q * secs.length))];
  return { count: secs.length, medianSeconds: at(0.5), p95Seconds: at(0.95), longestSeconds: secs[secs.length - 1] };
}

export type VerdictTally = {
  verified: number; failed: number; blocked: number; inProgress: number; unproven: number;
  invalidated: number; decided: number; passRate: number | null;
};

/**
 * Verdicts through the ONE canonical translator, never from the raw decision column.
 *
 * The raw column carries ready / needs_review / blocked / repair_verified / infra_failure, which is the
 * engine's vocabulary and not the customer's. runVerdict delegates to toPublicDecision, the same function
 * the public API, the outbound webhook and the CI gate render through, so a pass rate here cannot disagree
 * with the exit code a customer's pipeline saw. That includes repair_verified mapping to blocked: a
 * targeted repair rerun did not pass the full scope, and counting it as a pass would inflate this figure
 * with exactly the claim the product exists to refuse.
 */
export function verdictTally(rows: DetailRunRow[]): VerdictTally {
  const t: VerdictTally = { verified: 0, failed: 0, blocked: 0, inProgress: 0, unproven: 0, invalidated: 0, decided: 0, passRate: null };
  for (const r of rows) {
    if (r.invalidated_at) { t.invalidated++; continue; }   // withdrawn: counted, never scored
    const tone: Tone = runVerdict(String(r.state ?? ""), r.decision).tone;
    if (tone === "verified") t.verified++;
    else if (tone === "failed") t.failed++;
    else if (tone === "blocked") t.blocked++;
    else if (tone === "progress") t.inProgress++;
    else t.unproven++;
  }
  t.decided = t.verified + t.failed + t.blocked;
  // Undefined rather than 0 when nothing has been decided. A key that has never run anything has no pass
  // rate; rendering 0% would accuse it of failing.
  t.passRate = t.decided > 0 ? t.verified / t.decided : null;
  return t;
}

export type CostStats = {
  paidRuns: number; planRuns: number; freeRuns: number;
  totalCents: number; meanCentsPerPaidRun: number | null; medianCentsPerPaidRun: number | null;
};

/**
 * Cost per verification, over the runs that were ACTUALLY CHARGED.
 *
 * Averaging plan-covered runs in would report a per-verification cost far below what the next PAYG run
 * will cost, because a subscriber's run is 0 dollars and a real number of flow units. The three counts are
 * returned beside the average so the page can say which population the figure describes instead of
 * printing a number whose denominator is a guess.
 */
export function costStats(rows: DetailRunRow[]): CostStats {
  const charged = rows.map(chargedCentsOf);
  const paid = charged.filter((c) => c > 0).sort((a, b) => a - b);
  const planRuns = rows.filter((r, i) => charged[i] === 0 && (Number(r.flow_units) || 0) > 0).length;
  return {
    paidRuns: paid.length,
    planRuns,
    freeRuns: rows.length - paid.length - planRuns,
    totalCents: charged.reduce((s, c) => s + c, 0),
    meanCentsPerPaidRun: paid.length ? Math.round(paid.reduce((s, c) => s + c, 0) / paid.length) : null,
    medianCentsPerPaidRun: paid.length ? paid[Math.floor(paid.length / 2)] : null,
  };
}

export type DayBucket = { day: string; runs: number; chargedCents: number; verified: number; failed: number; blocked: number };

/**
 * One row per calendar day, INCLUDING the days nothing happened.
 *
 * Emitting only the days with activity is what turns a sparse chart into a lie about tempo: three runs on
 * three separate weeks render as three adjacent bars and read as a busy stretch. Every day in the window is
 * present, so a gap looks like a gap.
 */
export function bucketByDay(rows: DetailRunRow[], opts: { nowMs: number; days: number }): DayBucket[] {
  const out: DayBucket[] = [];
  const index = new Map<string, DayBucket>();
  for (let i = opts.days - 1; i >= 0; i--) {
    const day = new Date(opts.nowMs - i * DAY_MS).toISOString().slice(0, 10);
    const b: DayBucket = { day, runs: 0, chargedCents: 0, verified: 0, failed: 0, blocked: 0 };
    out.push(b); index.set(day, b);
  }
  for (const r of rows) {
    const b = index.get(dayKey(r.created_at));
    if (!b) continue;                                     // outside the window
    b.runs++;
    b.chargedCents += chargedCentsOf(r);
    if (r.invalidated_at) continue;                       // withdrawn: counted as a run, never as a verdict
    const tone = runVerdict(String(r.state ?? ""), r.decision).tone;
    if (tone === "verified") b.verified++;
    else if (tone === "failed") b.failed++;
    else if (tone === "blocked") b.blocked++;
  }
  return out;
}

/** Which hours of the UTC day this key is used in. 24 buckets, always all 24, same reason as bucketByDay. */
export function bucketByHour(rows: DetailRunRow[]): number[] {
  const hours = new Array(24).fill(0) as number[];
  for (const r of rows) {
    const h = new Date(r.created_at).getUTCHours();
    if (Number.isInteger(h) && h >= 0 && h < 24) hours[h]++;
  }
  return hours;
}

export type EndpointCount = { endpoint: string; method: string; count: number };

export type KeyDetail = {
  usage: KeyUsage;                       // the money layer, unchanged and un-recomputed
  runs: number;
  verdicts: VerdictTally;
  cost: CostStats;
  duration: DurationStats;
  daily: DayBucket[];
  hourly: number[];
  endpoints: EndpointCount[];
  firstRunAt: string | null;
  lastRunAt: string | null;
  guaranteesTouched: number;
  /** True when the run list hit its read limit, so the page can say the figures cover a window. */
  truncated: boolean;
};

const READ_LIMIT = 1000;

/**
 * Owner-scoped twice: the run read filters user_id AND api_key_id, so a key id guessed or leaked from
 * another tenant returns that tenant nothing. Same rule as keyUsage, restated because it is the property
 * that matters most in this file.
 */
export async function keyDetail(
  owner: string,
  key: { id: string; prefix?: string | null; dailyCeilingCents: number | null },
  nowMs = Date.now(),
): Promise<KeyDetail | null> {
  if (!isDatabaseConfigured() || !owner || !key.id) return null;
  const uid = owner.trim().toLowerCase();
  const s = getSupabaseAdminClient();

  const [usage, runsRes, endpoints] = await Promise.all([
    keyUsage(owner, key, nowMs),
    s.from("v_preflight_runs" as never)
      .select("id, created_at, started_at, completed_at, state, decision, held_cents, credits_held, flow_units, deployment_url, invalidated_at, guarantee_id")
      .eq("user_id", uid).eq("api_key_id", key.id)
      .order("created_at", { ascending: false }).limit(READ_LIMIT),
    endpointsForPrefix(uid, String(key.prefix ?? "")),
  ]);
  if (!usage) return null;

  // A run read that fails is reported as no runs rather than as an error page: the money figures above it
  // came through, and a customer looking at a key would rather see spend with an empty chart than nothing.
  const rows = ((runsRes.data as unknown as DetailRunRow[] | null) ?? []);
  const ordered = [...rows].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));

  return {
    usage,
    runs: rows.length,
    verdicts: verdictTally(rows),
    cost: costStats(rows),
    duration: durationStats(rows),
    daily: bucketByDay(rows, { nowMs, days: 30 }),
    hourly: bucketByHour(rows),
    endpoints,
    firstRunAt: ordered[0]?.created_at ?? null,
    lastRunAt: ordered[ordered.length - 1]?.created_at ?? null,
    guaranteesTouched: new Set(rows.map((r) => r.guarantee_id).filter(Boolean)).size,
    truncated: rows.length >= READ_LIMIT,
  };
}

/**
 * Which endpoints THIS key called, from the events log.
 *
 * Kept away from every money figure for the reason key-usage.ts gives: logEvent swallows its own failures
 * so analytics can never break a product flow, which makes this best-effort by construction. It is the only
 * place a request that launched nothing exists, which is why it is worth reading at all.
 */
async function endpointsForPrefix(uid: string, prefix: string): Promise<EndpointCount[]> {
  if (!prefix) return [];
  try {
    const s = getSupabaseAdminClient();
    const { data, error } = await s.from("v_events" as never)
      .select("route, metadata")
      .eq("user_id", uid).in("event_type", ["api_request_made", "api_key_used"] as never)
      .eq("metadata->>prefix", prefix)
      .order("created_at", { ascending: false }).limit(2000);
    if (error) return [];
    const map = new Map<string, EndpointCount>();
    for (const r of (data as unknown as { route: string | null; metadata: Record<string, unknown> }[]) ?? []) {
      const m = r.metadata || {};
      const endpoint = String(m.endpoint ?? r.route ?? "other");
      const method = String(m.method ?? "");
      const k = `${method} ${endpoint}`;
      (map.get(k) ?? map.set(k, { endpoint, method, count: 0 }).get(k)!).count++;
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  } catch { return []; }
}
