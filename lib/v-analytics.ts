// Decision Analytics — pure derivations over EXISTING tables. No new storage, no
// invented metrics: every number comes from v_tests, v_reports (+ evaluationIntelligence),
// v_judgments (filter reasons), and v_credit_ledger. User-scoped; tolerant of a
// missing project_id column. Empty accounts return zeroed structures (the UI shows
// guidance, never fake numbers).

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { type VReport } from "./v-db";
import { evaluationIntelligence, evaluationHealth, type ConfidenceLabel, type SignalLabel, type HealthState } from "./v-intelligence";
import { channelLabel } from "./v-sources";

const norm = (e: string) => e.trim().toLowerCase();
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

// Display-only normalization (DB keys → human labels). Never changes stored values.
export const CATEGORY_LABEL: Record<string, string> = {
  ad: "Ad creative", landing: "Landing page hero", ai_image: "AI image output",
  product_image: "Product image", hook: "Copy / headline", brand_name: "Brand name",
  thumbnail: "Thumbnail", app_icon: "App icon", game_icon: "Game icon", logo: "Logo",
  ui: "UI / screen", other: "General",
};
export const FILTER_REASON_LABEL: Record<string, string> = {
  too_fast: "Too-fast responses", spam_comment: "Spam / gibberish", ip_velocity: "Source velocity",
  device_daily_limit: "Device daily limit", low_reputation: "Low-reputation voter", admin: "Manually rejected", other: "Other",
};

type TestRow = { id: string; title: string; category: string; status: string; votes_valid: number; votes_target: number; created_at: string; completed_at: string | null; project_id: string | null; share_enabled: boolean; is_sandbox?: boolean };
type Derived = { id: string; category: string; project_id: string | null; filtered: number; marginPts: number | null; confidence: ConfidenceLabel; signal: SignalLabel | null; recommended: string | null; inconclusive: boolean; health: HealthState };

const TEST_COLS = "id,title,category,status,votes_valid,votes_target,created_at,completed_at,project_id,share_enabled,is_sandbox";
const TEST_COLS_NOPROJ = "id,title,category,status,votes_valid,votes_target,created_at,completed_at,share_enabled";

// One load: a user's tests (optionally a single project) + their completed reports,
// with per-completed evaluation intelligence derived once. Reused by every surface.
async function gather(userId: string, projectId?: string): Promise<{ tests: TestRow[]; derived: Derived[]; reportByTest: Record<string, VReport["results"]> }> {
  const s = getSupabaseAdminClient();
  const uid = norm(userId);
  let q = s.from("v_tests" as never).select(TEST_COLS).eq("user_id", uid).order("created_at", { ascending: false }).limit(1000);
  if (projectId) q = q.eq("project_id", projectId);
  let { data, error } = await q;
  if (error) {
    if (projectId) return { tests: [], derived: [], reportByTest: {} };
    ({ data, error } = await s.from("v_tests" as never).select(TEST_COLS_NOPROJ).eq("user_id", uid).order("created_at", { ascending: false }).limit(1000));
    if (error) return { tests: [], derived: [], reportByTest: {} };
  }
  // Sandbox evaluations are developer integration tests — never count them in real
  // analytics (undefined is_sandbox = pre-migration / production row, kept).
  const tests = ((data as unknown as TestRow[]) ?? []).map((t) => ({ ...t, project_id: t.project_id ?? null })).filter((t) => !t.is_sandbox);
  const completed = tests.filter((t) => t.status === "complete");
  const reportByTest: Record<string, VReport["results"]> = {};
  if (completed.length) {
    const { data: reps } = await s.from("v_reports" as never).select("test_id,results").in("test_id", completed.map((t) => t.id).slice(0, 1000));
    for (const r of (reps as unknown as { test_id: string; results: VReport["results"] }[]) ?? []) reportByTest[r.test_id] = r.results;
  }
  const derived: Derived[] = completed.map((t) => {
    const results = reportByTest[t.id];
    if (!results) return { id: t.id, category: t.category, project_id: t.project_id, filtered: 0, marginPts: null, confidence: "None" as ConfidenceLabel, signal: null, recommended: null, inconclusive: true, health: "Needs more judgments" as HealthState };
    const intel = evaluationIntelligence(results, t.votes_target);
    return {
      id: t.id, category: t.category, project_id: t.project_id, filtered: intel.filtered,
      marginPts: intel.marginPts, confidence: intel.confidenceLabel, signal: intel.signalLabel,
      recommended: intel.recommendedOption ? `Option ${intel.recommendedOption}` : null, inconclusive: intel.inconclusive,
      health: evaluationHealth("complete", intel),
    };
  });
  return { tests, derived, reportByTest };
}

