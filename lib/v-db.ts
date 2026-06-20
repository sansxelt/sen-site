// Vraelis Rank — data access (Supabase service-role). Scoped by user_id in code.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { refund } from "./v-credits";
import type { ReportAnalysis } from "./v-ai";

function norm(e: string): string { return e.trim().toLowerCase(); }

export type VTest = {
  id: string; user_id: string; title: string; context: string | null;
  category: string; audience: string; status: string;
  votes_target: number; votes_valid: number; credits_held: number;
  created_at: string; completed_at: string | null;
};
export type VOption = { id: string; test_id: string; position: number; asset_url: string | null; label: string | null };
export type VReport = {
  test_id: string; winner_option_id: string | null;
  results: {
    total: number;
    ranked: { id: string; position: number; label: string | null; votes: number; pct: number }[];
    winner_option_id: string;
    comments: { option_id: string; reason: string }[];
    recommendation: string;
    analysis?: ReportAnalysis | null;
  };
};

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export async function ensureProfile(userId: string, displayName?: string): Promise<void> {
  if (!userId || !isDatabaseConfigured()) return;
  const s = getSupabaseAdminClient();
  await s.from("v_profiles" as never).upsert(
    { user_id: norm(userId), display_name: displayName ?? null } as never,
    { onConflict: "user_id", ignoreDuplicates: true } as never,
  );
}

export async function getPlan(userId: string): Promise<string> {
  if (!userId || !isDatabaseConfigured()) return "free";
  const s = getSupabaseAdminClient();
  const { data } = await s.from("v_subscriptions" as never).select("plan,status").eq("user_id", norm(userId)).maybeSingle();
  const r = data as unknown as { plan: string; status: string } | null;
  // past_due keeps the tier during Stripe's dunning/retry grace (credits simply
  // don't refresh); only a true cancellation drops to free.
  return r && (r.status === "active" || r.status === "past_due") ? r.plan : "free";
}

export async function createTest(args: {
  userId: string; title: string; context?: string; category: string; audience: string;
  votesTarget: number; options: { asset?: string; label?: string }[];
}): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;
  const s = getSupabaseAdminClient();
  const { data, error } = await s.from("v_tests" as never).insert({
    user_id: norm(args.userId), title: args.title, context: args.context ?? null,
    category: args.category, audience: args.audience, votes_target: args.votesTarget, status: "draft",
  } as never).select("id").single();
  if (error) { console.error("createTest:", error.message); return null; }
  const id = (data as unknown as { id: string }).id;
  const rows = args.options.map((o, i) => ({ test_id: id, position: i, asset_url: o.asset ?? null, label: o.label ?? null }));
  const ins = await s.from("v_test_options" as never).insert(rows as never);
  if (ins.error) { console.error("createTest options:", ins.error.message); }
  return id;
}

export async function setTestActive(testId: string, creditsHeld: number): Promise<void> {
  const s = getSupabaseAdminClient();
  await s.from("v_tests" as never).update({ status: "active", credits_held: creditsHeld } as never).eq("id", testId);
}

export async function getTestWithOptions(testId: string): Promise<{ test: VTest; options: VOption[] } | null> {
  if (!testId || !isDatabaseConfigured()) return null;
  const s = getSupabaseAdminClient();
  const { data: test } = await s.from("v_tests" as never).select("*").eq("id", testId).maybeSingle();
  if (!test) return null;
  const { data: options } = await s.from("v_test_options" as never).select("*").eq("test_id", testId).order("position");
  return { test: test as unknown as VTest, options: (options as unknown as VOption[]) ?? [] };
}

export async function listUserTests(userId: string): Promise<VTest[]> {
  if (!userId || !isDatabaseConfigured()) return [];
  const s = getSupabaseAdminClient();
  const { data } = await s.from("v_tests" as never).select("*").eq("user_id", norm(userId)).order("created_at", { ascending: false }).limit(50);
  return (data as unknown as VTest[]) ?? [];
}

// Next active test this voter hasn't judged and doesn't own.
export async function nextTestForVoter(voterId: string): Promise<{ test: VTest; options: VOption[] } | null> {
  if (!voterId || !isDatabaseConfigured()) return null;
  const s = getSupabaseAdminClient();
  const { data: tests } = await s.from("v_tests" as never).select("*").eq("status", "active").neq("user_id", norm(voterId)).order("created_at", { ascending: true }).limit(25);
  const list = (tests as unknown as VTest[]) ?? [];
  for (const t of list) {
    if (t.votes_valid >= t.votes_target) continue;
    const { count } = await s.from("v_judgments" as never).select("*", { count: "exact", head: true }).eq("test_id", t.id).eq("voter_id", norm(voterId));
    if ((count ?? 0) > 0) continue;
    const { data: options } = await s.from("v_test_options" as never).select("*").eq("test_id", t.id).order("position");
    return { test: t, options: (options as unknown as VOption[]) ?? [] };
  }
  return null;
}

