// Developer sandbox evaluations. Created directly (NOT through the credit-holding
// launch RPC), so they never charge credits or count toward plan quota. They are
// marked is_sandbox=true (excluded from all analytics/lists) and carry a
// DETERMINISTIC sample report, so the full integration flow — create → decision
// package → export → webhook — works without real human judgments. Sample only:
// no real people judged a sandbox evaluation.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { logEvent } from "./v-events";

const norm = (e: string) => e.trim().toLowerCase();
const SAMPLE_VALID = 120;
const SAMPLE_FILTERED = 11;

export async function createSandboxEvaluation(
  userId: string,
  args: { title?: string; category: string; audience: string; options: { asset?: string; label?: string }[] },
): Promise<{ id: string } | null> {
  if (!isDatabaseConfigured()) return null;
  const s = getSupabaseAdminClient();
  const uid = norm(userId);
  const now = new Date().toISOString();
  let opts = (args.options || []).filter((o) => o.asset || o.label);
  if (opts.length < 2) opts = [{ label: "Option A (sample)" }, { label: "Option B (sample)" }];
  opts = opts.slice(0, 6);

  const { data: t, error } = await s.from("v_tests" as never)
    .insert({ user_id: uid, title: (args.title || "Sandbox evaluation").slice(0, 140), context: null, category: args.category, audience: args.audience, status: "complete", votes_target: SAMPLE_VALID, votes_valid: SAMPLE_VALID, credits_held: 0, completed_at: now, is_sandbox: true } as never)
    .select("id").single();
  if (error || !t) { console.error("createSandboxEvaluation:", error?.message); return null; }
  const testId = (t as unknown as { id: string }).id;

  const optRows = opts.map((o, i) => ({ test_id: testId, position: i, asset_url: o.asset ?? null, label: o.label ?? `Option ${String.fromCharCode(65 + i)}` }));
  const { data: inserted } = await s.from("v_test_options" as never).insert(optRows as never).select("id,position,label");
  const ids = ((inserted as unknown as { id: string; position: number; label: string | null }[]) ?? []).sort((a, b) => a.position - b.position);

  // Deterministic sample result: first option wins 70%, the rest split 30%.
  const n = Math.max(1, ids.length);
  const ranked = ids.map((o, i) => ({
    id: o.id, position: o.position, label: o.label,
    votes: i === 0 ? Math.round(SAMPLE_VALID * 0.7) : Math.round((SAMPLE_VALID * 0.3) / Math.max(1, n - 1)),
    pct: i === 0 ? 70 : Math.round(30 / Math.max(1, n - 1)),
  }));
  await s.from("v_reports" as never).insert({ test_id: testId, winner_option_id: null, results: { total: SAMPLE_VALID, filtered: SAMPLE_FILTERED, winner_option_id: ids[0]?.id ?? null, ranked, comments: [], recommendation: "Option A" } } as never);

  await logEvent({ userId: uid, testId, eventType: "sandbox_evaluation_created", actorType: "api", source: "api", metadata: { test_id: testId, is_sandbox: true } });
  return { id: testId };
}