function avg(nums: number[]): number | null { return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null; }
function dailyBuckets(dates: (string | null)[], days = 30): number[] {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const idx: Record<string, number> = {};
  const out = new Array(days).fill(0);
  for (let i = 0; i < days; i++) { const d = new Date(today); d.setUTCDate(d.getUTCDate() - (days - 1 - i)); idx[dayKey(d)] = i; }
  for (const ds of dates) { if (!ds) continue; const k = dayKey(new Date(ds)); if (k in idx) out[idx[k]] += 1; }
  return out;
}
function countSince(dates: (string | null)[], days: number): number {
  const cut = Date.now() - days * 86400e3;
  return dates.filter((d) => d && new Date(d).getTime() >= cut).length;
}

export type DecisionAnalytics = {
  core: { total: number; active: number; completed: number; draft: number; validJudgments: number; filtered: number; responses: number; filterRate: number; avgMargin: number | null };
  quality: { strong: number; moderate: number; tentative: number; inconclusive: number; clean: number; limited: number; needsMore: number };
  health: { ready: number; needsMore: number; noisy: number; tooClose: number; lowQuality: number; collecting: number };
  byCategory: { category: string; label: string; count: number; completed: number; valid: number; avgMargin: number | null; strongRate: number; dominant: string }[];
  byProject: { project_id: string; completed: number; valid: number }[];
  trends: { createdDaily: number[]; completedDaily: number[]; created7: number; created30: number; completed7: number; completed30: number };
  credits: { used: number; usedDaily: number[] };
};