export async function recordJudgment(args: {
  testId: string; voterId: string; optionId: string; reason?: string; timeSpentMs?: number;
}): Promise<"ok" | "dup" | "invalid" | "err"> {
  if (!isDatabaseConfigured()) return "err";
  const s = getSupabaseAdminClient();
  const voter = norm(args.voterId);

  // Validate: test is active, not the voter's own, and not already full.
  const { data: t } = await s.from("v_tests" as never).select("user_id,status,votes_valid,votes_target").eq("id", args.testId).maybeSingle();
  const tt = t as unknown as { user_id: string; status: string; votes_valid: number; votes_target: number } | null;
  if (!tt || tt.status !== "active" || tt.user_id === voter || tt.votes_valid >= tt.votes_target) return "invalid";

  // Validate: the chosen option belongs to this test.
  const { count: optOk } = await s.from("v_test_options" as never).select("*", { count: "exact", head: true }).eq("id", args.optionId).eq("test_id", args.testId);
  if ((optOk ?? 0) === 0) return "invalid";

  const { error } = await s.from("v_judgments" as never).insert({
    test_id: args.testId, voter_id: voter, option_id: args.optionId,
    reason: args.reason ?? null, time_spent_ms: args.timeSpentMs ?? null, status: "valid",
  } as never);
  if (error) {
    if ((error as { code?: string }).code === "23505") return "dup"; // already voted
    console.error("recordJudgment:", error.message);
    return "err";
  }

  const nv = tt.votes_valid + 1;
  await s.from("v_tests" as never).update({ votes_valid: nv } as never).eq("id", args.testId);
  if (nv >= tt.votes_target) await completeTest(args.testId);
  return "ok";
}

// Tally valid judgments → report, mark complete, refund unfilled credits.
export async function completeTest(testId: string): Promise<void> {
  const s = getSupabaseAdminClient();
  const data = await getTestWithOptions(testId);
  if (!data || data.test.status === "complete") return;
  const { test, options } = data;
  const { data: judg } = await s.from("v_judgments" as never).select("option_id,reason").eq("test_id", testId).eq("status", "valid");
  const judgments = (judg as unknown as { option_id: string; reason: string | null }[]) ?? [];
  const total = judgments.length || 1;
  const tally: Record<string, number> = {};
  for (const o of options) tally[o.id] = 0;
  for (const j of judgments) tally[j.option_id] = (tally[j.option_id] || 0) + 1;
  const ranked = options
    .map((o) => ({ id: o.id, position: o.position, label: o.label, votes: tally[o.id] || 0, pct: Math.round(((tally[o.id] || 0) / total) * 100) }))
    .sort((a, b) => b.votes - a.votes);
  const winner = ranked[0];
  const comments = judgments.filter((j) => j.reason && j.reason.trim()).map((j) => ({ option_id: j.option_id, reason: j.reason as string })).slice(0, 40);
  const recommendation = `Option ${LETTERS[winner.position] ?? "?"} won with ${winner.pct}% of ${judgments.length} vote${judgments.length === 1 ? "" : "s"} — go with it.`;
  const results = { total: judgments.length, ranked, winner_option_id: winner.id, comments, recommendation };
  await s.from("v_reports" as never).upsert({ test_id: testId, winner_option_id: winner.id, results } as never, { onConflict: "test_id" } as never);
  await s.from("v_tests" as never).update({ status: "complete", completed_at: new Date().toISOString() } as never).eq("id", testId);
  const unfilled = Math.max(0, test.votes_target - judgments.length);
  if (unfilled > 0) await refund(test.user_id, testId, unfilled);
}

export async function getReport(testId: string): Promise<VReport | null> {
  if (!testId || !isDatabaseConfigured()) return null;
  const s = getSupabaseAdminClient();
  const { data } = await s.from("v_reports" as never).select("*").eq("test_id", testId).maybeSingle();
  return (data as unknown as VReport) ?? null;
}

