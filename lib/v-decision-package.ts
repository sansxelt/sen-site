// Decision Package v2 — the portable, structured decision result. Pure derivation
// over EXISTING data (test, report + intelligence + health, source quality, audience
// screening, collection links). NEVER includes emails, user ids, raw IPs, device
// hashes, full referrers, share tokens, secrets, private project descriptions, or
// raw screening answers. Scope controls how much is included; the caller authorizes
// ownership before building (export/API are owner/key-scoped; webhooks are compact).

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { getTestWithOptions, getReport, OPTION_LETTERS } from "./v-db";
import { evaluationIntelligence, evaluationHealth } from "./v-intelligence";
import { testSourceQuality } from "./v-analytics";
import { screeningStats } from "./v-screening";
import { collectionLinkSummaries } from "./v-collection-links";

export const DECISION_PACKAGE_VERSION = "v2";
export type PackageScope = "summary" | "standard" | "scale" | "webhook";
const SITE = "https://vraelis.com";

export async function buildDecisionPackage(testId: string, scope: PackageScope = "scale"): Promise<Record<string, unknown> | null> {
  if (!testId || !isDatabaseConfigured()) return null;
  const td = await getTestWithOptions(testId);
  if (!td) return null;
  const { test, options } = td;
  const report = test.status === "complete" ? await getReport(testId) : null;
  const r = report?.results ?? null;
  const intel = r ? evaluationIntelligence(r, test.votes_target) : null;
  const health = intel ? evaluationHealth(test.status, intel) : (test.status === "active" ? "Collecting" : "Needs more judgments");
  const optById = Object.fromEntries(options.map((o) => [o.id, o]));
  const ranked = [...(r?.ranked ?? [])].sort((a, b) => b.votes - a.votes);
  const winnerRow = r?.winner_option_id ? ranked.find((x) => x.id === r.winner_option_id) : null;

  const valid = r?.total ?? test.votes_valid;
  const filtered = r?.filtered ?? 0;
  const responses = valid + filtered;

  const mode = test.is_sandbox ? "sandbox" : "production";

  // ── webhook scope: compact, safe ──
  if (scope === "webhook") {
    const [screen, sources] = await Promise.all([screeningStats(testId), testSourceQuality(testId)]);
    return {
      schema_version: DECISION_PACKAGE_VERSION,
      mode,
      test_id: test.id,
      recommended_output: intel?.recommendedOption ?? null,
      winner_label: winnerRow ? optById[winnerRow.id]?.label ?? null : null,
      preference_margin: intel?.marginPts ?? null,
      directional_confidence: intel?.confidenceLabel ?? "None",
      signal_quality: intel?.signalLabel ?? null,
      evaluation_health: health,
      action_recommendation: intel?.action ?? null,
      valid_judgments: valid,
      filtered_responses: filtered,
      qualified_judgments: screen.enabled ? screen.qualified : null,
      audience_fit: screen.enabled ? screen.fit : null,
      source_quality: sources.slice(0, 4).map((s) => ({ source: s.source, valid_judgments: s.valid, filter_rate: s.filterRate })),
    };
  }

  // ── owner/API scopes (summary → standard → scale) ──
  const pkg: Record<string, unknown> = {
    schema_version: DECISION_PACKAGE_VERSION,
    mode,
    test_id: test.id,
    title: test.title,
    status: test.status,
    category: test.category,
    created_at: test.created_at,
    completed_at: test.completed_at,
    decision: {
      recommended_output: intel?.recommendedOption ?? null,
      winner_option_id: r?.winner_option_id ?? null,
      winner_label: winnerRow ? optById[winnerRow.id]?.label ?? null : null,
      preference_margin: intel?.marginPts ?? null,
      directional_confidence: intel?.confidenceLabel ?? "None",
      signal_quality: intel?.signalLabel ?? null,
      evaluation_health: health,
      action_recommendation: intel?.action ?? null,
      decision_summary: intel?.decisionSummary ?? null,
      inconclusive: intel ? intel.inconclusive : null,
    },
    counts: { valid_judgments: valid, filtered_responses: filtered, total_responses: responses, filter_rate: responses ? Math.round((filtered / responses) * 100) : 0 },
    options: ranked.map((row, i) => ({ option_id: row.id, option: OPTION_LETTERS[row.position], label: optById[row.id]?.label ?? row.label, count: row.votes, share: row.pct, rank: i + 1 })),
    report_meta: { public_report_enabled: !!test.share_enabled, public_report_url: test.share_enabled && test.share_token ? `${SITE}/r/${test.share_token}` : null, export_generated_at: new Date().toISOString() },
  };
  if (scope === "summary") return pkg;

  // standard adds audience qualification
  const screen = await screeningStats(testId);
  pkg.audience = {
    screening_enabled: screen.enabled,
    qualified_judgments: screen.enabled ? screen.qualified : null,
    disqualified_responses: screen.enabled ? screen.disqualified : null,
    qualification_rate: screen.enabled ? screen.rate : null,
    audience_fit: screen.fit,
    target_audience: test.target_audience ?? null,
  };
  if (scope === "standard") return pkg;

  // scale adds source quality + collection links + project context (owner/internal)
  const [sources, links] = await Promise.all([testSourceQuality(testId), collectionLinkSummaries(testId)]);
  pkg.source_quality = sources.map((s) => ({ source: s.source, label: s.label, total_responses: s.total, valid_judgments: s.valid, filtered_responses: s.filtered, filter_rate: s.filterRate, clean_signal_percent: s.total ? Math.round((s.valid / s.total) * 100) : 0 }));
  pkg.collection_links = links;
  if (test.project_id) {
    let name: string | null = null;
    try { const { data } = await getSupabaseAdminClient().from("v_projects" as never).select("name").eq("id", test.project_id).maybeSingle(); name = (data as unknown as { name: string } | null)?.name ?? null; } catch { /* ignore */ }
    pkg.project = { project_id: test.project_id, project_name: name };
  }
  return pkg;
}

// A deterministic, clearly-labeled SAMPLE compact package for the webhook test
// console and docs — no real evaluation, no real people, no credits.
export const SAMPLE_DECISION_PACKAGE = {
  schema_version: DECISION_PACKAGE_VERSION,
  mode: "sandbox" as const,
  test_id: "sandbox_example",
  recommended_output: "B",
  winner_label: "Hero B (sample)",
  preference_margin: 24,
  directional_confidence: "Strong",
  signal_quality: "Clean signal",
  evaluation_health: "Ready to decide",
  action_recommendation: "Ship Option B.",
  valid_judgments: 120,
  filtered_responses: 11,
  qualified_judgments: 98,
  audience_fit: "Strong fit",
  source_quality: [
    { source: "instagram", valid_judgments: 70, filter_rate: 8 },
    { source: "discord", valid_judgments: 50, filter_rate: 14 },
  ],
};
