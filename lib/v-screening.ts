// Audience screening — simple multiple-choice qualification before a judgment.
// Disqualified participants are counted in v_screening_responses only; they never
// create a judgment, so they never touch votes_valid / the report / owner credits.
// No individual answers are stored (privacy). Owner-scoped CRUD; participant reads
// the questions to answer them. Tolerant of missing tables (pre-migration).

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { logEvent } from "./v-events";

const norm = (e: string) => e.trim().toLowerCase();
const MAX_Q = 3;

export type ScreeningQuestion = { id: string; question: string; options: string[]; qualifying_options: string[] | null; is_required: boolean; position: number };
export type AudienceFit = "Strong fit" | "Mixed fit" | "Limited fit" | "Not screened";
export type ScreeningStats = { enabled: boolean; screened: number; qualified: number; disqualified: number; rate: number; fit: AudienceFit };

function cleanOptions(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map((x) => String(x ?? "").trim().slice(0, 80)).filter(Boolean))].slice(0, 8);
}
async function ownsTest(s: ReturnType<typeof getSupabaseAdminClient>, userId: string, testId: string): Promise<boolean> {
  const { data } = await s.from("v_tests" as never).select("id").eq("id", testId).eq("user_id", norm(userId)).maybeSingle();
  return !!data;
}

export async function createScreeningQuestion(userId: string, testId: string, question: string, options: unknown, qualifying: unknown, isRequired: boolean): Promise<{ ok: boolean; id?: string }> {
  if (!userId || !testId || !isDatabaseConfigured()) return { ok: false };
  const q = (question || "").trim().slice(0, 160);
  const opts = cleanOptions(options);
  if (!q || opts.length < 2) return { ok: false };
  const qual = cleanOptions(qualifying).filter((o) => opts.includes(o));
  const s = getSupabaseAdminClient();
  if (!(await ownsTest(s, userId, testId))) return { ok: false };
  const { count } = await s.from("v_screening_questions" as never).select("*", { count: "exact", head: true }).eq("test_id", testId);
  if ((count ?? 0) >= MAX_Q) return { ok: false };
  const { data, error } = await s.from("v_screening_questions" as never)
    .insert({ user_id: norm(userId), test_id: testId, question: q, options: opts, qualifying_options: qual.length ? qual : null, is_required: isRequired !== false, position: count ?? 0 } as never)
    .select("id").single();
  if (error || !data) { console.error("createScreeningQuestion:", error?.message); return { ok: false }; }
  const id = (data as unknown as { id: string }).id;
  await logEvent({ userId: norm(userId), testId, eventType: "screening_question_created", actorType: "owner", source: "app", metadata: { test_id: testId } });
  return { ok: true, id };
}

export async function deleteScreeningQuestion(userId: string, id: string): Promise<{ ok: boolean }> {
  if (!userId || !id || !isDatabaseConfigured()) return { ok: false };
  const s = getSupabaseAdminClient();
  const { data, error } = await s.from("v_screening_questions" as never).delete().eq("id", id).eq("user_id", norm(userId)).select("test_id");
  if (error || !data || (data as unknown[]).length === 0) return { ok: false };
  await logEvent({ userId: norm(userId), testId: (data as unknown as { test_id: string }[])[0]?.test_id, eventType: "screening_question_updated", actorType: "owner", source: "app", metadata: { action: "deleted" } });
  return { ok: true };
}

// Owner-scoped list (management UI).
export async function listScreeningQuestions(userId: string, testId: string): Promise<ScreeningQuestion[]> {
  if (!userId || !testId || !isDatabaseConfigured()) return [];
  try {
    const s = getSupabaseAdminClient();
    if (!(await ownsTest(s, userId, testId))) return [];
    const { data, error } = await s.from("v_screening_questions" as never).select("id,question,options,qualifying_options,is_required,position").eq("test_id", testId).order("position", { ascending: true });
    if (error) return [];
    return (data as unknown as ScreeningQuestion[]) ?? [];
  } catch { return []; }
}

// Participant-facing — questions for a test (voters answer them; no ownership).
export async function screeningQuestionsForTest(testId: string): Promise<ScreeningQuestion[]> {
  if (!testId || !isDatabaseConfigured()) return [];
  try {
    const { data, error } = await getSupabaseAdminClient().from("v_screening_questions" as never).select("id,question,options,qualifying_options,is_required,position").eq("test_id", testId).order("position", { ascending: true });
    if (error) return [];
    return (data as unknown as ScreeningQuestion[]) ?? [];
  } catch { return []; }
}

// Pure: does this answer set qualify? Required + unanswered → disqualified; an
// answered question whose answer isn't in qualifying_options → disqualified.
export function evaluateQualification(questions: ScreeningQuestion[], answers: Record<string, string> | undefined): boolean {
  if (!questions.length) return true;
  const a = answers || {};
  for (const q of questions) {
    const ans = a[q.id];
    if (q.is_required && !ans) return false;
    if (!ans) continue;
    if (Array.isArray(q.qualifying_options) && q.qualifying_options.length && !q.qualifying_options.includes(ans)) return false;
  }
  return true;
}

