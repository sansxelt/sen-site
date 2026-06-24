// Public types for the Vraelis SDK. The Decision Package v2 types mirror
// https://vraelis.com/schemas/decision-package-v2.json and the API/export payloads.
// Kept in sync with lib/public-types/decision-package-v2.ts in the main repo.

export type DecisionConfidence = "Strong" | "Moderate" | "Tentative" | "None";
export type SignalQuality = "Clean signal" | "Limited signal" | "Needs more signal";
export type EvaluationHealth =
  | "Collecting"
  | "Ready to decide"
  | "Needs more judgments"
  | "Noisy signal"
  | "Too close to call"
  | "Low-quality traffic";
export type AudienceFit = "Strong fit" | "Mixed fit" | "Limited fit" | "Not screened";
export type ReadinessLabel =
  | "Strong recommendation"
  | "Ready to decide"
  | "Directional signal"
  | "Needs more judgments"
  | "Too close to call"
  | "Noisy signal"
  | "Audience mismatch"
  | "Collecting judgments";
export type FollowupType = "top_up" | "retest_top_two" | "cleaner_audience" | "confirm_recommendation" | "narrow_audience";

export interface DecisionOption {
  option_id: string;
  option?: string; // display letter, e.g. "A"
  label: string | null;
  count: number;
  share: number; // percent of valid judgments
  rank: number;
}

export interface SourceQualityBreakdown {
  source: string;
  label?: string;
  total_responses: number;
  valid_judgments: number;
  filtered_responses: number;
  filter_rate: number;
  clean_signal_percent: number;
}

export interface CollectionLinkStat {
  collection_link_id: string;
  label: string;
  source: string;
  is_active: boolean;
  valid_judgments: number;
  filtered_responses: number;
  filter_rate: number;
}

export interface DecisionPackageV2 {
  schema_version: "v2";
  mode: "production" | "sandbox";
  test_id: string;
  title?: string;
  status?: "draft" | "active" | "complete" | "canceled";
  category?: string;
  created_at?: string;
  completed_at?: string | null;
  decision: {
    recommended_output: string | null;
    winner_option_id: string | null;
    winner_label: string | null;
    preference_margin: number | null;
    directional_confidence: DecisionConfidence;
    signal_quality: SignalQuality | null;
    evaluation_health: EvaluationHealth;
    /** Decision readiness — whether the result is ready to act on. Additive (v2). */
    readiness_label?: ReadinessLabel | null;
    readiness_reason?: string | null;
    recommended_next_step?: string | null;
    /** Suggested confirmation round when the result isn't ready. Additive (v2). */
    followup_recommended?: boolean | null;
    followup_type?: FollowupType | null;
    followup_reason?: string | null;
    followup_action_label?: string | null;
    action_recommendation: string | null;
    decision_summary: string | null;
    inconclusive: boolean | null;
  };
  counts: {
    valid_judgments: number;
    filtered_responses: number;
    total_responses: number;
    filter_rate: number;
  };
  options: DecisionOption[];
  audience?: {
    screening_enabled: boolean;
    qualified_judgments: number | null;
    disqualified_responses: number | null;
    qualification_rate: number | null;
    audience_fit: AudienceFit;
    target_audience: string | null;
  };
  source_quality?: SourceQualityBreakdown[];
  collection_links?: CollectionLinkStat[];
  project?: { project_id: string; project_name: string | null };
  report_meta?: {
    public_report_enabled: boolean;
    public_report_url: string | null;
    export_generated_at: string;
  };
}

// ── Request / response shapes ──
export type ExportTier = "summary" | "standard" | "scale";

export interface EvaluationOptionInput {
  /** Public image URL for an image candidate. */
  image_url?: string;
  /** Text candidate (headline, brand name, …). */
  text?: string;
  /** Alias for `text` — convenience, normalized to `text` before sending. */
  label?: string;
}

export interface CreateEvaluationInput {
  title?: string;
  category?: string;
  audience?: string;
  /** Number of qualified judgments to collect (production only). */
  votes?: number;
  /** Create a sandbox evaluation: sample decision package, no credits, no quota. */
  sandbox?: boolean;
  /** File the evaluation under one of your projects. */
  project_id?: string;
  options: EvaluationOptionInput[];
}

export interface EvaluationCreateResult {
  id: string;
  status: string;
  sandbox?: boolean;
  mode?: "sandbox" | "production";
  credits_charged: number;
  note?: string;
}

export interface EvaluationResult {
  id: string;
  status: string;
  votes_valid: number;
  votes_target: number;
  results: unknown;
  decision_package: DecisionPackageV2 | null;
}

export interface EvaluationExport {
  schema_version: string;
  tier?: string;
  test_id: string;
  decision_package: DecisionPackageV2 | null;
  [key: string]: unknown;
}

export interface CreditsResult {
  [key: string]: unknown;
}
