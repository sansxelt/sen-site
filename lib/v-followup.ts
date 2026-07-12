// Confirmation rounds (v1). Turn an "not ready" decision into a one-click follow-up
// round. Reuses the existing launch path (launchTest → v_launch_test RPC: quota + credit
// escrow + create + activate), then stamps lineage (parent_test_id / followup_type /
// followup_reason). Copies only SAFE fields (options by URL/label, category, project,
// target audience) — never raw judgments, old results, source diagnostics, or links.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { getTestWithOptions, getReport, launchTest, type VTest, type VOption } from "./v-db";
import { entitlements, MIN_VOTES } from "./v-entitlements";
import { getPlan } from "./v-db";
import { assignTestToProject } from "./v-projects";
import { setTargetAudience } from "./v-screening";
import { followupForReadiness, FOLLOWUP_TYPES, type FollowupType } from "./v-readiness";
import { logEvent } from "./v-events";

const norm = (e: string) => e.trim().toLowerCase();
const TITLE_PREFIX: Record<FollowupType, string> = {
  top_up: "More signal",
  retest_top_two: "Confirmation round",
  cleaner_audience: "Cleaner rerun",
  confirm_recommendation: "Confirmation round",
  narrow_audience: "Audience rerun",
};
const reasonForType = (t: FollowupType): string => {
  const map: Record<FollowupType, string> = {
    top_up: "Needs more judgments", retest_top_two: "Too close to call", cleaner_audience: "Noisy signal",
    confirm_recommendation: "Directional signal", narrow_audience: "Audience mismatch",
  };
  return map[t];
};

// v1: ONLY the evaluation owner can launch a follow-up. A follow-up escrows credits and
// creates a new evaluation — the account holder who pays must control it. Letting a
// project/workspace editor launch one would either spend their own credits on someone
// else's decision or drain the owner's balance; both are unsafe. An owner-approved /
// shared-credit editor path is deferred (see report). Viewer/client_viewer never qualify.
export async function canCreateFollowup(email: string, test: VTest): Promise<boolean> {
  return !!email && test.user_id === norm(email);
}

// Default additional target by follow-up type (clamped to plan in launch). Honest: a full
// extra round for top-ups, a stronger pass for the narrowed/confirmation rounds.
function defaultTarget(type: FollowupType, parentTarget: number): number {
  const base = parentTarget || 100;
  if (type === "retest_top_two" || type === "confirm_recommendation") return Math.max(base, 150);
  return base;
}

type Result = { ok: boolean; error?: string; id?: string; url?: string; target?: number; type?: FollowupType };