export async function decisionAnalytics(userId: string): Promise<DecisionAnalytics> {
  const empty: DecisionAnalytics = {
    core: { total: 0, active: 0, completed: 0, draft: 0, validJudgments: 0, filtered: 0, responses: 0, filterRate: 0, avgMargin: null },
    quality: { strong: 0, moderate: 0, tentative: 0, inconclusive: 0, clean: 0, limited: 0, needsMore: 0 },
    health: { ready: 0, needsMore: 0, noisy: 0, tooClose: 0, lowQuality: 0, collecting: 0 },
    byCategory: [], byProject: [], trends: { createdDaily: [], completedDaily: [], created7: 0, created30: 0, completed7: 0, completed30: 0 }, credits: { used: 0, usedDaily: [] },
  };
  if (!userId || !isDatabaseConfigured()) return empty;
  try {
    const { tests, derived } = await gather(userId);
    if (!tests.length) return empty;
    const completed = tests.filter((t) => t.status === "complete");
    const validJudgments = tests.reduce((a, t) => a + (t.votes_valid || 0), 0);
    const filtered = derived.reduce((a, d) => a + (d.filtered || 0), 0);
    const responses = validJudgments + filtered;
    const margins = derived.map((d) => d.marginPts).filter((m): m is number => m != null);

    const quality = { strong: 0, moderate: 0, tentative: 0, inconclusive: 0, clean: 0, limited: 0, needsMore: 0 };
    for (const d of derived) {
      if (d.inconclusive || d.confidence === "None") quality.inconclusive++;
      else if (d.confidence === "Strong") quality.strong++;
      else if (d.confidence === "Moderate") quality.moderate++;
      else if (d.confidence === "Tentative") quality.tentative++;
      if (d.signal === "Clean signal") quality.clean++;
      else if (d.signal === "Limited signal") quality.limited++;
      else if (d.signal === "Needs more judgments") quality.needsMore++;
    }

    const health = { ready: 0, needsMore: 0, noisy: 0, tooClose: 0, lowQuality: 0, collecting: tests.filter((t) => t.status === "active").length };
    for (const d of derived) {
      if (d.health === "Ready to decide") health.ready++;
      else if (d.health === "Noisy signal") health.noisy++;
      else if (d.health === "Too close to call") health.tooClose++;
      else if (d.health === "Low-quality traffic") health.lowQuality++;
      else health.needsMore++;
    }

    // category breakdown
    const catAgg: Record<string, { count: number; completed: number; valid: number; margins: number[]; conf: Record<string, number>; strong: number }> = {};
    for (const t of tests) {
      const c = (catAgg[t.category] ??= { count: 0, completed: 0, valid: 0, margins: [], conf: {}, strong: 0 });
      c.count++; c.valid += t.votes_valid || 0; if (t.status === "complete") c.completed++;
    }
    for (const d of derived) {
      const c = catAgg[d.category]; if (!c) continue;
      if (d.marginPts != null) c.margins.push(d.marginPts);
      c.conf[d.confidence] = (c.conf[d.confidence] ?? 0) + 1;
      if (d.confidence === "Strong") c.strong++;
    }
    const byCategory = Object.entries(catAgg).map(([category, c]) => ({
      category, label: CATEGORY_LABEL[category] ?? category.replace(/_/g, " "), count: c.count, completed: c.completed, valid: c.valid,
      avgMargin: avg(c.margins), strongRate: c.completed ? Math.round((c.strong / c.completed) * 100) : 0,
      dominant: Object.entries(c.conf).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—",
    })).sort((a, b) => b.count - a.count);

    const projAgg: Record<string, { completed: number; valid: number }> = {};
    for (const t of tests) { if (!t.project_id) continue; const p = (projAgg[t.project_id] ??= { completed: 0, valid: 0 }); p.valid += t.votes_valid || 0; if (t.status === "complete") p.completed++; }
    const byProject = Object.entries(projAgg).map(([project_id, p]) => ({ project_id, ...p }));

    const createdDates = tests.map((t) => t.created_at);
    const completedDates = completed.map((t) => t.completed_at);

    // credits used over time (holds net of refunds, both test-scoped)
    const s = getSupabaseAdminClient();
    const { data: led } = await s.from("v_credit_ledger" as never).select("delta,reason,created_at").eq("user_id", norm(userId)).in("reason", ["hold", "refund"]);
    const ledRows = (led as unknown as { delta: number; created_at: string }[]) ?? [];
    const used = Math.max(0, ledRows.reduce((a, r) => a - r.delta, 0));
    const usedDailyArr = new Array(30).fill(0);
    {
      const today = new Date(); today.setUTCHours(0, 0, 0, 0);
      const idx: Record<string, number> = {};
      for (let i = 0; i < 30; i++) { const d = new Date(today); d.setUTCDate(d.getUTCDate() - (29 - i)); idx[dayKey(d)] = i; }
      for (const r of ledRows) { const k = dayKey(new Date(r.created_at)); if (k in idx) usedDailyArr[idx[k]] += Math.max(0, -r.delta); }
    }

    return {
      core: { total: tests.length, active: tests.filter((t) => t.status === "active").length, completed: completed.length, draft: tests.filter((t) => t.status === "draft").length, validJudgments, filtered, responses, filterRate: responses ? Math.round((filtered / responses) * 100) : 0, avgMargin: avg(margins) },
      quality, health, byCategory, byProject,
      trends: { createdDaily: dailyBuckets(createdDates), completedDaily: dailyBuckets(completedDates), created7: countSince(createdDates, 7), created30: countSince(createdDates, 30), completed7: countSince(completedDates, 7), completed30: countSince(completedDates, 30) },
      credits: { used, usedDaily: usedDailyArr },
    };
  } catch { return empty; }
}

