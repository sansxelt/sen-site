// THE WHOLE ACCOUNT'S CONSUMPTION, on the page called Usage.
//
// /usage answered "which key is doing the work, when did it last run, and what will refuse me" and never
// once said what any of it cost. The key detail page has spend; the page named after usage did not.
//
// EVERY FIGURE IS THE SAME FUNCTION THE KEY PAGE USES. verdictTally, costStats, durationStats and
// bucketByDay live in key-detail.ts and are imported here rather than reimplemented. A second copy is how
// the account total starts disagreeing with the sum of its keys, and a customer who can find two different
// answers to one question has stopped believing either.
//
// SCOPED TO THE OWNER'S OWN RUNS. Not member-scoped: /usage reports what THIS account will be billed for
// and what its limits are checked against, and both of those are per owner. A teammate's spend on their own
// system is their bill, not this one.
import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";
import {
  verdictTally, costStats, durationStats, bucketByDay, dayKey,
  type DetailRunRow, type VerdictTally, type CostStats, type DurationStats, type DayBucket,
} from "./key-detail";
import { chargedCentsOf } from "./key-usage";

const READ_LIMIT = 2000;

export type MonthSpend = { runs: number; chargedCents: number; label: string };

/**
 * Calendar months, not rolling 30-day windows.
 *
 * "This month" and "last month" are the units a card statement uses, and someone reconciling an invoice is
 * comparing against a calendar. A rolling window would produce a number that is correct and matches nothing
 * they can check it against.
 *
 * UTC, because that is when the daily ceiling resets and when the run rows are stamped. A local-time month
 * boundary would put a run in a different month than the limit that governed it.
 */
export function monthSpend(rows: DetailRunRow[], nowMs: number): { thisMonth: MonthSpend; lastMonth: MonthSpend } {
  const now = new Date(nowMs);
  const key = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const thisKey = key(now);
  const lastKey = key(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
  const blank = (label: string): MonthSpend => ({ runs: 0, chargedCents: 0, label });

  const out = { thisMonth: blank(thisKey), lastMonth: blank(lastKey) };
  for (const r of rows) {
    const k = dayKey(r.created_at).slice(0, 7);
    const bucket = k === thisKey ? out.thisMonth : k === lastKey ? out.lastMonth : null;
    if (!bucket) continue;
    bucket.runs++;
    bucket.chargedCents += chargedCentsOf(r);
  }
  return out;
}

export type CostTrend = { earlierCents: number | null; recentCents: number | null; changePct: number | null; sampleSize: number };

/**
 * Is a verification getting cheaper or more expensive?
 *
 * Compares the median charge of the older half of paid runs against the newer half. Median on both sides,
 * for the same reason durationStats uses it: one unusually large run should move a trend, not define it.
 *
 * RETURNS NULLS RATHER THAN A NUMBER WHEN THERE IS NOT ENOUGH TO SAY. A trend drawn from two runs is not a
 * trend, it is two runs and a line between them. Six paid runs is the floor, which is arbitrary but is at
 * least a stated floor rather than an implied one, and the page says so when it is not met.
 */
export const TREND_MIN_RUNS = 6;

export function costTrend(rows: DetailRunRow[]): CostTrend {
  const paid = rows
    .filter((r) => chargedCentsOf(r) > 0)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    .map(chargedCentsOf);
  if (paid.length < TREND_MIN_RUNS) return { earlierCents: null, recentCents: null, changePct: null, sampleSize: paid.length };

  const mid = Math.floor(paid.length / 2);
  const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const earlier = median(paid.slice(0, mid));
  const recent = median(paid.slice(mid));
  return {
    earlierCents: earlier,
    recentCents: recent,
    changePct: earlier > 0 ? ((recent - earlier) / earlier) * 100 : null,
    sampleSize: paid.length,
  };
}

/**
 * Enough distinct days of activity for a chart to mean anything.
 *
 * The page carried a standing note: "NO CHART. A cost graph over this data would be one bar, and a shape
 * drawn from three points is decoration pretending to be analysis." That judgement was right and it was
 * about the DATA, not about charts, so it is encoded rather than overruled. The chart appears when there
 * are enough separate days to show a shape, and the note stands in for it when there are not.
 */
export const CHART_MIN_ACTIVE_DAYS = 5;

export function activeDays(buckets: DayBucket[]): number {
  return buckets.filter((b) => b.runs > 0).length;
}

export type AccountUsage = {
  runs: number;
  verdicts: VerdictTally;
  cost: CostStats;
  duration: DurationStats;
  daily: DayBucket[];
  months: { thisMonth: MonthSpend; lastMonth: MonthSpend };
  trend: CostTrend;
  byKey: { keyId: string | null; runs: number; chargedCents: number }[];
  firstRunAt: string | null;
  truncated: boolean;
};

export async function accountUsage(owner: string, nowMs = Date.now()): Promise<AccountUsage | null> {
  if (!isDatabaseConfigured() || !owner) return null;
  try {
    const s = getSupabaseAdminClient();
    const { data, error } = await s
      .from("v_preflight_runs" as never)
      .select("id, created_at, started_at, completed_at, state, decision, held_cents, credits_held, flow_units, deployment_url, invalidated_at, guarantee_id, api_key_id")
      .eq("user_id", owner.trim().toLowerCase())
      .order("created_at", { ascending: false })
      .limit(READ_LIMIT);
    if (error) return null;

    const rows = ((data as unknown as (DetailRunRow & { api_key_id: string | null })[] | null) ?? []);

    // Per key, INCLUDING the runs no key launched. A console run is not attributable to a key and dropping
    // it would make the per-key rows add up to less than the account total with nothing saying why.
    const keyMap = new Map<string | null, { keyId: string | null; runs: number; chargedCents: number }>();
    for (const r of rows) {
      const id = r.api_key_id ?? null;
      const e = keyMap.get(id) ?? { keyId: id, runs: 0, chargedCents: 0 };
      e.runs++; e.chargedCents += chargedCentsOf(r);
      keyMap.set(id, e);
    }

    const ordered = [...rows].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    return {
      runs: rows.length,
      verdicts: verdictTally(rows),
      cost: costStats(rows),
      duration: durationStats(rows),
      daily: bucketByDay(rows, { nowMs, days: 30 }),
      months: monthSpend(rows, nowMs),
      trend: costTrend(rows),
      byKey: [...keyMap.values()].sort((a, b) => b.chargedCents - a.chargedCents || b.runs - a.runs),
      firstRunAt: ordered[0]?.created_at ?? null,
      truncated: rows.length >= READ_LIMIT,
    };
  } catch { return null; }
}
