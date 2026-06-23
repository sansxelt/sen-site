# @vraelis/sdk

Official TypeScript SDK for the [Vraelis](https://vraelis.com) human-evaluation API — create sandbox evaluations, fetch **Decision Package v2** results, export JSON/CSV, and verify signed webhooks.

> **Status: SDK starter.** This package is included in the Vraelis repository and ready for npm publishing later. It is **not published to npm yet** — use it locally (see below). When published, install with `npm install @vraelis/sdk`.

## Install

**Not yet on npm.** For now, use it locally:

```bash
# from the Vraelis repo
cd sdk/typescript
npm install
npm run build      # emits dist/ — ESM (index.js) + CJS (index.cjs) + types (index.d.ts)
```

Then import from the built `dist/`, or copy the package into your project. Once published:

```bash
npm install @vraelis/sdk   # future — not on npm yet
```

Works in both ESM and CommonJS:

```ts
import { Vraelis } from "@vraelis/sdk";          // ESM
```
```js
const { Vraelis } = require("@vraelis/sdk");     // CommonJS
```

Requires Node 18+ (uses the global `fetch` and the `crypto` module). On older Node, pass a `fetch` implementation in the client options.

## Quickstart

```ts
import { Vraelis } from "@vraelis/sdk";

const vraelis = new Vraelis({ apiKey: process.env.VRAELIS_API_KEY! });

// Sandbox: sample decision package, no credits, no quota.
const evaluation = await vraelis.evaluations.create({
  title: "Sandbox hero test",
  category: "landing",
  sandbox: true,
  options: [{ label: "Hero A" }, { label: "Hero B" }],
});

const result = await vraelis.evaluations.get(evaluation.id);
console.log(result.decision_package?.decision.recommended_output);
```

Sandbox evaluations **charge 0 credits and use 0 quota**, return a sample Decision Package, and never appear in production analytics — ideal for building and testing your integration.

## Production quickstart

Drop `sandbox` and add `votes` + real candidates to launch a real evaluation backed by qualified human signal:

```ts
const evaluation = await vraelis.evaluations.create({
  title: "Landing hero — Q3",
  category: "landing",
  votes: 200,
  options: [
    { image_url: "https://cdn.you/hero-a.jpg" },
    { image_url: "https://cdn.you/hero-b.jpg" },
  ],
});
// { id, status: "active", credits_charged: 200 }

// Poll until complete, or receive a signed test.completed webhook (see below).
const result = await vraelis.evaluations.get(evaluation.id);

// Current credit balance
const credits = await vraelis.credits.get();
```

## Methods

| Method | Description |
| --- | --- |
| `evaluations.create(input)` | Create + launch an evaluation (`sandbox: true` for test mode). |
| `evaluations.get(id)` | Status, results, and the Decision Package v2. |
| `evaluations.exportJson(id, { tier })` | Export JSON; tiers `summary` \| `standard` \| `scale`. |
| `evaluations.exportCsv(id)` | Per-option breakdown as a CSV string. |
| `credits.get()` | Current credit balance. |
| `webhooks.verifySignature(opts)` | Verify a webhook delivery's HMAC signature. |

Option inputs accept `{ image_url }`, `{ text }`, or `{ label }` (an alias for `text`).

## Decision Package

`get()` and `exportJson()` return a typed `DecisionPackageV2` (`decision_package`), mirroring [`/schemas/decision-package-v2.json`](https://vraelis.com/schemas/decision-package-v2.json):

```ts
import type { DecisionPackageV2 } from "@vraelis/sdk";

const dp: DecisionPackageV2 | null = result.decision_package;
dp?.decision.recommended_output;       // "A" | "B" | … | null
dp?.decision.directional_confidence;   // "Strong" | "Moderate" | "Tentative" | "None"
dp?.decision.evaluation_health;        // "Ready to decide" | …
dp?.audience?.audience_fit;            // "Strong fit" | …  (standard+ tiers)
dp?.source_quality;                    // per-channel quality (scale tier)
dp?.mode;                              // "production" | "sandbox"
```

Exported types: `DecisionPackageV2`, `DecisionConfidence`, `SignalQuality`, `EvaluationHealth`, `AudienceFit`, `SourceQualityBreakdown`, `CollectionLinkStat`, `DecisionOption`.

## Export

```ts
const full = await vraelis.evaluations.exportJson(id, { tier: "scale" });
console.log(full.decision_package?.source_quality);

const csv = await vraelis.evaluations.exportCsv(id); // "test_id,title,status,category,option,…"
```

## Webhook verification

Vraelis signs each delivery:

```
X-Vraelis-Signature: sha256=HMAC_SHA256(secret, `${timestamp}.${rawBody}`)
X-Vraelis-Timestamp: <unix seconds>
```

Always verify against the **raw request body** (read it before parsing JSON):

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
  // event.decision_package, event.mode ("sandbox" for test sends), …
  return new Response("ok");
}
```

`verifySignature` returns `false` (never throws) for a missing/malformed signature or — when `toleranceSeconds` is set — a stale timestamp. See `examples/webhook-nextjs.ts` for the Express variant.

## Error handling

Non-2xx responses throw a `VraelisAPIError` parsed from the API error envelope:

```ts
import { VraelisAPIError } from "@vraelis/sdk";

try {
  await vraelis.evaluations.get("missing");
} catch (err) {
  if (err instanceof VraelisAPIError) {
    console.error(err.status, err.code, err.message, err.requestId);
    // e.g. 404 not_found "No evaluation with that id." req_…
  }
}
```

## Environment variables

```bash
VRAELIS_API_KEY=vr_live_…          # server-side only, never ship to the client
VRAELIS_WEBHOOK_SECRET=whsec_…     # your endpoint's signing secret
```

## Before publishing

This package is **not published to npm yet** (`"private": true`). When ready:

- [ ] Confirm the npm scope `@vraelis` (exists / owned) and `npm login`
- [ ] Confirm the package name `@vraelis/sdk`
- [ ] Flip `"private"` to `false` in `package.json`
- [ ] Run `npm run typecheck`
- [ ] Run `npm run build`
- [ ] Run `npm run check:exports` (package smoke tests)
- [ ] Run `npm run check:schema` (type/schema drift)
- [ ] Run `npm run test:integration` (live sandbox test, if `VRAELIS_API_KEY` is set)
- [ ] Run `npm pack --dry-run` and confirm only `dist/`, `README.md`, `LICENSE`, `CHANGELOG.md`, `package.json` ship
- [ ] Confirm no secrets or source-only files are included
- [ ] Publish with explicit approval only

License: MIT (see `LICENSE`).
