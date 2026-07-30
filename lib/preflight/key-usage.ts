// WHAT HAS THIS KEY ACTUALLY COST ME?
//
// The console could not answer that. It showed a per-key REQUEST COUNT, read from the events log, and no
// money at all. Two things were wrong with that.
//
// First, a request count is not a bill. A key can make a thousand cheap reads or four verifications; only
// one of those shows up on a card.
//
// Second, and worse: the number shown came from a DIFFERENT SOURCE than the number enforced. The daily
// ceiling reads v_preflight_runs, because a run row is written in the same operation as the run itself. The
// events log is best-effort by design (logEvent swallows its own failures so analytics can never break a
// product flow), so it can under-count. A customer reading one number and being refused by another is the
// same class of defect as a verdict that disagrees with itself.
//
// So everything money-shaped here is read from v_preflight_runs, and "spent today" is produced by
// keySpentTodayCents itself, the very function the ceiling calls. It cannot drift from what refuses you,
// because it IS what refuses you.
//
// THE THREE COLUMNS, AND WHY THEY ARE NOT INTERCHANGEABLE:
//
//   credits_held   what was committed at launch. Under pass pricing PAYG this is CENTS; on the legacy
//                  credit path it is CREDITS; under a subscription or a free pass it is 0. This is what
//                  the ceiling counts, so it is what "spent today against your limit" must count.
//   held_cents     money actually taken, written by recordRunPassUsage and only ever on the PAYG path.
//                  Null for subscription runs, because a subscriber spends allowance, not money.
//   flow_units     allowance consumed. The real cost of a subscriber's run, and invisible in dollars.
//
// A subscriber's key therefore shows $0.00 spent and a real number of flow units, and BOTH are true. Showing
// only the dollars would tell a customer their key is free; showing only the units would hide a PAYG charge.
import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";
import { keySpentTodayCents } from "./key-spend";

const REQUEST_EVENT_TYPES = ["api_request_made", "api_key_used"];

// Requests are counted from the events log because a request that launches nothing writes no run row: a
// priced preview, a report read, a refused call. That makes the log the only place they exist, and it is
// also why this number is kept away from every money figure above. It is best-effort and says so.
async function requestCounts(owner: string, prefix: string, nowMs: number): Promise<{ total: number; last24h: number } | null> {
  if (!prefix) return null;
  try {
    const s = getSupabaseAdminClient();
    const uid = owner.trim().toLowerCase();
    const since = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
    const base = () => s.from("v_events" as never)
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid).in("event_type", REQUEST_EVENT_TYPES as never).eq("metadata->>prefix", prefix);
    const [all, recent] = await Promise.all([base(), base().gte("created_at", since)]);
    if (all.error) return null;
    return { total: all.count ?? 0, last24h: recent.error ? 0 : (recent.count ?? 0) };
  } catch { return null; }
}

export type KeyUsageWindow = { runs: number; chargedCents: number; flowUnits: number };

/**
 * Every verification any key ever launched for this owner, split by whether the key still exists.
 *
 * WHY THIS EXISTS. Revoking a key DELETES its row (revokeApiKey is a hard delete), and the per-key panel
 * establishes ownership from the caller's live key list. So the moment a key is revoked, everything it
 * spent stops being attributable to anything, and the panels no longer add up to the bill.
 *
 * Measured in production: 9 of 10 key-launched runs, $120 of $135, were launched by keys since revoked. A
 * customer adding up their key panels would have seen $15 and been billed $135. "Which key cost me this"
 * is a fair question to lose after revocation; "does this add up" is not.
 *
 * Names for revoked keys are recovered from the audit log, which records the prefix at revocation and on
 * every use. That log is best-effort, so a key that was never logged stays unnamed rather than invented.
 */
export type KeySpendSummary = {
  total: KeyUsageWindow;
  liveKeys: KeyUsageWindow;
  revokedKeys: KeyUsageWindow;
  /** Newest first, only keys that actually spent something. `prefix` is null when the log cannot name it. */
  revoked: { keyId: string; prefix: string | null; chargedCents: number; runs: number; flowUnits: number }[];
};

