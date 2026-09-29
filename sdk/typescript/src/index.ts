// @vraelis/sdk: the official TypeScript SDK for Vraelis verification. Vraelis checks what a coding agent
// says it built, on the deployed app in a real browser, and returns verified, failed or blocked with
// evidence. A person approves each plan before it runs; an API key cannot.
export { Vraelis } from "./client";
export type { VraelisOptions } from "./client";
export { VraelisAPIError } from "./errors";
export { verifyWebhookSignature } from "./webhooks";
export type { VerifyWebhookOptions, VraelisWebhookEvent } from "./webhooks";
export type {
  CreditsResult,
  PrepareVerificationInput,
  RunVerificationInput,
  RecheckVerificationInput,
  VerificationRequestOptions,
  WaitOptions,
  VerificationPlan,
  VerificationPlanFlow,
  VerificationPlanStatus,
  VerificationRunning,
  VerificationCompleted,
  VerificationResult,
  VerificationDecision,
  VerificationFailure,
  VerificationEvidence,
} from "./types";