export type DataQuality = { valid: number; filtered: number; responses: number; filterRate: number; cleanPct: number; reasons: { reason: string; label: string; count: number }[]; clean: number; limited: number; needsMore: number; completionRate: number; completed: number; active: number };

export async function dataQuality(userId: string): Promise<DataQuality> {
  const empty: DataQuality = { valid: 0, filtered: 0, responses: 0, filterRate: 0, cleanPct: 0, reasons: [], clean: 0, limited: 0, needsMore: 0, completionRate: 0, completed: 0, active: 0 };
  if (!userId || !isDatabaseConfigured()) return empty;
  try {
    const { tests, derived } = await gather(userId);
    if (!tests.length) return empty;
    const s = getSupabaseAdminClient();
    const ids = tests.map((t) => t.id);
    const valid = tests.reduce((a, t) => a + (t.votes_valid || 0), 0);
    // exact filtered count + reason sample (recent rejected judgments)
    const [{ count: rejectedCount }, { data: rejRows }] = await Promise.all([
      ids.length ? s.from("v_judgments" as never).select("*", { count: "exact", head: true }).in("test_id", ids).eq("status", "rejected") : Promise.resolve({ count: 0 }),
      ids.length ? s.from("v_judgments" as never).select("reject_reason").in("test_id", ids).eq("status", "rejected").limit(3000) : Promise.resolve({ data: [] }),
    ]);
    const filtered = rejectedCount ?? 0;
    const responses = valid + filtered;
    const reasonAgg: Record<string, number> = {};
    for (const r of (rejRows as unknown as { reject_reason: string | null }[]) ?? []) { const k = r.reject_reason ?? "other"; reasonAgg[k] = (reasonAgg[k] ?? 0) + 1; }
    const reasons = Object.entries(reasonAgg).map(([reason, count]) => ({ reason, label: FILTER_REASON_LABEL[reason] ?? reason.replace(/_/g, " "), count })).sort((a, b) => b.count - a.count);
    const completed = tests.filter((t) => t.status === "complete").length;
    const active = tests.filter((t) => t.status === "active").length;
    const launched = completed + active;
    return {
      valid, filtered, responses, filterRate: responses ? Math.round((filtered / responses) * 100) : 0, cleanPct: responses ? Math.round((valid / responses) * 100) : 0,
      reasons, clean: derived.filter((d) => d.signal === "Clean signal").length, limited: derived.filter((d) => d.signal === "Limited signal").length, needsMore: derived.filter((d) => d.signal === "Needs more judgments").length,
      completionRate: launched ? Math.round((completed / launched) * 100) : 0, completed, active,
    };
  } catch { return empty; }
}

// Per-test filter-reason breakdown for the owner report (small, single test).
export async function testFilterReasons(testId: string): Promise<{ reason: string; label: string; count: number }[]> {
  if (!testId || !isDatabaseConfigured()) return [];
  try {
    const s = getSupabaseAdminClient();
    const { data } = await s.from("v_judgments" as never).select("reject_reason").eq("test_id", testId).eq("status", "rejected").limit(2000);
    const agg: Record<string, number> = {};
    for (const r of (data as unknown as { reject_reason: string | null }[]) ?? []) { const k = r.reject_reason ?? "other"; agg[k] = (agg[k] ?? 0) + 1; }
    return Object.entries(agg).map(([reason, count]) => ({ reason, label: FILTER_REASON_LABEL[reason] ?? reason.replace(/_/g, " "), count })).sort((a, b) => b.count - a.count);
  } catch { return []; }
}

// Project-scoped analytics (same shape pieces, scoped to one owned project).
export type ProjectAnalytics = {
  evaluations: number; active: number; completed: number; validJudgments: number; filtered: number; avgMargin: number | null;
  quality: { strong: number; moderate: number; tentative: number; inconclusive: number; clean: number; limited: number; needsMore: number };
  health: { ready: number; noisy: number; tooClose: number; needsMore: number; lowQuality: number };
  byCategory: { category: string; label: string; count: number }[];
  recentRecommended: { id: string; recommended: string; confidence: string }[];
};

