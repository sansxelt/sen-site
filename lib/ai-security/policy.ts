import { createHash } from "node:crypto";
import { z } from "zod";

/** Private policy-decision core. It does not authenticate callers or execute actions.
 * Context MUST come from trusted credential/attestation adapters, never the AI or
 * request body. The current test harness supplies synthetic context only.
 */
const id = z.string().min(1).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const time = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const duration = time.min(1).max(3_600_000);
const actions = ["telemetry.read", "data.export", "model.deploy", "device.command"] as const;
const action = z.enum(actions);
const ruleSchema = z.strictObject({
  id, principalId: id, environmentId: id, resourceId: id, action,
  modelSha256: digest, requiresApproval: z.boolean(),
}).refine(r => r.action === "telemetry.read" || r.requiresApproval, {
  message: "Export, deployment and command rules must require separate human approval.",
});
const policySchema = z.strictObject({
  schemaVersion: z.literal(1), policyId: id, version: id,
  trustedIssuers: z.array(id).min(1).max(20),
  approvalRoles: z.array(id).min(1).max(20),
  maxSessionAgeMs: duration, maxPostureAgeMs: duration, maxApprovalAgeMs: duration,
  rules: z.array(ruleSchema).max(100),
}).refine(p => new Set(p.rules.map(r => r.id)).size === p.rules.length, {
  message: "Policy rule IDs must be unique.",
});
const proposalSchema = z.strictObject({
  schemaVersion: z.literal(1), requestId: id, principalId: id, sessionId: id,
  environmentId: id, resourceId: id, action, modelSha256: digest,
  payloadSha256: digest,
});
const principalSchema = z.strictObject({
  principalId: id, sessionId: id, environmentId: id, issuer: id,
  issuedAtMs: time, expiresAtMs: time, revoked: z.boolean(),
});
const postureSchema = z.strictObject({
  principalId: id, environmentId: id, observedAtMs: time,
  status: z.enum(["healthy", "compromised", "unknown"]), modelSha256: digest,
  artifactVerified: z.boolean(),
});
const approvalSchema = z.strictObject({
  approvalId: id, approverId: id, approverRole: id, issuer: id,
  approverKind: z.enum(["human", "workload"]),
  proposalSha256: digest, policySha256: digest,
  issuedAtMs: time, expiresAtMs: time, revoked: z.boolean(), consumed: z.boolean(),
});
const contextSchema = z.strictObject({
  nowMs: time,
  principal: principalSchema.nullable(),
  posture: postureSchema.nullable(),
  approval: approvalSchema.nullable(),
});

export type AiSecurityPolicy = z.infer<typeof policySchema>;
export type AiActionProposal = z.infer<typeof proposalSchema>;
export type TrustedSecurityContext = z.infer<typeof contextSchema>;
export type SecurityCheck = {
  code: string; outcome: "satisfied" | "denied"; detail: string;
};
export type SecurityDecision = {
  evaluatorVersion: "ai-security-policy-1";
  decision: "permit" | "deny";
  checks: SecurityCheck[];
  binding: {
    requestId: string | null; policyId: string | null; policyVersion: string | null;
    proposalSha256: string | null; policySha256: string | null;
    evaluatedAtMs: number | null; approvalId: string | null;
  };
};

// Schema parsing gives fixed property order and rejects additional privileges.
function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function proposalSha256(value: unknown): string {
  return hash(proposalSchema.parse(value));
}
export function policySha256(value: unknown): string {
  return hash(policySchema.parse(value));
}

/** Every invocation re-evaluates identity, scope, posture and approval. No trust
 * is inferred from network location, model confidence or a previous permit.
 * A permit is bound to exact proposal/policy digests; it is NOT an executable
 * token. A future enforcement adapter must recheck and atomically consume
 * approvals immediately before dispatch, using the same exact payload bytes.
 */
