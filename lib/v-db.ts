// Vraelis Rank — data access (Supabase service-role). Scoped by user_id in code.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { refund, hold, grant, rewardsToday } from "./v-credits";
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
    filtered?: number;
    ranked: { id: string; position: number; label: string | null; votes: number; pct: number }[];
    winner_option_id: string | null;
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
  votesTarget: number; options: { asset?: string; label?: string; path?: string; mime?: string; size?: number }[];
}): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;
  const s = getSupabaseAdminClient();
  const { data, error } = await s.from("v_tests" as never).insert({
    user_id: norm(args.userId), title: args.title, context: args.context ?? null,
    category: args.category, audience: args.audience, votes_target: args.votesTarget, status: "draft",
  } as never).select("id").single();
  if (error) { console.error("createTest:", error.message); return null; }
  const id = (data as unknown as { id: string }).id;
  const rows = args.options.map((o, i) => {
    const row: Record<string, unknown> = { test_id: id, position: i, asset_url: o.asset ?? null, label: o.label ?? null };
    if (o.path) row.asset_path = o.path;
    if (o.mime) row.mime_type = o.mime;
    if (typeof o.size === "number") row.size_bytes = o.size;
    return row;
  });
  const ins = await s.from("v_test_options" as never).insert(rows as never);
  if (ins.error) {
    // Don't leave a launchable zero-option test (would crash report generation).
    console.error("createTest options:", ins.error.message);
    await s.from("v_tests" as never).delete().eq("id", id);
    return null;
  }
  return id;
}

