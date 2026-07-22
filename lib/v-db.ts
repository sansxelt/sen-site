// Vraelis Rank — data access (Supabase service-role). Scoped by user_id in code.

import crypto from "crypto";
import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { refund, hold, grant, rewardsToday } from "./v-credits";
import { logEvent } from "./v-events";
import type { ReportAnalysis } from "./v-ai";
import type { ReportTheme } from "./v-themes";

function norm(e: string): string { return e.trim().toLowerCase(); }

export type VTest = {
  id: string; user_id: string; title: string; context: string | null;
  category: string; audience: string; status: string;
  votes_target: number; votes_valid: number; credits_held: number;
  created_at: string; completed_at: string | null;
  share_token?: string | null; share_enabled?: boolean;
  project_id?: string | null;
  target_audience?: string | null;
  is_sandbox?: boolean;
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
    themes?: ReportTheme[] | null;
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

// Flip a just-created draft to active. Returns whether a row was actually
// flipped, so the launch fallback can roll back a hold whose test never became
// active (otherwise the escrow is stranded with no active test to refund it).
// Scoped to status='draft' so it can't resurrect a completed/canceled test.
export async function setTestActive(testId: string, creditsHeld: number): Promise<boolean> {
  const s = getSupabaseAdminClient();
  const { data, error } = await s.from("v_tests" as never)
    .update({ status: "active", credits_held: creditsHeld } as never)
    .eq("id", testId).eq("status", "draft").select("id");
  if (error) { console.error("setTestActive:", error.message); return false; }
  return !!data && (data as unknown[]).length > 0;
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

// Paginated + filterable owner-scoped list for the public API. Data-only: the
// query is pinned to .eq(user_id) so a key can only ever see its own owner's rows
// (no client-supplied id is trusted). No business/money/report logic.
export async function listUserTestsPaged(
  userId: string,
  opts: { limit?: number; offset?: number; status?: string; after?: string; before?: string } = {},
): Promise<VTest[]> {
  if (!userId || !isDatabaseConfigured()) return [];
  const limit = Math.max(1, Math.min(50, opts.limit ?? 25));
  const offset = Math.max(0, opts.offset ?? 0);
  const s = getSupabaseAdminClient();
  let q = s.from("v_tests" as never).select("*").eq("user_id", norm(userId));
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.after) q = q.gte("created_at", opts.after);
  if (opts.before) q = q.lte("created_at", opts.before);
  const { data } = await q.order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  return (data as unknown as VTest[]) ?? [];
}

// Narrow, data-only metadata edit for the public API. Touches ONLY title/context,
// never credits/status/counters/owner. Ownership + editable-status are enforced IN
// THE QUERY (.eq user_id + .in status[draft,active]) so it cannot mutate a foreign,
// completed, or canceled row even if the caller's pre-read went stale. No money.
export async function updateTestMeta(
  userId: string,
  testId: string,
  patch: { title?: string; context?: string },
): Promise<{ ok: true; test: VTest } | { ok: false }> {
  if (!userId || !testId || !isDatabaseConfigured()) return { ok: false };
  const upd: Record<string, unknown> = {};
  if (patch.title !== undefined) upd.title = patch.title;
  if (patch.context !== undefined) upd.context = patch.context;
  if (Object.keys(upd).length === 0) return { ok: false };
  const s = getSupabaseAdminClient();
  const { data, error } = await s.from("v_tests" as never)
    .update(upd as never)
    .eq("id", testId)
    .eq("user_id", norm(userId))          // tenant scope — cannot touch another owner's row
    .in("status", ["draft", "active"])    // status guard — completed/canceled rows are frozen
    .select("*");
  if (error) { console.error("updateTestMeta:", error.message); return { ok: false }; }
  const rows = (data as unknown as VTest[]) ?? [];
  if (rows.length === 0) return { ok: false };
  return { ok: true, test: rows[0] };
}

// TRUST GUARD (#5): the cross-tenant "vote to earn" pool is OFF by default. Real
// customer content must never be surfaced to unrelated people farming credits —
// paid/real runs are fulfilled only via managed collection links (/embed/vote).
// Re-enabling requires BOTH this env switch AND opting a run in (visibility='pool'),
// so customer runs stay private even if the pool is ever turned on.
export function communityPoolEnabled(): boolean {
  return process.env.VRAELIS_COMMUNITY_POOL === "on";
}

// Next active COMMUNITY-POOL test this voter hasn't judged and doesn't own.
export async function nextTestForVoter(voterId: string): Promise<{ test: VTest; options: VOption[] } | null> {
  if (!voterId || !isDatabaseConfigured() || !communityPoolEnabled()) return null;
  const s = getSupabaseAdminClient();
  const { data: tests } = await s.from("v_tests" as never).select("*").eq("status", "active").eq("visibility", "pool").neq("user_id", norm(voterId)).order("created_at", { ascending: true }).limit(25);
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

  // Atomic close authority: v_complete_test takes a per-test advisory lock and, IN
  // THE SAME TRANSACTION, flips active→complete (if still active) and COUNTs valid +
  // rejected judgments. Because a concurrent v_record_vote holds the SAME lock across
  // its insert+recount+commit (and re-checks status under the lock), the total below
  // can't miss a slot a late vote is filling and can't include a vote that closed out
  // — so `unfilled` is exact, closing the last completion-snapshot over-refund race.
  // Idempotent: re-callable on an already-complete test (flipped=false, accurate
  // total) so a stranded refund is backfilled. Falls back to the JS flip+count path
  // when the RPC isn't applied yet (42883).
  let freshFlip = false;
  let total: number | null = null;
  let filtered = 0;
  const { data: rpc, error: rpcErr } = await s.rpc("v_complete_test" as never, { p_test: testId } as never);
  if (!rpcErr && rpc) {
    const r = rpc as unknown as { found: boolean; flipped?: boolean; status?: string; total_valid?: number; total_filtered?: number };
    if (!r.found) return; // row genuinely gone — nothing to refund
    if (!r.flipped && r.status !== "complete") return; // still active elsewhere — nothing to do
    freshFlip = !!r.flipped;
    total = r.total_valid ?? 0;
    filtered = r.total_filtered ?? 0;
  } else if (rpcErr && (rpcErr as { code?: string }).code !== "42883") {
    // A real DB error (timeout, pooler blip) must NOT silently skip the refund — throw
    // so the caller (final vote / close / retry) re-enters this idempotent tail.
    throw new Error(`completeTest v_complete_test failed for ${testId}: ${(rpcErr as { message?: string }).message}`);
  } else {
    // ── 42883 fallback: pre-migration JS flip + count (today's exact behavior). ──
    const { data: claimed } = await s.from("v_tests" as never)
      .update({ status: "complete", completed_at: new Date().toISOString() } as never)
      .eq("id", testId).eq("status", "active").select("id");
    freshFlip = !!claimed && (claimed as unknown[]).length > 0;
    if (!freshFlip) {
      const { data: cur } = await s.from("v_tests" as never).select("status").eq("id", testId).maybeSingle();
      if ((cur as unknown as { status?: string } | null)?.status !== "complete") return; // missing / still active
    }
  }

  // Re-read the test + options for the report. A transient DB error here must NOT be
  // treated as "no test" — that would silently skip the refund (the flip already
  // committed). Throw so the caller retries and re-enters the idempotent tail; a
  // genuinely absent row returns quietly.
  const { data: trow, error: tErr } = await s.from("v_tests" as never).select("*").eq("id", testId).maybeSingle();
  if (tErr) throw new Error(`completeTest reread failed for ${testId}: ${tErr.message}`);
  if (!trow) return; // row genuinely gone (cascade delete) — nothing to refund
  const test = trow as unknown as VTest;
  const { data: opts } = await s.from("v_test_options" as never).select("*").eq("test_id", testId).order("position");
  const options = (opts as unknown as VOption[]) ?? [];
  const { data: judg } = await s.from("v_judgments" as never).select("voter_id,option_id,reason").eq("test_id", testId).eq("status", "valid");
  const judgments = (judg as unknown as { voter_id: string; option_id: string; reason: string | null }[]) ?? [];
  // RPC path: `total`/`filtered` are the locked, authoritative counts. Do NOT
  // recompute from this (unlocked) read. Fallback path: derive them here as before.
  if (total === null) {
    total = judgments.length;
    const { count: filteredCount } = await s.from("v_judgments" as never).select("*", { count: "exact", head: true }).eq("test_id", testId).eq("status", "rejected");
    filtered = filteredCount ?? 0;
  }

  // Raw vote aggregation. (Reputation-weighting was removed in Phase 3.07 with the
  // retired evaluator-reputation math; the tally is now the plain valid-vote count.
  // The `weighted` field and `effective_n` are retained on the result shape, equal
  // to the raw counts, so existing v_reports readers keep working unchanged.)
  const rawTally: Record<string, number> = {};
  for (const o of options) rawTally[o.id] = 0;
  for (const j of judgments) rawTally[j.option_id] = (rawTally[j.option_id] || 0) + 1;
  const effectiveN = total;
  const ranked = options
    .map((o) => ({ id: o.id, position: o.position, label: o.label, votes: rawTally[o.id] || 0, pct: total ? Math.round(((rawTally[o.id] || 0) / total) * 100) : 0, weighted: rawTally[o.id] || 0 }))
    .sort((a, b) => b.votes - a.votes);
  const comments = judgments.filter((j) => j.reason && j.reason.trim()).map((j) => ({ option_id: j.option_id, reason: j.reason as string })).slice(0, 40);

  // Winner by raw vote count.
  // Never fabricate an "Option A, 0%" on an empty close; never silently break a tie.
  // The refund below stays on the RAW valid `total`.
  const top = ranked[0], runnerUp = ranked[1];
  const decisive = total >= 1 && top && (!runnerUp || top.votes > runnerUp.votes);
  let winnerId: string | null = null;
  let recommendation: string;
  if (total === 0) {
    recommendation = "Not enough judgments yet to call a winner.";
  } else if (!decisive) {
    recommendation = `It's a tie at the top (${top.pct}%). Collect more judgments to break it.`;
  } else {
    winnerId = top.id;
    recommendation = `Option ${LETTERS[top.position] ?? "?"} won with ${top.pct}% of ${total} judgment${total === 1 ? "" : "s"}. Go with it.`;
  }
  const results = { total, filtered, ranked, winner_option_id: winnerId, comments, recommendation, effective_n: effectiveN };
  await s.from("v_reports" as never).upsert({ test_id: testId, winner_option_id: winnerId, results } as never, { onConflict: "test_id" } as never);
  const unfilled = Math.max(0, test.votes_target - total);
  if (unfilled > 0) await refund(test.user_id, testId, unfilled);

  // Only emit the completion event on the FRESH flip — an idempotent re-entry
  // (backfilling a stranded refund) must not log a second test_completed event.
  if (freshFlip) await logEvent({
    userId: test.user_id, testId, eventType: "test_completed", actorType: "system", source: "system",
    metadata: {
      category: test.category, audience: test.audience, votes_valid: total, votes_filtered: filtered,
      option_count: options.length, result_status: total === 0 ? "no_votes" : winnerId ? "decisive" : "tie",
      winner: winnerId ? (LETTERS[ranked.find((r) => r.id === winnerId)?.position ?? 0] ?? null) : null,
    },
  });
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
  const logLaunch = (id?: string) => logEvent({
    userId: args.userId, testId: id ?? null, eventType: "test_launched", actorType: "owner", source: "launch",
    metadata: { category: args.category, audience: args.audience, votes_target: args.votesTarget, option_count: args.options.length, credits: args.votesTarget },
  });
  if (!error && data) {
    const r = data as unknown as { status: string; id?: string; needed?: number; limit?: number };
    if (r.status === "ok") { await logLaunch(r.id); return { status: "ok", id: r.id }; }
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
  // If activation fails, the credits are already held but no active test exists to
  // ever refund them (completeTest only runs for active→complete). Roll back: refund
  // the hold (idempotent via ext_ref=refund:id) and delete the orphan draft.
  const activated = await setTestActive(id, args.votesTarget);
  if (!activated) { await refund(args.userId, id, args.votesTarget); await deleteTest(id); return { status: "err" }; }
  await logLaunch(id);
  return { status: "ok", id };
}

// Atomic vote + daily-capped reward (v_record_vote RPC). Completion stays in JS.
// Falls back to the JS path when the RPC isn't present yet.
// Best-effort, privacy-safe source write on the just-recorded judgment. Tolerant
// of the columns not existing yet (pre-migration) — never blocks a vote.
async function tagJudgmentSource(testId: string, voterId: string, src?: { source?: string; referrerHost?: string | null; utmSource?: string | null; utmCampaign?: string | null }) {
  if (!src?.source) return;
  try {
    await getSupabaseAdminClient().from("v_judgments" as never)
      .update({ source: src.source, referrer_host: src.referrerHost ?? null, utm_source: src.utmSource ?? null, utm_campaign: src.utmCampaign ?? null } as never)
      .eq("test_id", testId).eq("voter_id", norm(voterId));
  } catch { /* columns may not exist pre-migration; ignore */ }
}

export async function recordVote(args: {
  testId: string; voterId: string; optionId: string; reason?: string; timeSpentMs?: number; rewardCap: number;
  status?: "valid" | "rejected"; rejectReason?: string; ipHash?: string | null; deviceHash?: string | null;
  source?: string; referrerHost?: string | null; utmSource?: string | null; utmCampaign?: string | null;
}): Promise<{ status: "ok" | "dup" | "invalid" | "err"; earned?: boolean; voteStatus?: "valid" | "rejected" }> {
  if (!isDatabaseConfigured()) return { status: "err" };
  const s = getSupabaseAdminClient();
  const src = { source: args.source, referrerHost: args.referrerHost, utmSource: args.utmSource, utmCampaign: args.utmCampaign };
  const { data, error } = await s.rpc("v_record_vote" as never, {
    p_test: args.testId, p_voter: norm(args.voterId), p_option: args.optionId,
    p_reason: args.reason ?? null, p_time_spent: args.timeSpentMs ?? null, p_reward_cap: args.rewardCap,
    p_status: args.status ?? "valid", p_reject_reason: args.rejectReason ?? null,
    p_ip_hash: args.ipHash ?? null, p_device_hash: args.deviceHash ?? null,
  } as never);
  if (!error && data) {
    const r = data as unknown as { status: string; earned?: boolean; should_complete?: boolean; vote_status?: "valid" | "rejected" };
    if (r.status === "ok") {
      await tagJudgmentSource(args.testId, args.voterId, src);
      // Vote events are test-scoped only — never store voter identity here.
      await logEvent({ testId: args.testId, eventType: r.vote_status === "rejected" ? "vote_filtered" : "vote_recorded", actorType: "voter", metadata: r.vote_status === "rejected" && args.rejectReason ? { reject_reason: args.rejectReason } : {} });
      if (r.should_complete) await completeTest(args.testId);
    }
    return { status: (r.status as "ok" | "dup" | "invalid") ?? "err", earned: r.earned, voteStatus: r.vote_status };
  }
  if (error && (error as { code?: string }).code !== "42883") console.error("recordVote rpc:", error.message);

  // Fallback (pre-migration): recordJudgment + capped reward in JS. Quality
  // enforcement (rejection) begins once the v2 SQL is applied.
  const res = await recordJudgment({ testId: args.testId, voterId: args.voterId, optionId: args.optionId, reason: args.reason, timeSpentMs: args.timeSpentMs });
  if (res !== "ok") return { status: res };
  await tagJudgmentSource(args.testId, args.voterId, src);
  // Respect the caller's quality verdict even on this pre-migration fallback: a vote the
  // quality gate already flagged as "rejected" must NOT earn a reward (and is a filtered
  // event), otherwise filtered votes get paid for. The v_record_vote RPC handles this on
  // the live DB; this keeps the fallback honest.
  const rejected = args.status === "rejected";
  await logEvent({ testId: args.testId, eventType: rejected ? "vote_filtered" : "vote_recorded", actorType: "voter", metadata: rejected && args.rejectReason ? { reject_reason: args.rejectReason } : {} });
  let earned = false;
  if (!rejected && (await rewardsToday(args.voterId)) < args.rewardCap) {
    await grant(args.voterId, 1, "reward", { refType: "vote", refId: args.testId, extRef: `reward:${args.testId}` });
    earned = true;
  }
  return { status: "ok", earned, voteStatus: rejected ? "rejected" : "valid" };
}

export async function getReport(testId: string): Promise<VReport | null> {
  if (!testId || !isDatabaseConfigured()) return null;
  const s = getSupabaseAdminClient();
  const { data } = await s.from("v_reports" as never).select("*").eq("test_id", testId).maybeSingle();
  return (data as unknown as VReport) ?? null;
}

// Owner-only: enable/disable/regenerate the public share link for a test.
// Returns null if the test isn't found or the caller isn't the owner.
export async function setShare(testId: string, userId: string, action: "enable" | "disable" | "regenerate"): Promise<{ enabled: boolean; token: string | null } | null> {
  if (!testId || !isDatabaseConfigured()) return null;
  const s = getSupabaseAdminClient();
  const { data } = await s.from("v_tests" as never).select("user_id,status,share_token").eq("id", testId).maybeSingle();
  const row = data as unknown as { user_id: string; status: string; share_token: string | null } | null;
  if (!row || row.user_id !== norm(userId)) return null;
  // Only launched tests can be published; disable is always allowed.
  if (action !== "disable" && row.status !== "active" && row.status !== "complete") return null;
  let token = row.share_token;
  let enabled: boolean;
  if (action === "disable") {
    enabled = false;
  } else {
    if (action === "regenerate" || !token) token = crypto.randomBytes(18).toString("base64url"); // 144-bit unguessable
    enabled = true;
  }
  const { error } = await s.from("v_tests" as never).update({ share_token: token, share_enabled: enabled } as never).eq("id", testId);
  if (error) { console.error("setShare:", error.message); return null; }
  const shareEvent = action === "regenerate" ? "public_report_regenerated" : enabled ? "public_report_enabled" : "public_report_disabled";
  await logEvent({ userId: norm(userId), testId, eventType: shareEvent, actorType: "owner", source: "app", metadata: { action } });
  return { enabled, token };
}

// Public, read-only: resolve a test + report by its share token (only when
// sharing is enabled). No auth. Returns null for unknown/disabled tokens.
export async function getSharedReport(token: string): Promise<{ test: VTest; options: VOption[]; report: VReport | null } | null> {
  if (!token || !isDatabaseConfigured()) return null;
  const s = getSupabaseAdminClient();
  const { data } = await s.from("v_tests" as never).select("*").eq("share_token", token).eq("share_enabled", true).maybeSingle();
  if (!data) return null;
  const test = data as unknown as VTest;
  const { data: options } = await s.from("v_test_options" as never).select("*").eq("test_id", test.id).order("position");
  const report = await getReport(test.id);
  return { test, options: (options as unknown as VOption[]) ?? [], report };
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

// Lazily generate + cache the AI theme summary for a completed report (Workstream
// D). Mirrors ensureReportAnalysis and is fail-soft: only a RAN result is cached
// (an empty array is a valid "no grounded themes" and is cached; a null "couldn't
// run" is not, so a later view retries). Summarization only — never touches the
// decision, the recommendation, or any number.
export async function ensureReportThemes(testId: string): Promise<VReport | null> {
  const rep = await getReport(testId);
  if (!rep) return null;
  if ("themes" in rep.results) return rep; // already attempted (cached, incl. empty)
  const data = await getTestWithOptions(testId);
  if (!data) return rep;
  const { test, options } = data;
  const letterFor = (id: string) => { const o = options.find((x) => x.id === id); return o ? LETTERS[o.position] : "?"; };
  let themes: ReportTheme[] | null = null;
  try {
    const { extractThemes } = await import("./v-themes");
    themes = await extractThemes({
      title: test.title,
      category: test.category,
      options: rep.results.ranked.map((r) => ({ letter: LETTERS[r.position], isWinner: r.id === rep.results.winner_option_id })),
      comments: rep.results.comments.map((c) => ({ letter: letterFor(c.option_id), reason: c.reason })),
    });
  } catch { /* fail-soft */ }
  if (themes === null) return rep; // couldn't run (no key / too few / error) — do not cache
  const newResults = { ...rep.results, themes };
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
  // Only launched tests consume the monthly quota — abandoned drafts don't, and sandbox
  // tests don't (matching the v_launch_test RPC, which excludes is_sandbox). We select the
  // column and filter in JS so a pre-migration DB without is_sandbox still works.
  const { data } = await s.from("v_tests" as never).select("is_sandbox").eq("user_id", norm(userId)).neq("status", "draft").gte("created_at", since.toISOString());
  return ((data as unknown as { is_sandbox?: boolean }[]) ?? []).filter((t) => !t.is_sandbox).length;
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

// Customer analytics aggregate for the owner's data surface (/data). Pure
// table reads (no events required) so it works for existing accounts immediately.
export type DataInsights = {
  totals: { tests: number; completed: number; active: number; draft: number; valid: number; filtered: number; publicShared: number };
  performance: { completionRate: number; avgValidPerCompleted: number; filteredRate: number; avgWinMargin: number | null };
  byCategory: { category: string; count: number }[];
  recent: { id: string; title: string; category: string; winner: string | null; votes: number }[];
  hasApi: boolean; hasWebhooks: boolean;
};

export async function dataInsights(userId: string): Promise<DataInsights> {
  const empty: DataInsights = {
    totals: { tests: 0, completed: 0, active: 0, draft: 0, valid: 0, filtered: 0, publicShared: 0 },
    performance: { completionRate: 0, avgValidPerCompleted: 0, filteredRate: 0, avgWinMargin: null },
    byCategory: [], recent: [], hasApi: false, hasWebhooks: false,
  };
  if (!userId || !isDatabaseConfigured()) return empty;
  const s = getSupabaseAdminClient();
  const uid = norm(userId);
  const { data } = await s.from("v_tests" as never).select("id,title,category,status,votes_valid,share_enabled").eq("user_id", uid).order("created_at", { ascending: false }).limit(500);
  const all = (data as unknown as { id: string; title: string; category: string; status: string; votes_valid: number; share_enabled: boolean }[]) ?? [];
  const completedTests = all.filter((t) => t.status === "complete");
  const valid = all.reduce((a, t) => a + (t.votes_valid || 0), 0);
  const ids = all.map((t) => t.id);
  const [{ count: rejected }, apiCount, hookCount] = await Promise.all([
    ids.length ? s.from("v_judgments" as never).select("*", { count: "exact", head: true }).in("test_id", ids).eq("status", "rejected") : Promise.resolve({ count: 0 }),
    s.from("v_api_keys" as never).select("id", { count: "exact", head: true }).eq("user_id", uid),
    s.from("v_webhook_endpoints" as never).select("id", { count: "exact", head: true }).eq("user_id", uid),
  ]);
  const filtered = rejected ?? 0;

  const catMap: Record<string, number> = {};
  for (const t of completedTests) catMap[t.category] = (catMap[t.category] ?? 0) + 1;
  const byCategory = Object.entries(catMap).map(([category, c]) => ({ category, count: c })).sort((a, b) => b.count - a.count).slice(0, 6);

  // Reports for completed tests (cap 100) → win margin + recent winners.
  const compIds = completedTests.map((t) => t.id).slice(0, 100);
  const { data: reps } = compIds.length ? await s.from("v_reports" as never).select("test_id,results").in("test_id", compIds) : { data: [] };
  const repMap = Object.fromEntries(((reps as unknown as { test_id: string; results: { winner_option_id?: string | null; ranked?: { id: string; position: number; pct: number }[] } }[]) ?? []).map((r) => [r.test_id, r.results]));
  const margins: number[] = [];
  for (const id of compIds) {
    const res = repMap[id];
    if (res?.winner_option_id && res.ranked && res.ranked.length) {
      const ranked = [...res.ranked].sort((a, b) => b.pct - a.pct);
      margins.push((ranked[0]?.pct ?? 0) - (ranked[1]?.pct ?? 0));
    }
  }
  const avgWinMargin = margins.length ? Math.round(margins.reduce((a, b) => a + b, 0) / margins.length) : null;

  const recent = completedTests.slice(0, 5).map((t) => {
    const res = repMap[t.id];
    let winner: string | null = null;
    if (res?.winner_option_id) { const w = (res.ranked ?? []).find((x) => x.id === res.winner_option_id); winner = w ? `${LETTERS[w.position]}, ${w.pct}%` : null; }
    return { id: t.id, title: t.title, category: t.category, winner, votes: t.votes_valid };
  });

  const completed = completedTests.length;
  const launched = completed + all.filter((t) => t.status === "active").length;
  const completedValid = completedTests.reduce((a, t) => a + (t.votes_valid || 0), 0);
  return {
    totals: {
      tests: all.length, completed, active: all.filter((t) => t.status === "active").length,
      draft: all.filter((t) => t.status === "draft").length, valid, filtered,
      publicShared: all.filter((t) => t.share_enabled).length,
    },
    performance: {
      completionRate: launched ? Math.round((completed / launched) * 100) : 0,
      avgValidPerCompleted: completed ? Math.round(completedValid / completed) : 0,
      filteredRate: valid + filtered ? Math.round((filtered / (valid + filtered)) * 100) : 0,
      avgWinMargin,
    },
    byCategory, recent,
    hasApi: (apiCount.count ?? 0) > 0, hasWebhooks: (hookCount.count ?? 0) > 0,
  };
}

export const OPTION_LETTERS = LETTERS;
