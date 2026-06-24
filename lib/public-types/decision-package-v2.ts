// Vraelis Decision Package v2 — public TypeScript types for API/export/webhook
// consumers. These mirror /schemas/decision-package-v2.json. Copy into your own
// project (or import if you vendor this file). No private/internal fields.

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
