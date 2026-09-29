# Changelog

## 0.3.0

Vraelis is now one product: it checks what a coding agent says it built, on the deployed app in a real browser, and returns verified, failed or blocked. This release matches the SDK to that API.

### Breaking

- Removed `verifications.approvePlan()`. Only a signed-in person approves a plan, in the browser at the plan's `approve_url`. The API now refuses approval with an API key (403 `plan_requires_human`), so the agent that did the work never signs off on the check. Use `waitForApproval()` to wait for the person instead.
- Removed `evaluations.create()`, `evaluations.get()`, `evaluations.exportJson()` and `evaluations.exportCsv()`, with every Decision Package and evaluation type. The human evaluation API (`/api/v1/tests`) was retired and no longer exists.
- `VerificationDecision` is now lowercase, `"verified" | "failed" | "blocked"`, matching what the API returns. Code that compared against `"Verified"`, `"Failed"` or `"Blocked"` never matched and must change.
- `VraelisWebhookEvent` is now the `verification.completed` payload (`run_id`, `decision`, `flows_total`, `flows_passed`, `deployment_url`, `completed_at`, `report_url`). The `test.completed` shape is gone.
- Removed the `VerificationPlanApproval` type.

### Added

- `verifications.getPlan(id)` reads a plan and whether a person has approved it.
- `verifications.waitForApproval(id, { timeoutMs, intervalMs, signal })` polls until the plan is approved. It rejects if the plan expires, was already used by a run, or the timeout passes.
- `verifications.waitForResult(id, { timeoutMs, intervalMs, signal })` polls until the verification finishes and returns the decision and evidence. Network errors, 429 and 5xx responses are retried until the timeout.
- `verifications.recheck(id, { deployment_url }, { idempotencyKey })` runs the same person-approved plan again after a fix, without a new approval, within 24 hours of the approval and up to 10 times.
- `approve_url` on `VerificationPlan`, the `VerificationPlanStatus`, `VerificationPlanFlow`, `RecheckVerificationInput` and `WaitOptions` types, the re-check fields on `VerificationRunning`, and `recheck_of` on `VerificationCompleted`.
- `VraelisAPIError.body` holds the full error response, so callers can read `repair_prompt` from `claim_not_provable` or `approve_url` from `plan_requires_human`.

### Removed from the package scripts

- `check:schema` and `test:integration`, which exercised the retired evaluation API. `test:runtime` now runs the whole verification loop against a local mock.

## 0.2.0

- Prepare an immutable verification plan for review
- Approve the reviewed plan as a distinct event
- Launch exactly the approved plan with idempotent retries
- Read running or completed verification results with evidence and repair guidance

## 0.1.0

Initial SDK starter.

- Typed Vraelis client
- Sandbox evaluation creation
- Evaluation get/export helpers
- Decision Package v2 types
- Webhook signature verification
- API error handling