export async function projectAnalytics(userId: string, projectId: string): Promise<ProjectAnalytics> {
  const empty: ProjectAnalytics = { evaluations: 0, active: 0, completed: 0, validJudgments: 0, filtered: 0, avgMargin: null, quality: { strong: 0, moderate: 0, tentative: 0, inconclusive: 0, clean: 0, limited: 0, needsMore: 0 }, health: { ready: 0, noisy: 0, tooClose: 0, needsMore: 0, lowQuality: 0 }, byCategory: [], recentRecommended: [] };
  if (!userId || !projectId || !isDatabaseConfigured()) return empty;
  try {
    const { tests, derived } = await gather(userId, projectId);
    if (!tests.length) return empty;
    const completed = tests.filter((t) => t.status === "complete");
    const margins = derived.map((d) => d.marginPts).filter((m): m is number => m != null);
    const quality = { strong: 0, moderate: 0, tentative: 0, inconclusive: 0, clean: 0, limited: 0, needsMore: 0 };
    for (const d of derived) {
      if (d.inconclusive || d.confidence === "None") quality.inconclusive++;
      else if (d.confidence === "Strong") quality.strong++; else if (d.confidence === "Moderate") quality.moderate++; else if (d.confidence === "Tentative") quality.tentative++;
      if (d.signal === "Clean signal") quality.clean++; else if (d.signal === "Limited signal") quality.limited++; else if (d.signal === "Needs more judgments") quality.needsMore++;
    }
    const health = { ready: 0, noisy: 0, tooClose: 0, needsMore: 0, lowQuality: 0 };
    for (const d of derived) {
      if (d.health === "Ready to decide") health.ready++; else if (d.health === "Noisy signal") health.noisy++;
      else if (d.health === "Too close to call") health.tooClose++; else if (d.health === "Low-quality traffic") health.lowQuality++; else health.needsMore++;
    }
    const catAgg: Record<string, number> = {};
    for (const t of tests) catAgg[t.category] = (catAgg[t.category] ?? 0) + 1;
    const byCategory = Object.entries(catAgg).map(([category, count]) => ({ category, label: CATEGORY_LABEL[category] ?? category.replace(/_/g, " "), count })).sort((a, b) => b.count - a.count);
    const recentRecommended = derived.filter((d) => d.recommended).slice(0, 5).map((d) => ({ id: d.id, recommended: d.recommended!, confidence: d.confidence }));
    return {
      evaluations: tests.length, active: tests.filter((t) => t.status === "active").length, completed: completed.length,
      validJudgments: tests.reduce((a, t) => a + (t.votes_valid || 0), 0), filtered: derived.reduce((a, d) => a + (d.filtered || 0), 0), avgMargin: avg(margins),
      quality, health, byCategory, recentRecommended,
    };
  } catch { return empty; }
}

// ── Signal source quality ─────────────────────────────────────────────────
export type SourceRow = { source: string; label: string; total: number; valid: number; filtered: number; filterRate: number };

// Channel = the named collection-link channel (utm_source) when present, else the
// coarse source. This is the meaningful "which channel" view.
function aggregateSources(rows: { source: string | null; utm_source: string | null; status: string }[]): SourceRow[] {
  const agg: Record<string, { total: number; valid: number; filtered: number }> = {};
  for (const r of rows) {
    const k = r.utm_source || r.source || "web";
    const a = (agg[k] ??= { total: 0, valid: 0, filtered: 0 });
    a.total++; if (r.status === "rejected") a.filtered++; else a.valid++;
  }
  return Object.entries(agg).map(([source, a]) => ({ source, label: channelLabel(source), total: a.total, valid: a.valid, filtered: a.filtered, filterRate: a.total ? Math.round((a.filtered / a.total) * 100) : 0 })).sort((x, y) => y.total - x.total);
}

