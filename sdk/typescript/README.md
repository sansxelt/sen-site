# @vraelis/sdk

The TypeScript SDK for [Vraelis](https://vraelis.com).

Vraelis checks what a coding agent says it built. It opens the deployed app in a real browser, runs a plan that a person approved, and returns `verified`, `failed` or `blocked`, with the evidence behind it.

> **Status:** this package lives in the Vraelis repository and is **not published to npm yet** (`"private": true`). Build it locally as shown below. Once it is published, install it with `npm install @vraelis/sdk`.

## Install

```bash
# from the Vraelis repo
cd sdk/typescript
npm install
npm run build      # writes dist/: ESM (index.js), CommonJS (index.cjs) and types (index.d.ts)
```

Import from the built `dist/`, or copy the package into your project. It works from ESM and CommonJS:

```ts
import { Vraelis } from "@vraelis/sdk";          // ESM
```
```js
const { Vraelis } = require("@vraelis/sdk");     // CommonJS
```

Requires Node 18 or newer (it uses the global `fetch` and the `crypto` module). On older Node, pass a `fetch` implementation in the client options.

Create an API key at <https://app.vraelis.com/developers> with **Launch runs** access. Keep it on the server.

## How a verification works

1. **Prepare.** Send the deployed URL and the claim. Vraelis builds the requirements and browser flows that would prove it. Nothing runs and nothing is charged. You get back a `reviewed_plan_id` and an `approve_url`.
2. **A person approves.** Show the person the `approve_url`. They open it, signed in to Vraelis, read the plan, and approve it. **An API key cannot approve a plan.** The API refuses it with 403 `plan_requires_human`, and this SDK has no method for it. The agent that did the work never signs off on the check.
3. **Wait for approval** with `waitForApproval()`.
4. **Run** exactly the approved plan with `run()`.
5. **Wait for the decision** with `waitForResult()`.
6. **On `failed`**, fix the code and redeploy, then `recheck()` the same approved plan and `waitForResult()` again. No new approval is needed for a re-check.

## Quickstart

```ts
import { randomUUID } from "node:crypto";
import { Vraelis } from "@vraelis/sdk";

const vraelis = new Vraelis({ apiKey: process.env.VRAELIS_API_KEY! });

const input = {
  deployment_url: "https://app.example.com",
  claim: "A signed-in customer can upgrade to Pro and still has Pro after signing out and back in.",
};

// 1. Build the plan. Nothing runs and nothing is charged.
const plan = await vraelis.verifications.prepare(input, { idempotencyKey: randomUUID() });
if (!plan.reviewed_plan_id || !plan.approve_url) throw new Error(plan.message);

// 2. Hand the link to a person. Only they can approve the plan.
console.log(`Approve the plan here: ${plan.approve_url}`);

// 3. Wait until they approve it (polls every 3 seconds, gives up after 15 minutes by default).
await vraelis.verifications.waitForApproval(plan.reviewed_plan_id);

// 4. Run exactly the approved plan. Send the same deployment_url and claim.
const run = await vraelis.verifications.run({ ...input, reviewed_plan_id: plan.reviewed_plan_id });

// 5. Wait for the decision (polls every 5 seconds, gives up after 15 minutes by default).
let result = await vraelis.verifications.waitForResult(run.verification_id);

// 6. Failed: give result.repair_prompt to the coding agent, let it fix and redeploy, then re-check.
while (result.decision === "failed") {
  await fixAndRedeploy(result.repair_prompt); // your code
  const again = await vraelis.verifications.recheck(result.verification_id);
  result = await vraelis.verifications.waitForResult(again.verification_id);
}

console.log(result.decision, result.console_url);
```

`examples/verify-and-recheck.ts` is a runnable version of this loop.

## Decisions

| `decision` | Meaning | What to do |
| --- | --- | --- |
| `verified` | The claim held, with evidence. | Ship. |
| `failed` | The claim did not hold. `failures` says what was expected and what happened, and `repair_prompt` is text to hand back to the coding agent. | Fix, redeploy, `recheck()`. |
| `blocked` | No verdict was reached. The app could not be exercised, or the result needs a person to look. | Open `console_url` and read why. |

A completed result also carries `claim`, `requirements`, `evidence` (one entry per flow, with the step it failed at), `human_reviewed`, `reviewed_by`, `reviewed_at` and, for a re-check, `recheck_of`.

## Re-checks

`recheck(verificationId)` runs the same plan the person approved again, against the same site, and returns a new verification id. The earlier verification is never changed. The rules:

- It runs within **24 hours** of the approval, and at most **10 times** per approval. The response tells you `rechecks_left` and `recheck_window_ends_at`.
- It runs every flow of the plan, not only the ones that failed.
- It may target a different URL through `{ deployment_url }` only on the **same origin** the plan was approved for. For a different site, start a new verification.
- Each re-check is a normal paid verification, so balance and spend limits apply.

When a re-check is refused, it throws a `VraelisAPIError` with one of these codes:

| Code | Status | Meaning |
| --- | --- | --- |
| `verification_running` | 409 | The verification has not finished yet. Wait for it first. |
| `guarantee_verification` | 409 | It proves a guarantee. Verify the guarantee again instead. |
| `recheck_not_available` | 409 | There is no approved plan behind it to run again. Start a new verification. |
| `plan_requires_human` | 403 | No person approved the plan behind it. Start a new verification and have a person approve it. |
| `recheck_origin_changed` | 409 | `deployment_url` is on a different origin from the approved one. |
| `recheck_window_closed` | 409 | The approval is more than 24 hours old. Start a new verification. |
| `recheck_limit_reached` | 409 | This approval has been re-checked 10 times. Start a new verification. |

The usual spend refusals also apply: 402 when the balance is too low, 429 when a limit is reached (see the `Retry-After` header), and 503 when new runs are paused or Vraelis is at capacity.

## Methods

| Method | Description |
| --- | --- |
| `verifications.prepare(input, { idempotencyKey })` | Build the plan for a person to approve. Returns `approve_url`. Does not run or charge. |
| `verifications.getPlan(reviewedPlanId)` | Read the plan: its requirements and flows, and whether it is approved, used or expired. |
| `verifications.waitForApproval(reviewedPlanId, { timeoutMs, intervalMs, signal })` | Poll until a person approves the plan. |
| `verifications.run(input, { idempotencyKey })` | Run exactly the approved plan. `input` is the prepare input plus `reviewed_plan_id`. |
| `verifications.get(verificationId)` | Read a running verification, or its decision and evidence. |
| `verifications.waitForResult(verificationId, { timeoutMs, intervalMs, signal })` | Poll until the verification finishes. |
| `verifications.recheck(verificationId, { deployment_url }, { idempotencyKey })` | Run the same approved plan again after a fix. |
| `credits.get()` | The account's credit balance. |
| `webhooks.verifySignature(opts)` | Verify a webhook delivery's signature. Same as `verifyWebhookSignature`. |

### Waiting

`waitForApproval` and `waitForResult` take the same options:

| Option | Default | |
| --- | --- | --- |
| `timeoutMs` | 15 minutes | Reject with an `Error` if the wait is still going after this long. |
| `intervalMs` | 3000 ms for approval, 5000 ms for results | Time between reads. |
| `signal` | none | An `AbortSignal`. Aborting rejects with the signal's reason. |

`waitForApproval` also rejects when the plan has expired (see `reviewed_plan_expires_at` on the prepared plan; an expired plan cannot run even if approved), or when it was already used by a run (the message names that run's verification id). `waitForResult` rejecting on timeout does not stop the verification: it keeps running on Vraelis, and you can wait again or call `get()`. Both helpers retry network errors, 429 and 5xx responses until the timeout, and stop at once on any other API error.

## Errors

Every non-2xx response throws a `VraelisAPIError`:

```ts
import { VraelisAPIError } from "@vraelis/sdk";

try {
  await vraelis.verifications.prepare(input);
} catch (err) {
  if (err instanceof VraelisAPIError) {
    console.error(err.status, err.code, err.message, err.requestId);
    if (err.code === "claim_not_provable") {
      // Vraelis could not build a check that proves this claim. Nothing ran and nothing was charged.
      const body = err.body as { remaining_obligations?: string[]; repair_prompt?: string | null };
      console.error(body.remaining_obligations, body.repair_prompt);
    }
  }
}
```

`err.body` is the full parsed response, for refusals that carry more than a code and a message. For example, `claim_not_provable` (422) includes `requirements`, `remaining_obligations` and `repair_prompt`.

## Webhooks

When a verification finishes, Vraelis sends a signed `verification.completed` POST to your webhook endpoints:

```json
{
  "event": "verification.completed",
  "run_id": "...",
  "application_id": "...",
  "decision": "verified",
  "flows_total": 5,
  "flows_passed": 5,
  "deployment_url": "https://app.example.com",
  "completed_at": "2026-09-28T12:00:00.000Z",
  "report_url": "https://app.vraelis.com/systems/.../passes/..."
}
```

`decision` is `verified`, `failed` or `blocked`. `run_id` is the raw run id; the SDK and API call the same verification `vrf_` followed by `run_id`. A sample sent from the dashboard has `test_event: true`.

Each delivery is signed:

```
X-Vraelis-Signature: sha256=HMAC_SHA256(secret, `${timestamp}.${rawBody}`)
X-Vraelis-Timestamp: <unix seconds>
```

Always verify against the **raw request body**, read before parsing JSON:

```ts
import { verifyWebhookSignature, type VraelisWebhookEvent } from "@vraelis/sdk";

export async function POST(req: Request) {
  const raw = await req.text();
  const ok = verifyWebhookSignature({
    payload: raw,
    signature: req.headers.get("x-vraelis-signature"),
    timestamp: req.headers.get("x-vraelis-timestamp"),
    secret: process.env.VRAELIS_WEBHOOK_SECRET!,
    toleranceSeconds: 300, // optional replay protection
  });
  if (!ok) return new Response("invalid signature", { status: 401 });

  const event = JSON.parse(raw) as VraelisWebhookEvent;
  console.log(`vrf_${event.run_id}`, event.decision, `${event.flows_passed}/${event.flows_total}`);
  return new Response("ok");
}
```

`verifyWebhookSignature` returns `false`, and never throws, for a missing or malformed signature, or, when `toleranceSeconds` is set, a stale timestamp. `examples/webhook-nextjs.ts` has this handler and an Express version.

## The command line and coding assistants

The same verification runs from a terminal or CI with the `vraelis` command:

```bash
curl -fsS https://vraelis.com/install | sh           # macOS and Linux
irm https://vraelis.com/install.ps1 | iex            # Windows PowerShell
```

`vraelis init` connects a coding assistant (Claude Code, Codex, Gemini CLI, Copilot, Cursor) to Vraelis over MCP, so the assistant can ask for a verification of what it built. The same rule holds there: the assistant hands the person the approve link and waits.

## Environment variables

```bash
VRAELIS_API_KEY=vr_live_...          # server-side only, never ship it to a browser
VRAELIS_WEBHOOK_SECRET=whsec_...     # your endpoint's signing secret
```

## Development

```bash
npm run typecheck      # tsc over src/
npm run build          # dist/ with ESM, CommonJS and types
npm run test:runtime   # smoke test: the built package, the whole loop against a local mock, and the packed file list
```

## Before publishing

This package is **not published to npm yet** (`"private": true`). When it is ready:

- [ ] Confirm the npm scope `@vraelis` exists and is owned, and `npm login`
- [ ] Confirm the package name `@vraelis/sdk`
- [ ] Set `"private"` to `false` in `package.json`
- [ ] Run `npm run typecheck`
- [ ] Run `npm run build`
- [ ] Run `npm run test:runtime`
- [ ] Run `npm pack --dry-run` and confirm only `dist/`, `README.md`, `LICENSE`, `CHANGELOG.md` and `package.json` ship
- [ ] Confirm no secrets or source-only files are included
- [ ] Publish only with explicit approval

License: MIT (see `LICENSE`).