export type KeyUsage = {
  keyId: string;
  /** Produced by keySpentTodayCents: the SAME figure the daily ceiling enforces. */
  spentTodayCents: number | null;
  /** The key's ceiling in cents, or null for a key with no limit (a real, deliberate state). */
  dailyCeilingCents: number | null;
  /** Ceiling minus spend, or null when there is no ceiling or spend could not be read. */
  remainingTodayCents: number | null;
  today: KeyUsageWindow;
  last30d: KeyUsageWindow;
  allTime: KeyUsageWindow;
  /** Newest first. The runs this key launched, so a charge can be traced to the thing it paid for. */
  recentRuns: { id: string; createdAt: string; state: string; decision: string | null; chargedCents: number | null; flowUnits: number | null; deploymentUrl: string | null; applicationId: string | null }[];
  /**
   * Requests are the ONE figure here that comes from the best-effort events log rather than the run table,
   * because a request that launches nothing writes no run row. It is reported separately and labelled, and
   * it is never used for anything money-shaped.
   */
  requests: { total: number; last24h: number } | null;
};

const EMPTY: KeyUsageWindow = { runs: 0, chargedCents: 0, flowUnits: 0 };

function utcDayStartIso(nowMs: number): string {
  const d = new Date(nowMs);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

export type RunRow = {
  id: string; created_at: string; state: string | null; decision: string | null;
  held_cents: number | null; credits_held: number | null; flow_units: number | null; deployment_url: string | null;
  // Carried so a run in this list can be LINKED. Its report lives at /systems/<app>/passes/<run>, which is
  // unreachable from a run id alone — the key pages linked /records/<run> instead, a route that does not
  // exist (/records is an alias of /activity), so every row in "Verifications this key launched" 404'd.
  application_id: string | null;
};

// Money actually taken for one run. held_cents is written by recordRunPassUsage on the PAYG path only;
// credits_held is the launch-time commitment and is cents ONLY under pass pricing. Preferring held_cents
// means a subscription run reports 0 rather than reporting its flow units as if they were money.
export function chargedCentsOf(r: Pick<RunRow, "held_cents">): number {
  return Number(r.held_cents ?? 0) || 0;
}

export function windowOf(rows: RunRow[]): KeyUsageWindow {
  return rows.reduce<KeyUsageWindow>((acc, r) => ({
    runs: acc.runs + 1,
    chargedCents: acc.chargedCents + chargedCentsOf(r),
    flowUnits: acc.flowUnits + (Number(r.flow_units) || 0),
  }), { ...EMPTY });
}

/**
 * The whole summary, as pure arithmetic over rows. Split out from the database call so it can be exercised
 * directly: every number a customer reads about money is decided here, and a number about money that only
 * a live database can test is a number nobody tests.
 *
 * `spentTodayCents` is passed IN rather than derived, because it must come from keySpentTodayCents, the
 * function the daily ceiling itself calls. Recomputing it here from these rows would create a second
 * implementation, and a second implementation is how the figure a customer reads starts disagreeing with
 * the figure that refuses them.
 */
export function summarizeKeyRuns(
  rows: RunRow[],
  opts: { nowMs: number; dailyCeilingCents: number | null; spentTodayCents: number | null },
): Pick<KeyUsage, "today" | "last30d" | "allTime" | "remainingTodayCents"> {
  const dayStart = Date.parse(utcDayStartIso(opts.nowMs));
  const monthStart = opts.nowMs - 30 * 24 * 60 * 60 * 1000;
  const at = (r: RunRow) => Date.parse(r.created_at);
  const inWindow = (r: RunRow, from: number) => Number.isFinite(at(r)) && at(r) >= from;

  return {
    today: windowOf(rows.filter((r) => inWindow(r, dayStart))),
    last30d: windowOf(rows.filter((r) => inWindow(r, monthStart))),
    allTime: windowOf(rows),
    // Never negative: a key that has overspent its ceiling has nothing left, not a debt to display.
    remainingTodayCents:
      opts.dailyCeilingCents == null || opts.spentTodayCents == null
        ? null
        : Math.max(0, opts.dailyCeilingCents - opts.spentTodayCents),
  };
}

/**
 * Everything a person needs to reconcile one key, owner-scoped.
 *
 * `owner` is not decoration: the run read is filtered by user_id as well as api_key_id, so a key id guessed
 * or leaked from another tenant returns that tenant nothing.
 */
export async function keyUsage(
  owner: string,
  key: { id: string; prefix?: string | null; dailyCeilingCents: number | null },
  nowMs = Date.now(),
): Promise<KeyUsage | null> {
  if (!isDatabaseConfigured() || !owner || !key.id) return null;
  const s = getSupabaseAdminClient();

  const { data, error } = await s
    .from("v_preflight_runs" as never)
    .select("id, created_at, state, decision, held_cents, credits_held, flow_units, deployment_url, application_id")
    .eq("user_id", owner.trim().toLowerCase())
    .eq("api_key_id", key.id)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) return null;
  const rows = ((data as unknown as RunRow[] | null) ?? []);

  // The ceiling's own function, not a second implementation of it.
  const spentTodayCents = await keySpentTodayCents(key.id, nowMs);
  const summary = summarizeKeyRuns(rows, { nowMs, dailyCeilingCents: key.dailyCeilingCents, spentTodayCents });

  return {
    keyId: key.id,
    spentTodayCents,
    dailyCeilingCents: key.dailyCeilingCents,
    ...summary,
    recentRuns: rows.slice(0, 20).map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      state: String(r.state ?? ""),
      decision: r.decision,
      chargedCents: r.held_cents == null ? null : Number(r.held_cents),
      flowUnits: r.flow_units == null ? null : Number(r.flow_units),
      deploymentUrl: r.deployment_url,
      applicationId: r.application_id ?? null,
    })),
    requests: await requestCounts(owner, String(key.prefix ?? ""), nowMs),
  };
}