// Source quality across a user's evaluations (recent sample for big accounts).
export async function sourceQuality(userId: string): Promise<SourceRow[]> {
  if (!userId || !isDatabaseConfigured()) return [];
  try {
    const { tests } = await gather(userId);
    const ids = tests.map((t) => t.id);
    if (!ids.length) return [];
    const { data, error } = await getSupabaseAdminClient().from("v_judgments" as never).select("source,utm_source,status").in("test_id", ids).order("created_at", { ascending: false }).limit(5000);
    if (error) return [];
    return aggregateSources((data as unknown as { source: string | null; utm_source: string | null; status: string }[]) ?? []);
  } catch { return []; }
}

// Source quality for one evaluation (owner report panel).
export async function testSourceQuality(testId: string): Promise<SourceRow[]> {
  if (!testId || !isDatabaseConfigured()) return [];
  try {
    const { data, error } = await getSupabaseAdminClient().from("v_judgments" as never).select("source,utm_source,status").eq("test_id", testId).limit(5000);
    if (error) return [];
    return aggregateSources((data as unknown as { source: string | null; utm_source: string | null; status: string }[]) ?? []);
  } catch { return []; }
}

// Judge-pool provenance for one evaluation. Pure derivation over v_judgments
// (who judged) + v_voter_rep (their track record). No invented metrics: we report
// only unique-judge count and how many came from judges with a clean prior record.
// "Clean record" = an established judge (>= REP_MIN_VOTES) whose rejection rate is
// below the gating threshold. We do NOT claim agreement/reliability we don't measure.
export type JudgePool = { uniqueJudges: number; established: number; cleanRecord: number; cleanPct: number | null };
const REP_ESTABLISHED = 12;     // mirrors v-quality REP_MIN_VOTES
const REP_CLEAN_MAX = 0.6;      // below the low-reputation gate

export async function judgePoolStats(testId: string): Promise<JudgePool> {
  const empty: JudgePool = { uniqueJudges: 0, established: 0, cleanRecord: 0, cleanPct: null };
  if (!testId || !isDatabaseConfigured()) return empty;
  try {
    const s = getSupabaseAdminClient();
    const { data: jrows, error } = await s.from("v_judgments" as never).select("voter_id").eq("test_id", testId).eq("status", "valid").limit(10000);
    if (error) return empty;
    const ids = [...new Set(((jrows as unknown as { voter_id: string | null }[]) ?? []).map((r) => r.voter_id).filter((v): v is string => !!v))];
    if (!ids.length) return empty;
    const { data: reps } = await s.from("v_voter_rep" as never).select("voter_id,valid,rejected").in("voter_id", ids).limit(10000);
    const repById: Record<string, { valid: number; rejected: number }> = Object.fromEntries(((reps as unknown as { voter_id: string; valid: number; rejected: number }[]) ?? []).map((r) => [r.voter_id, { valid: r.valid, rejected: r.rejected }]));
    let established = 0, cleanRecord = 0;
    for (const id of ids) {
      const r = repById[id];
      if (!r) continue;
      const total = r.valid + r.rejected;
      if (total >= REP_ESTABLISHED) { established += 1; if (r.rejected / total < REP_CLEAN_MAX) cleanRecord += 1; }
    }
    // cleanPct = share of ESTABLISHED judges with a clean record. Only reported when the
    // established sample is big enough to be meaningful (>=3) — 1-2 established judges make
    // a "0%" or "100%" that's pure noise, so we show "—" (null) instead.
    const cleanPct = established >= 3 ? Math.round((cleanRecord / established) * 100) : null;
    return { uniqueJudges: ids.length, established, cleanRecord, cleanPct };
  } catch { return empty; }
}