export async function deleteTest(testId: string): Promise<void> {
  if (!testId || !isDatabaseConfigured()) return;
  const s = getSupabaseAdminClient();
  await s.from("v_tests" as never).delete().eq("id", testId); // options cascade
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
  // Fetch this voter's judged test ids once (avoids an N+1 count per candidate).
  const { data: judged } = await s.from("v_judgments" as never).select("test_id").eq("voter_id", norm(voterId));
  const judgedIds = new Set(((judged as unknown as { test_id: string }[]) ?? []).map((j) => j.test_id));
  for (const t of list) {
    if (t.votes_valid >= t.votes_target) continue;
    if (judgedIds.has(t.id)) continue;
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

  // Derive the count from the source of truth (v_judgments) rather than a
  // read-modify-write +1, so concurrent votes don't lose-update the counter.
  const { count: valid } = await s.from("v_judgments" as never).select("*", { count: "exact", head: true }).eq("test_id", args.testId).eq("status", "valid");
  const nv = valid ?? tt.votes_valid + 1;
  await s.from("v_tests" as never).update({ votes_valid: nv } as never).eq("id", args.testId);
  if (nv >= tt.votes_target) await completeTest(args.testId);
  return "ok";
}

// Tally valid judgments → report, mark complete, refund unfilled credits.
export async function completeTest(testId: string): Promise<void> {
  if (!testId || !isDatabaseConfigured()) return;
  const s = getSupabaseAdminClient();
  // Single-winner gate: atomically flip active → complete. Only the caller that
  // actually flips it runs the tally + refund, so a vote/close race (or two
  // concurrent final votes) can't double-refund.
  const { data: claimed } = await s.from("v_tests" as never)
    .update({ status: "complete", completed_at: new Date().toISOString() } as never)
    .eq("id", testId).eq("status", "active").select("id");
  if (!claimed || (claimed as unknown[]).length === 0) return; // already completed elsewhere

  const data = await getTestWithOptions(testId);
  if (!data) return;
  const { test, options } = data;
  const { data: judg } = await s.from("v_judgments" as never).select("option_id,reason").eq("test_id", testId).eq("status", "valid");
  const judgments = (judg as unknown as { option_id: string; reason: string | null }[]) ?? [];
  const total = judgments.length;
  const { count: filteredCount } = await s.from("v_judgments" as never).select("*", { count: "exact", head: true }).eq("test_id", testId).eq("status", "rejected");
  const filtered = filteredCount ?? 0;
  const tally: Record<string, number> = {};
  for (const o of options) tally[o.id] = 0;
  for (const j of judgments) tally[j.option_id] = (tally[j.option_id] || 0) + 1;
  const ranked = options
    .map((o) => ({ id: o.id, position: o.position, label: o.label, votes: tally[o.id] || 0, pct: total ? Math.round(((tally[o.id] || 0) / total) * 100) : 0 }))
    .sort((a, b) => b.votes - a.votes);
  const comments = judgments.filter((j) => j.reason && j.reason.trim()).map((j) => ({ option_id: j.option_id, reason: j.reason as string })).slice(0, 40);

  // Only call a winner with real signal AND a clear lead — never fabricate an
  // "Option A — 0%" on an empty close, never silently break a tie.
  const top = ranked[0], runnerUp = ranked[1];
  const decisive = total >= 1 && top && (!runnerUp || top.votes > runnerUp.votes);
  let winnerId: string | null = null;
  let recommendation: string;
  if (total === 0) {
    recommendation = "Not enough votes yet to call a winner.";
  } else if (!decisive) {
    recommendation = `It's a tie at the top (${top.pct}%). Collect more votes to break it.`;
  } else {
    winnerId = top.id;
    recommendation = `Option ${LETTERS[top.position] ?? "?"} won with ${top.pct}% of ${total} vote${total === 1 ? "" : "s"} — go with it.`;
  }
  const results = { total, filtered, ranked, winner_option_id: winnerId, comments, recommendation };
  await s.from("v_reports" as never).upsert({ test_id: testId, winner_option_id: winnerId, results } as never, { onConflict: "test_id" } as never);
  const unfilled = Math.max(0, test.votes_target - total);
  if (unfilled > 0) await refund(test.user_id, testId, unfilled);
}

// Atomic test launch — quota + balance check + create + options + escrow hold in
// ONE transaction (v_launch_test RPC, advisory-locked per user). Falls back to the
// non-atomic JS path when the RPC isn't present yet, so launches never break.
export async function launchTest(args: {
  userId: string; title: string; context?: string; category: string; audience: string;
  votesTarget: number; options: { asset?: string; label?: string; path?: string; mime?: string; size?: number }[]; activeLimit: number; maxOptions: number;
}): Promise<{ status: "ok" | "insufficient_credits" | "plan_limit" | "err"; id?: string; needed?: number; limit?: number }> {
  if (!isDatabaseConfigured()) return { status: "err" };
  const s = getSupabaseAdminClient();
  const { data, error } = await s.rpc("v_launch_test" as never, {
    p_user: norm(args.userId), p_title: args.title, p_context: args.context ?? null,
    p_category: args.category, p_audience: args.audience, p_votes: args.votesTarget,
    p_options: args.options, p_active_limit: args.activeLimit, p_max_options: args.maxOptions,
  } as never);
  if (!error && data) {
    const r = data as unknown as { status: string; id?: string; needed?: number; limit?: number };
    if (r.status === "ok") return { status: "ok", id: r.id };
    if (r.status === "insufficient_credits") return { status: "insufficient_credits", needed: r.needed };
    if (r.status === "plan_limit") return { status: "plan_limit", limit: r.limit };
    return { status: "err" };
  }
  if (error && (error as { code?: string }).code !== "42883") console.error("launchTest rpc:", error.message);

  // Fallback (pre-migration): non-atomic create → quota → hold → activate.
  const used = await countActiveTestsThisMonth(args.userId);
  if (used >= args.activeLimit) return { status: "plan_limit", limit: args.activeLimit };
  const id = await createTest({ userId: args.userId, title: args.title, context: args.context, category: args.category, audience: args.audience, votesTarget: args.votesTarget, options: args.options });
  if (!id) return { status: "err" };
  const ok = await hold(args.userId, id, args.votesTarget);
  if (!ok) { await deleteTest(id); return { status: "insufficient_credits", needed: args.votesTarget }; }
  await setTestActive(id, args.votesTarget);
  return { status: "ok", id };
}

// Atomic vote + daily-capped reward (v_record_vote RPC). Completion stays in JS.
// Falls back to the JS path when the RPC isn't present yet.
export async function recordVote(args: {
  testId: string; voterId: string; optionId: string; reason?: string; timeSpentMs?: number; rewardCap: number;
  status?: "valid" | "rejected"; rejectReason?: string; ipHash?: string | null; deviceHash?: string | null;
}): Promise<{ status: "ok" | "dup" | "invalid" | "err"; earned?: boolean; voteStatus?: "valid" | "rejected" }> {
  if (!isDatabaseConfigured()) return { status: "err" };
  const s = getSupabaseAdminClient();
  const { data, error } = await s.rpc("v_record_vote" as never, {
    p_test: args.testId, p_voter: norm(args.voterId), p_option: args.optionId,
    p_reason: args.reason ?? null, p_time_spent: args.timeSpentMs ?? null, p_reward_cap: args.rewardCap,
    p_status: args.status ?? "valid", p_reject_reason: args.rejectReason ?? null,
    p_ip_hash: args.ipHash ?? null, p_device_hash: args.deviceHash ?? null,
  } as never);
  if (!error && data) {
    const r = data as unknown as { status: string; earned?: boolean; should_complete?: boolean; vote_status?: "valid" | "rejected" };
    if (r.status === "ok" && r.should_complete) await completeTest(args.testId);
    return { status: (r.status as "ok" | "dup" | "invalid") ?? "err", earned: r.earned, voteStatus: r.vote_status };
  }
  if (error && (error as { code?: string }).code !== "42883") console.error("recordVote rpc:", error.message);

  // Fallback (pre-migration): recordJudgment + capped reward in JS. Quality
  // enforcement (rejection) begins once the v2 SQL is applied.
  const res = await recordJudgment({ testId: args.testId, voterId: args.voterId, optionId: args.optionId, reason: args.reason, timeSpentMs: args.timeSpentMs });
  if (res !== "ok") return { status: res };
  let earned = false;
  if ((await rewardsToday(args.voterId)) < args.rewardCap) {
    await grant(args.voterId, 1, "reward", { refType: "vote", refId: args.testId, extRef: `reward:${args.testId}` });
    earned = true;
  }
  return { status: "ok", earned, voteStatus: "valid" };
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
  // Only cache a SUCCESSFUL analysis. On a transient failure (timeout, overload,
  // missing key) leave it unset so a later view retries, instead of caching null
  // forever and permanently hiding the paid analysis.
  if (!analysis) return rep;
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

// ── Admin: vote review ──
export type VAdminVote = { id: string; test_id: string; voter_id: string; status: string; reject_reason: string | null; reason: string | null; time_spent_ms: number | null; created_at: string; title: string | null };

export async function listRecentVotes(opts: { status?: string; limit?: number } = {}): Promise<VAdminVote[]> {
  if (!isDatabaseConfigured()) return [];
  const s = getSupabaseAdminClient();
  let q = s.from("v_judgments" as never).select("id,test_id,voter_id,status,reject_reason,reason,time_spent_ms,created_at").order("created_at", { ascending: false }).limit(opts.limit ?? 100);
  if (opts.status) q = (q as { eq: (c: string, v: string) => typeof q }).eq("status", opts.status);
  const { data } = await q;
  const rows = (data as unknown as Omit<VAdminVote, "title">[]) ?? [];
  const ids = [...new Set(rows.map((r) => r.test_id))];
  const { data: tests } = ids.length ? await s.from("v_tests" as never).select("id,title").in("id", ids) : { data: [] };
  const titleById: Record<string, string> = Object.fromEntries(((tests as unknown as { id: string; title: string }[]) ?? []).map((t) => [t.id, t.title]));
  return rows.map((r) => ({ ...r, title: titleById[r.test_id] ?? null }));
}

export async function voteStats(): Promise<{ valid: number; rejected: number; byReason: Record<string, number> }> {
  if (!isDatabaseConfigured()) return { valid: 0, rejected: 0, byReason: {} };
  const s = getSupabaseAdminClient();
  const since = new Date(); since.setUTCDate(since.getUTCDate() - 7);
  const { data } = await s.from("v_judgments" as never).select("status,reject_reason").gte("created_at", since.toISOString());
  const rows = (data as unknown as { status: string; reject_reason: string | null }[]) ?? [];
  const byReason: Record<string, number> = {};
  let valid = 0, rejected = 0;
  for (const r of rows) {
    if (r.status === "rejected") { rejected += 1; const k = r.reject_reason ?? "other"; byReason[k] = (byReason[k] ?? 0) + 1; }
    else valid += 1;
  }
  return { valid, rejected, byReason };
}

// Flip a vote's status (admin) and recount the test's valid votes.
export async function overrideVoteStatus(judgmentId: string, status: "valid" | "rejected"): Promise<boolean> {
  if (!judgmentId || !isDatabaseConfigured()) return false;
  const s = getSupabaseAdminClient();
  const { data: j } = await s.from("v_judgments" as never).select("test_id,status").eq("id", judgmentId).maybeSingle();
  const jj = j as unknown as { test_id: string; status: string } | null;
  if (!jj || jj.status === status) return false;
  await s.from("v_judgments" as never).update({ status, reject_reason: status === "rejected" ? "admin" : null } as never).eq("id", judgmentId);
  const { count } = await s.from("v_judgments" as never).select("*", { count: "exact", head: true }).eq("test_id", jj.test_id).eq("status", "valid");
  await s.from("v_tests" as never).update({ votes_valid: count ?? 0 } as never).eq("id", jj.test_id);
  return true;
}

export async function listRecentLedger(userId: string, limit = 12): Promise<{ delta: number; reason: string; created_at: string }[]> {
  if (!userId || !isDatabaseConfigured()) return [];
  const s = getSupabaseAdminClient();
  const { data } = await s.from("v_credit_ledger" as never).select("delta,reason,created_at").eq("user_id", norm(userId)).order("created_at", { ascending: false }).limit(limit);
  return (data as unknown as { delta: number; reason: string; created_at: string }[]) ?? [];
}

export const OPTION_LETTERS = LETTERS;