export function evaluateAiAction(
  policyInput: unknown, proposalInput: unknown, trustedContextInput: unknown,
): SecurityDecision {
  const p = policySchema.safeParse(policyInput);
  const r = proposalSchema.safeParse(proposalInput);
  const c = contextSchema.safeParse(trustedContextInput);
  const checks: SecurityCheck[] = [];
  const check = (code: string, satisfied: boolean, detail: string) => {
    checks.push({ code, outcome: satisfied ? "satisfied" : "denied", detail });
  };
  check("policy_schema", p.success, p.success ? "A supported explicit policy was supplied." : "Policy is missing or invalid.");
  check("proposal_schema", r.success, r.success ? "An exact supported action was proposed." : "Proposal is missing, invalid or contains unsupported fields.");
  check("context_schema", c.success, c.success ? "Trusted-adapter context has the required structure." : "Trusted-adapter context is missing or invalid.");
  const binding: SecurityDecision["binding"] = {
    requestId: r.success ? r.data.requestId : null,
    policyId: p.success ? p.data.policyId : null,
    policyVersion: p.success ? p.data.version : null,
    proposalSha256: r.success ? hash(r.data) : null,
    policySha256: p.success ? hash(p.data) : null,
    evaluatedAtMs: c.success ? c.data.nowMs : null,
    approvalId: c.success ? c.data.approval?.approvalId ?? null : null,
  };
  const result = (): SecurityDecision => ({
    evaluatorVersion: "ai-security-policy-1",
    decision: checks.some(x => x.outcome === "denied") ? "deny" : "permit",
    checks, binding,
  });
  if (!p.success || !r.success || !c.success) return result();

  const policy = p.data, request = r.data;
  const { principal, posture, approval, nowMs } = c.data;
  const current = (issued: number, expires: number, maxAge: number) =>
    issued <= nowMs && expires > nowMs && expires > issued && nowMs - issued <= maxAge;
  check("identity", !!principal &&
    principal.principalId === request.principalId && principal.sessionId === request.sessionId &&
    principal.environmentId === request.environmentId && policy.trustedIssuers.includes(principal.issuer) &&
    !principal.revoked && current(principal.issuedAtMs, principal.expiresAtMs, policy.maxSessionAgeMs),
  "Identity must be independently authenticated, current, unrevoked and bound to this session and environment.");

  check("posture", !!posture && posture.principalId === request.principalId &&
    posture.environmentId === request.environmentId && posture.status === "healthy" &&
    posture.observedAtMs <= nowMs && nowMs - posture.observedAtMs <= policy.maxPostureAgeMs,
  "A fresh trusted observation must establish a healthy workload in this environment.");
  check("artifact", !!posture && posture.artifactVerified && posture.modelSha256 === request.modelSha256,
    "The observed model artifact must be verified and match the proposed model digest.");

  const matches = policy.rules.filter(rule =>
    rule.principalId === request.principalId && rule.environmentId === request.environmentId &&
    rule.resourceId === request.resourceId && rule.action === request.action &&
    rule.modelSha256 === request.modelSha256);
  check("scope", matches.length === 1,
    "Exactly one explicit rule must grant this principal, model, environment, action and resource. No wildcard or inferred grants apply.");
  const rule = matches.length === 1 ? matches[0] : undefined;
  if (rule?.requiresApproval) {
    check("approval", !!approval && approval.approverKind === "human" && approval.approverId !== request.principalId &&
      policy.approvalRoles.includes(approval.approverRole) && policy.trustedIssuers.includes(approval.issuer) &&
      approval.proposalSha256 === binding.proposalSha256 && approval.policySha256 === binding.policySha256 &&
      !approval.revoked && !approval.consumed &&
      current(approval.issuedAtMs, approval.expiresAtMs, policy.maxApprovalAgeMs),
    "A separate authenticated human must approve this exact proposal and policy. Expired, revoked or consumed approvals deny access.");
  }
  return result();
}