/**
 * The account-wide reconciliation: what every key spent, and how much of it belongs to keys that are gone.
 *
 * Owner-scoped. Reads the run table for money (authoritative) and the events log only to put a name to a
 * key id that no longer has a row (best-effort, and null rather than guessed when the log is silent).
 */
export async function keySpendSummary(owner: string, liveKeyIds: string[]): Promise<KeySpendSummary | null> {
  if (!isDatabaseConfigured() || !owner) return null;
  const s = getSupabaseAdminClient();
  const uid = owner.trim().toLowerCase();

  const { data, error } = await s
    .from("v_preflight_runs" as never)
    .select("id, created_at, state, decision, held_cents, credits_held, flow_units, deployment_url, api_key_id")
    .eq("user_id", uid)
    .not("api_key_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) return null;
  const rows = ((data as unknown as (RunRow & { api_key_id: string | null })[] | null) ?? []);

  const live = new Set(liveKeyIds);
  const liveRows = rows.filter((r) => r.api_key_id && live.has(r.api_key_id));
  const goneRows = rows.filter((r) => r.api_key_id && !live.has(r.api_key_id));

  // Group the orphans by the key that launched them, so the total can be broken down rather than asserted.
  const byKey = new Map<string, (RunRow & { api_key_id: string | null })[]>();
  for (const r of goneRows) {
    const k = String(r.api_key_id);
    byKey.set(k, [...(byKey.get(k) ?? []), r]);
  }

  const revoked = await Promise.all(Array.from(byKey.entries()).map(async ([keyId, keyRows]) => {
    const w = windowOf(keyRows);
    let prefix: string | null = null;
    try {
      // api_key_used records BOTH the id and the prefix, so a key that ever made a logged call can still
      // be named after its row is gone. A key that never did stays null; inventing a label would be worse.
      const ev = await s.from("v_events" as never)
        .select("metadata")
        .eq("user_id", uid).eq("event_type", "api_key_used").eq("metadata->>id", keyId)
        .limit(1).maybeSingle();
      const meta = (ev.data as { metadata?: { prefix?: string | null } } | null)?.metadata;
      prefix = meta?.prefix ?? null;
    } catch { prefix = null; }
    return { keyId, prefix, chargedCents: w.chargedCents, runs: w.runs, flowUnits: w.flowUnits };
  }));

  return {
    total: windowOf(rows),
    liveKeys: windowOf(liveRows),
    revokedKeys: windowOf(goneRows),
    revoked: revoked.filter((r) => r.runs > 0).sort((a, b) => b.chargedCents - a.chargedCents),
  };
}