export async function recordScreeningOutcome(testId: string, status: "qualified" | "disqualified"): Promise<void> {
  if (!testId || !isDatabaseConfigured()) return;
  try { await getSupabaseAdminClient().from("v_screening_responses" as never).insert({ test_id: testId, screening_status: status === "qualified" ? "qualified" : "disqualified" } as never); } catch { /* ignore */ }
}

// Owner-scoped set of the evaluation's audience profile (post-launch, like project).
export async function setTargetAudience(userId: string, testId: string, text: string): Promise<void> {
  if (!userId || !testId || !isDatabaseConfigured()) return;
  const t = (text || "").trim().slice(0, 200);
  if (!t) return;
  try { await getSupabaseAdminClient().from("v_tests" as never).update({ target_audience: t } as never).eq("id", testId).eq("user_id", norm(userId)); } catch { /* column may not exist pre-migration */ }
}

export function audienceFit(screened: number, qualified: number): AudienceFit {
  if (!screened) return "Not screened";
  const rate = Math.round((qualified / screened) * 100);
  if (rate >= 70) return "Strong fit";
  if (rate >= 40) return "Mixed fit";
  return "Limited fit";
}

// Per-evaluation screening stats (owner report / library).
export async function screeningStats(testId: string): Promise<ScreeningStats> {
  const empty: ScreeningStats = { enabled: false, screened: 0, qualified: 0, disqualified: 0, rate: 0, fit: "Not screened" };
  if (!testId || !isDatabaseConfigured()) return empty;
  try {
    const s = getSupabaseAdminClient();
    const [{ count: qCount }, { data: resp }] = await Promise.all([
      s.from("v_screening_questions" as never).select("*", { count: "exact", head: true }).eq("test_id", testId),
      s.from("v_screening_responses" as never).select("screening_status").eq("test_id", testId).limit(20000),
    ]);
    const rows = (resp as unknown as { screening_status: string }[]) ?? [];
    const qualified = rows.filter((r) => r.screening_status === "qualified").length;
    const disqualified = rows.filter((r) => r.screening_status === "disqualified").length;
    const screened = qualified + disqualified;
    return { enabled: (qCount ?? 0) > 0, screened, qualified, disqualified, rate: screened ? Math.round((qualified / screened) * 100) : 0, fit: audienceFit(screened, qualified) };
  } catch { return empty; }
}

// Aggregate screening stats across a user's evaluations (analytics surfaces).
export type UserScreeningStats = { screened: number; qualified: number; disqualified: number; rate: number; evalsWithScreening: number; fit: { strong: number; mixed: number; limited: number } };
export async function screeningStatsForUser(userId: string): Promise<UserScreeningStats> {
  const empty: UserScreeningStats = { screened: 0, qualified: 0, disqualified: 0, rate: 0, evalsWithScreening: 0, fit: { strong: 0, mixed: 0, limited: 0 } };
  if (!userId || !isDatabaseConfigured()) return empty;
  try {
    const s = getSupabaseAdminClient();
    const uid = norm(userId);
    const ids = ((await s.from("v_tests" as never).select("id").eq("user_id", uid).limit(1000)).data as unknown as { id: string }[] ?? []).map((t) => t.id);
    if (!ids.length) return empty;
    const [{ data: qs }, { data: resp }] = await Promise.all([
      s.from("v_screening_questions" as never).select("test_id").in("test_id", ids),
      s.from("v_screening_responses" as never).select("test_id,screening_status").in("test_id", ids).limit(20000),
    ]);
    const screeningTests = new Set(((qs as unknown as { test_id: string }[]) ?? []).map((q) => q.test_id));
    const rows = (resp as unknown as { test_id: string; screening_status: string }[]) ?? [];
    const qualified = rows.filter((r) => r.screening_status === "qualified").length;
    const disqualified = rows.filter((r) => r.screening_status === "disqualified").length;
    const screened = qualified + disqualified;
    // fit distribution across screening-enabled tests
    const perTest: Record<string, { q: number; d: number }> = {};
    for (const r of rows) { const a = (perTest[r.test_id] ??= { q: 0, d: 0 }); if (r.screening_status === "qualified") a.q++; else a.d++; }
    const fit = { strong: 0, mixed: 0, limited: 0 };
    for (const id of screeningTests) {
      const a = perTest[id]; if (!a || a.q + a.d === 0) continue;
      const f = audienceFit(a.q + a.d, a.q);
      if (f === "Strong fit") fit.strong++; else if (f === "Mixed fit") fit.mixed++; else if (f === "Limited fit") fit.limited++;
    }
    return { screened, qualified, disqualified, rate: screened ? Math.round((qualified / screened) * 100) : 0, evalsWithScreening: screeningTests.size, fit };
  } catch { return empty; }
}
