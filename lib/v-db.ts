// Vraelis Rank — data access (Supabase service-role). Scoped by user_id in code.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { refund } from "./v-credits";

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
  return r && r.status === "active" ? r.plan : "free";
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
}): Promise<"ok" | "dup" | "err"> {
  if (!isDatabaseConfigured()) return "err";
  const s = getSupabaseAdminClient();
  const { error } = await s.from("v_judgments" as never).insert({
    test_id: args.testId, voter_id: norm(args.voterId), option_id: args.optionId,
    reason: args.reason ?? null, time_spent_ms: args.timeSpentMs ?? null, status: "valid",
  } as never);
  if (error) {
    if ((error as { code?: string }).code === "23505") return "dup"; // already voted
    console.error("recordJudgment:", error.message);
    return "err";
  }
  const { data: t } = await s.from("v_tests" as never).select("votes_valid,votes_target").eq("id", args.testId).maybeSingle();
  const tt = t as unknown as { votes_valid: number; votes_target: number } | null;
  if (tt) {
    const nv = tt.votes_valid + 1;
    await s.from("v_tests" as never).update({ votes_valid: nv } as never).eq("id", args.testId);
    if (nv >= tt.votes_target) await completeTest(args.testId);
  }
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

export const OPTION_LETTERS = LETTERS;