// Fill monitor for the cold-pool experiment. Tells a REAL cold fill (many distinct
// people) from a FARMED one (few IPs/devices cycling). Pure derivation over v_judgments
// (ip_hash, device_hash, created_at are real live columns). No schema change.
// Verdict thresholds are deliberately conservative; this is a signal, not a verdict.
export type FillStats = {
  valid: number; filtered: number;
  uniqueIPs: number; uniqueDevices: number; uniqueVoters: number;
  votesPerIP: number | null;       // valid / uniqueIPs — ~1 healthy; high = concentrated
  topIPShare: number | null;       // % of valid votes from the single busiest IP
  timeToValid: { n: number; ms: number | null }[]; // ms from first valid vote to the Nth (25/50/100)
  diversity: "healthy" | "concentrated" | "likely-farmed" | "insufficient";
};

export async function fillStats(testId: string): Promise<FillStats> {
  const empty: FillStats = { valid: 0, filtered: 0, uniqueIPs: 0, uniqueDevices: 0, uniqueVoters: 0, votesPerIP: null, topIPShare: null, timeToValid: [{ n: 25, ms: null }, { n: 50, ms: null }, { n: 100, ms: null }], diversity: "insufficient" };
  if (!testId || !isDatabaseConfigured()) return empty;
  try {
    const s = getSupabaseAdminClient();
    const { data, error } = await s.from("v_judgments" as never)
      .select("voter_id,status,ip_hash,device_hash,created_at")
      .eq("test_id", testId).order("created_at", { ascending: true }).limit(20000);
    if (error) return empty;
    const rows = (data as unknown as { voter_id: string | null; status: string; ip_hash: string | null; device_hash: string | null; created_at: string }[]) ?? [];
    const valids = rows.filter((r) => r.status === "valid");
    const filtered = rows.length - valids.length;
    if (!valids.length) return { ...empty, filtered };

    const ipCount: Record<string, number> = {};
    const devices = new Set<string>();
    const voters = new Set<string>();
    for (const r of valids) {
      if (r.ip_hash) ipCount[r.ip_hash] = (ipCount[r.ip_hash] ?? 0) + 1;
      if (r.device_hash) devices.add(r.device_hash);
      if (r.voter_id) voters.add(r.voter_id);
    }
    const uniqueIPs = Object.keys(ipCount).length;
    const topIP = Object.values(ipCount).reduce((m, c) => Math.max(m, c), 0);
    const votesPerIP = uniqueIPs ? Math.round((valids.length / uniqueIPs) * 100) / 100 : null;
    const topIPShare = uniqueIPs ? Math.round((topIP / valids.length) * 100) : null;

    // time-to-N from the first valid vote
    const t0 = new Date(valids[0].created_at).getTime();
    const timeToValid = [25, 50, 100].map((n) => ({ n, ms: valids.length >= n ? new Date(valids[n - 1].created_at).getTime() - t0 : null }));

    // Honest diversity verdict: needs enough votes to judge; flags concentration.
    let diversity: FillStats["diversity"];
    if (valids.length < 20 || uniqueIPs === 0) diversity = "insufficient";
    else if ((topIPShare ?? 0) >= 40 || (votesPerIP ?? 0) >= 4) diversity = "likely-farmed";
    else if ((topIPShare ?? 0) >= 20 || (votesPerIP ?? 0) >= 2) diversity = "concentrated";
    else diversity = "healthy";

    return { valid: valids.length, filtered, uniqueIPs, uniqueDevices: devices.size, uniqueVoters: voters.size, votesPerIP, topIPShare, timeToValid, diversity };
  } catch { return empty; }
}

// Source quality across one owned project's evaluations.
export async function projectSourceQuality(userId: string, projectId: string): Promise<SourceRow[]> {
  if (!userId || !projectId || !isDatabaseConfigured()) return [];
  try {
    const { tests } = await gather(userId, projectId);
    const ids = tests.map((t) => t.id);
    if (!ids.length) return [];
    const { data, error } = await getSupabaseAdminClient().from("v_judgments" as never).select("source,utm_source,status").in("test_id", ids).limit(5000);
    if (error) return [];
    return aggregateSources((data as unknown as { source: string | null; utm_source: string | null; status: string }[]) ?? []);
  } catch { return []; }
}
