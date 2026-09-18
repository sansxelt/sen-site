// Published-package smoke test: simulates what an npm consumer gets.
// Builds (via prepack/build beforehand), then: ESM import, CJS require, exported
// symbols, an offline webhook-signature check, and `npm pack --dry-run` to confirm
// ONLY safe files ship (no src, scripts, env, secrets, or build config).
import { createRequire } from "module";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { createHmac } from "crypto";

const require = createRequire(import.meta.url);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  PASS  " + m); } else { fail++; console.log("  FAIL  " + m); } };
const u = (p) => new URL(p, import.meta.url);

console.log("[dist present]");
for (const f of ["../dist/index.js", "../dist/index.cjs", "../dist/index.d.ts"]) ok(existsSync(u(f)), `dist file ${f.replace("../", "")}`);

console.log("\n[ESM import]");
const esm = await import(u("../dist/index.js"));
ok(typeof esm.Vraelis === "function", "ESM: Vraelis exported");
ok(typeof esm.VraelisAPIError === "function", "ESM: VraelisAPIError exported");
ok(typeof esm.verifyWebhookSignature === "function", "ESM: verifyWebhookSignature exported");

console.log("\n[verification workflow — offline]");
const calls = [];
const responses = [
  { state: "review_required", reviewed_plan_id: "rvp_test", requirements: ["Access persists"], human_reviewed: false, review_required: true, claim: "Access persists after sign-in", contract_id: "ctr_test", contract_version: 1, message: "Review required" },
  { reviewed_plan_id: "rvp_test", approval_state: "approved", already_approved: false },
  { verification_id: "vrf_test", state: "running", status_url: "/v1/verifications/vrf_test", human_reviewed: true },
  { verification_id: "vrf_test", state: "completed", decision: "Verified", requirements: ["Access persists"], failures: [], evidence: [], repair_prompt: null, console_url: "https://app.vraelis.com/systems/test/passes/test", human_reviewed: true, decision_status: "current", contract_review_status: "human_reviewed", requirement_order: "reviewed_plan", claim: "Access persists after sign-in" },
];
const client = new esm.Vraelis({
  apiKey: "vr_live_smoke",
  baseUrl: "https://sdk.test",
  fetch: async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(responses.shift()), { status: 200, headers: { "content-type": "application/json" } });
  },
});
const verificationInput = { deployment_url: "https://app.example.com", claim: "Access persists after sign-in" };
const plan = await client.verifications.prepare(verificationInput, { idempotencyKey: "idem_prepare" });
await client.verifications.approvePlan(plan.reviewed_plan_id);
const run = await client.verifications.run({ ...verificationInput, reviewed_plan_id: plan.reviewed_plan_id }, { idempotencyKey: "idem_run" });
const result = await client.verifications.get(run.verification_id);
ok(calls[0].url === "https://sdk.test/api/v1/verifications", "prepare uses the verification endpoint");
ok(calls[0].init.headers["Idempotency-Key"] === "idem_prepare", "prepare forwards its idempotency key");
ok(calls[1].url.endsWith("/api/v1/verifications/plans/rvp_test/approve"), "approval is a distinct API event");
ok(JSON.parse(calls[2].init.body).reviewed_plan_id === "rvp_test" && calls[2].init.headers["Idempotency-Key"] === "idem_run", "run binds the approved plan and retry key");
ok(result.state === "completed" && result.decision === "Verified", "get returns the evidence-backed terminal decision");

console.log("\n[CJS require]");
const cjs = require("../dist/index.cjs");
ok(typeof cjs.Vraelis === "function", "CJS: Vraelis exported");
ok(typeof cjs.VraelisAPIError === "function", "CJS: VraelisAPIError exported");
ok(typeof cjs.verifyWebhookSignature === "function", "CJS: verifyWebhookSignature exported");

console.log("\n[webhook helper matches server formula — offline]");
const secret = "whsec_smoke", ts = "1718000000";
const body = JSON.stringify({ event: "test.completed", mode: "sandbox" });
const sig = "sha256=" + createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
ok(esm.verifyWebhookSignature({ payload: body, signature: sig, timestamp: ts, secret }) === true, "valid server signature -> true");
ok(esm.verifyWebhookSignature({ payload: body + "x", signature: sig, timestamp: ts, secret }) === false, "tampered body -> false");

console.log("\n[npm pack --dry-run — only safe files ship]");
// --ignore-scripts so prepack/build logs don't pollute --json; slice from the
// first JSON bracket defensively in case npm prints a leading notice.
const out = execSync("npm pack --dry-run --json --ignore-scripts", { encoding: "utf8" });
const json = out.slice(Math.max(out.indexOf("["), out.indexOf("{")) >= 0 ? out.search(/[[{]/) : 0);
const files = (JSON.parse(json)[0]?.files ?? []).map((f) => f.path.replace(/\\/g, "/"));
console.log("  packed:", files.join(", "));
const allowed = (p) => p === "package.json" || p === "README.md" || p === "LICENSE" || p === "CHANGELOG.md" || p.startsWith("dist/");
const stray = files.filter((p) => !allowed(p));
ok(stray.length === 0, "no stray files in the tarball" + (stray.length ? " :: " + stray.join(",") : ""));
const forbidden = files.filter((p) => /(^|\/)(src|scripts|examples|node_modules)\/|\.env|tsconfig|tsup\.config|\.map$|secret|_.*\.cjs/i.test(p));
ok(forbidden.length === 0, "no source/scripts/env/secrets/config in the tarball" + (forbidden.length ? " :: " + forbidden.join(",") : ""));
for (const need of ["package.json", "README.md", "LICENSE", "CHANGELOG.md", "dist/index.js", "dist/index.cjs", "dist/index.d.ts"]) ok(files.includes(need), `ships ${need}`);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