export async function createFollowup(email: string, parentId: string, type: string, targetOverride?: number, titleOverride?: string): Promise<Result> {
  if (!isDatabaseConfigured()) return { ok: false, error: "unavailable" };
  if (!FOLLOWUP_TYPES.includes(type as FollowupType)) return { ok: false, error: "bad_type" };
  const ft = type as FollowupType;
  const td = await getTestWithOptions(parentId);
  if (!td) return { ok: false, error: "not_found" };
  const { test, options } = td;
  if (!(await canCreateFollowup(email, test))) return { ok: false, error: "forbidden" };

  // ── choose the option set safely ──
  let chosen: VOption[] = options;
  if (ft === "retest_top_two" || ft === "confirm_recommendation") {
    // Need a real ranking to know the top two (leader + strongest challenger). If the
    // report/ranking isn't available, fail loudly rather than retest arbitrary options.
    const report = test.status === "complete" ? await getReport(parentId) : null;
    const ranked = report?.results?.ranked ? [...report.results.ranked].sort((a, b) => b.votes - a.votes) : [];
    if (ranked.length < 2) return { ok: false, error: "report_unavailable" };
    const topIds = ranked.slice(0, 2).map((r) => r.id);
    const top = topIds.map((id) => options.find((o) => o.id === id)).filter(Boolean) as VOption[];
    if (top.length < 2) return { ok: false, error: "report_unavailable" };
    chosen = top;
  }
  // Copy options by URL/label only — never the storage path (no shared-asset ownership).
  const launchOptions = chosen.map((o) => ({ asset: o.asset_url ?? undefined, label: o.label ?? undefined })).filter((o) => o.asset || o.label);
  if (launchOptions.length < 2) return { ok: false, error: "need_2_options" };

  const ent = entitlements(await getPlan(email));
  const wanted = targetOverride && targetOverride > 0 ? targetOverride : defaultTarget(ft, test.votes_target);
  const votesTarget = Math.max(MIN_VOTES, Math.min(ent.maxVotes, wanted));
  const title = (titleOverride?.trim() || `${TITLE_PREFIX[ft]}: ${test.title}`).slice(0, 140);

  const r = await launchTest({ userId: email, title, context: test.context ?? undefined, category: test.category, audience: test.audience, votesTarget, options: launchOptions, activeLimit: ent.activeTestsPerMonth, maxOptions: ent.maxOptions });
  if (r.status === "plan_limit") return { ok: false, error: "plan_limit" };
  if (r.status === "insufficient_credits") return { ok: false, error: "insufficient_credits" };
  if (r.status !== "ok" || !r.id) return { ok: false, error: "create_failed" };

  // ── carry safe context + stamp lineage ──
  const reason = reasonForType(ft);
  // Keep it in the same project (robust regardless of the lineage columns).
  if (test.project_id) { try { await assignTestToProject(email, r.id, test.project_id); } catch {} }
  if (test.target_audience) { try { await setTargetAudience(email, r.id, test.target_audience); } catch {} }
  // Lineage stamp — separate so a pre-migration absence of these columns can't undo the
  // project filing above. The round still launched even if this no-ops.
  try { await getSupabaseAdminClient().from("v_tests" as never).update({ parent_test_id: parentId, followup_type: ft, followup_reason: reason } as never).eq("id", r.id); } catch { /* columns absent pre-migration */ }

  await logEvent({ userId: norm(email), testId: parentId, eventType: "followup_created", actorType: "owner", source: "app", metadata: { test_id: parentId, followup_test_id: r.id, followup_type: ft, project_id: test.project_id ?? null, reason } });
  await logEvent({ userId: norm(email), testId: r.id, eventType: "confirmation_round_created", actorType: "owner", source: "app", metadata: { test_id: parentId, followup_test_id: r.id, followup_type: ft, project_id: test.project_id ?? null } });
  return { ok: true, id: r.id, url: `/tests/${r.id}/report?launched=1`, target: votesTarget, type: ft };
}

// Lineage for a report header: the parent it came from + any confirmation rounds spawned.
export type FollowupLineage = { parent: { id: string; title: string; type: string | null } | null; children: { id: string; title: string; type: string | null; status: string }[] };
export async function followupLineage(testId: string, ownerEmail: string): Promise<FollowupLineage> {
  const out: FollowupLineage = { parent: null, children: [] };
  if (!testId || !isDatabaseConfigured()) return out;
  try {
    const s = getSupabaseAdminClient();
    const uid = norm(ownerEmail);
    const { data: self } = await s.from("v_tests" as never).select("parent_test_id,followup_type").eq("id", testId).maybeSingle();
    const me = self as unknown as { parent_test_id: string | null; followup_type: string | null } | null;
    if (me?.parent_test_id) {
      const { data: p } = await s.from("v_tests" as never).select("id,title").eq("id", me.parent_test_id).eq("user_id", uid).maybeSingle();
      const pp = p as unknown as { id: string; title: string } | null;
      if (pp) out.parent = { id: pp.id, title: pp.title, type: me.followup_type };
    }
    const { data: kids } = await s.from("v_tests" as never).select("id,title,followup_type,status").eq("parent_test_id", testId).eq("user_id", uid).order("created_at", { ascending: true });
    out.children = ((kids as unknown as { id: string; title: string; followup_type: string | null; status: string }[]) ?? []).map((k) => ({ id: k.id, title: k.title, type: k.followup_type, status: k.status }));
  } catch { /* columns absent — no lineage */ }
  return out;
}