// Lazily generate + cache the AI analysis the first time a completed report is
// viewed (so the cost/latency lands on the buyer, not the last voter).
export async function ensureReportAnalysis(testId: string): Promise<VReport | null> {
  const rep = await getReport(testId);
  if (!rep) return null;
  if ("analysis" in rep.results) return rep; // already attempted (cached, even if null)
  const data = await getTestWithOptions(testId);
  if (!data) return rep;
  const { test, options } = data;
  const letterFor = (id: string) => { const o = options.find((x) => x.id === id); return o ? LETTERS[o.position] : "?"; };
  let analysis: ReportAnalysis | null = null;
  try {
    const { analyzeReport } = await import("./v-ai");
    analysis = await analyzeReport({
      title: test.title,
      category: test.category,
      options: rep.results.ranked.map((r) => ({ letter: LETTERS[r.position], pct: r.pct, votes: r.votes, isWinner: r.id === rep.results.winner_option_id })),
      comments: rep.results.comments.map((c) => ({ letter: letterFor(c.option_id), reason: c.reason })),
    });
  } catch { /* fail-soft */ }
  const newResults = { ...rep.results, analysis };
  const s = getSupabaseAdminClient();
  await s.from("v_reports" as never).update({ results: newResults } as never).eq("test_id", testId);
  return { ...rep, results: newResults };
}

// Credit pack purchase — deduped by Stripe session id so a webhook retry can't
// double-grant. Returns true only on the first (fresh) processing.
export async function recordPackPurchase(userId: string, sku: string, credits: number, stripeId: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const s = getSupabaseAdminClient();
  // Insert-first dedup: the unique index on v_payments(stripe_id) makes this
  // atomic, so concurrent/retried deliveries can't both pass (23505 = already done).
  const { error } = await s.from("v_payments" as never).insert({ user_id: norm(userId), stripe_id: stripeId, kind: "credit_pack", sku, credits, status: "paid" } as never);
  if (error) {
    if ((error as { code?: string }).code === "23505") return false;
    console.error("recordPackPurchase:", error.message);
    return false;
  }
  return true;
}

export type VSubscription = { user_id: string; plan: string; status: string; cycle: string | null; stripe_subscription_id: string | null; monthly_credits: number; current_period_end: string | null };

export async function setSubscription(args: {
  userId: string; plan: string; status: string; cycle?: string | null;
  stripeSubscriptionId?: string | null; monthlyCredits?: number; currentPeriodEnd?: string | null;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const s = getSupabaseAdminClient();
  await s.from("v_subscriptions" as never).upsert({
    user_id: norm(args.userId), plan: args.plan, status: args.status,
    cycle: args.cycle ?? null, stripe_subscription_id: args.stripeSubscriptionId ?? null,
    monthly_credits: args.monthlyCredits ?? 0, current_period_end: args.currentPeriodEnd ?? null,
    updated_at: new Date().toISOString(),
  } as never, { onConflict: "user_id" } as never);
}

export async function getSubscription(userId: string): Promise<VSubscription | null> {
  if (!userId || !isDatabaseConfigured()) return null;
  const s = getSupabaseAdminClient();
  const { data } = await s.from("v_subscriptions" as never).select("*").eq("user_id", norm(userId)).maybeSingle();
  return (data as unknown as VSubscription) ?? null;
}

export async function countActiveTestsThisMonth(userId: string): Promise<number> {
  if (!userId || !isDatabaseConfigured()) return 0;
  const s = getSupabaseAdminClient();
  const since = new Date(); since.setUTCDate(1); since.setUTCHours(0, 0, 0, 0);
  // Only launched tests consume the monthly quota — abandoned drafts don't.
  const { count } = await s.from("v_tests" as never).select("*", { count: "exact", head: true }).eq("user_id", norm(userId)).neq("status", "draft").gte("created_at", since.toISOString());
  return count ?? 0;
}

// Record a subscription-invoice payment, deduped by Stripe invoice id via the
// unique index on v_payments(stripe_id) (insert-first; 23505 = already recorded).
// This is the payment audit row — the credit grant itself is separately made
// idempotent via the ledger ext_ref.
export async function recordInvoiceGrant(userId: string, plan: string, credits: number, invoiceId: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const s = getSupabaseAdminClient();
  const { error } = await s.from("v_payments" as never).insert({ user_id: norm(userId), stripe_id: invoiceId, kind: "subscription", sku: plan, credits, status: "paid" } as never);
  if (error) {
    if ((error as { code?: string }).code === "23505") return false;
    console.error("recordInvoiceGrant:", error.message);
    return false;
  }
  return true;
}

export const OPTION_LETTERS = LETTERS;
