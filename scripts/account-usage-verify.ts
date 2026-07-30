import { monthSpend, costTrend, activeDays, TREND_MIN_RUNS, CHART_MIN_ACTIVE_DAYS } from "../lib/preflight/account-usage";
import { bucketByDay, type DetailRunRow } from "../lib/preflight/key-detail";
let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { if (c) { pass++; console.log(`PASS  ${n}`); } else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); } };
const NOW = Date.parse("2026-07-27T12:00:00.000Z");
const at = (iso: string, cents: number | null = null): DetailRunRow => ({
  id: iso, created_at: iso, started_at: iso, completed_at: null, state: "completed", decision: "ready",
  held_cents: cents, credits_held: 0, flow_units: null, deployment_url: null, application_id: null, invalidated_at: null, guarantee_id: null,
});

console.log("── months are calendar months, in UTC ──");
{
  const m = monthSpend([
    at("2026-07-27T00:00:00.000Z", 500), at("2026-07-01T00:00:00.000Z", 300),
    at("2026-06-30T23:59:59.000Z", 700), at("2026-06-01T00:00:00.000Z", 100),
    at("2026-05-15T00:00:00.000Z", 999),
  ], NOW);
  ok("this month is July, and only July", m.thisMonth.chargedCents === 800 && m.thisMonth.runs === 2, JSON.stringify(m.thisMonth));
  ok("last month is June, and only June", m.lastMonth.chargedCents === 800 && m.lastMonth.runs === 2, JSON.stringify(m.lastMonth));
  ok("May is in neither", m.thisMonth.chargedCents + m.lastMonth.chargedCents === 1600);
  ok("the boundary belongs to the month it falls in, not the nearest one",
    monthSpend([at("2026-06-30T23:59:59.000Z", 700)], NOW).lastMonth.chargedCents === 700);
  // A January "this month" must roll back to December of the previous year, not to month -1.
  const jan = monthSpend([at("2025-12-15T00:00:00.000Z", 250)], Date.parse("2026-01-10T00:00:00.000Z"));
  ok("January's last month is December of the previous year", jan.lastMonth.chargedCents === 250, JSON.stringify(jan.lastMonth));
}

console.log("\n── a trend refuses to be drawn from too little ──");
{
  const few = Array.from({ length: TREND_MIN_RUNS - 1 }, (_, i) => at(`2026-07-0${i + 1}T00:00:00.000Z`, 100));
  const t = costTrend(few);
  ok("below the floor it reports nothing rather than a direction", t.changePct === null && t.recentCents === null);
  ok("and says how many it has", t.sampleSize === TREND_MIN_RUNS - 1);
  ok("unpaid runs do not count toward the floor",
    costTrend(Array.from({ length: 20 }, (_, i) => at(`2026-07-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`, null))).changePct === null);

  const rising = [100, 100, 100, 200, 200, 200].map((c, i) => at(`2026-07-0${i + 1}T00:00:00.000Z`, c));
  const r = costTrend(rising);
  ok("a real rise is reported as a rise", r.changePct === 100, `got ${r.changePct}`);
  ok("with both medians, so the reader can check it", r.earlierCents === 100 && r.recentCents === 200);
  const falling = [200, 200, 200, 100, 100, 100].map((c, i) => at(`2026-07-0${i + 1}T00:00:00.000Z`, c));
  ok("a fall is reported as a fall", (costTrend(falling).changePct ?? 0) === -50);
  // Order is by time, not by the order rows arrive. accountUsage reads newest-first.
  const reversed = [...rising].reverse();
  ok("it sorts by time rather than trusting row order", costTrend(reversed).changePct === 100);
  // One outlier should move a trend, not define it.
  const spike = [100, 100, 100, 100, 100, 5000].map((c, i) => at(`2026-07-0${i + 1}T00:00:00.000Z`, c));
  ok("a single outlier does not define the direction", Math.abs(costTrend(spike).changePct ?? 0) < 1, `got ${costTrend(spike).changePct}`);
}

console.log("\n── the chart waits for a shape ──");
{
  const sparse = [1, 2, 3].map((d) => at(`2026-07-0${d}T00:00:00.000Z`, 100));
  ok("three days is below the floor", activeDays(bucketByDay(sparse, { nowMs: NOW, days: 30 })) < CHART_MIN_ACTIVE_DAYS);
  const enough = [1, 2, 3, 4, 5, 6].map((d) => at(`2026-07-0${d}T00:00:00.000Z`, 100));
  ok("six days clears it", activeDays(bucketByDay(enough, { nowMs: NOW, days: 30 })) >= CHART_MIN_ACTIVE_DAYS);
  ok("two runs on one day is one active day, not two",
    activeDays(bucketByDay([at("2026-07-05T01:00:00.000Z"), at("2026-07-05T02:00:00.000Z")], { nowMs: NOW, days: 30 })) === 1);
}
console.log(fail === 0 ? `\nALL PASS  ${pass} passed, 0 failed` : `\nFAILURES  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
