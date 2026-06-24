// @vraelis/sdk — official TypeScript SDK for the Vraelis human-evaluation API.
export { Vraelis } from "./client";
export type { VraelisOptions } from "./client";
export { VraelisAPIError } from "./errors";
export { verifyWebhookSignature } from "./webhooks";
export type { VerifyWebhookOptions, VraelisWebhookEvent } from "./webhooks";
export type {
  DecisionPackageV2,
  DecisionConfidence,
  SignalQuality,
  EvaluationHealth,
  AudienceFit,
  ReadinessLabel,
  FollowupType,
  DecisionOption,
  SourceQualityBreakdown,
  CollectionLinkStat,
  ExportTier,
  EvaluationOptionInput,
  CreateEvaluationInput,
  EvaluationCreateResult,
  EvaluationResult,
  EvaluationExport,
  CreditsResult,
} from "./types";
