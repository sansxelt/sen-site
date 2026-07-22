// Phase 3.07 regression lock: user account deletion + data export are CURRENT account
// infrastructure, not part of the retired Vraelis Rank / human-evaluation product. They live
// under the retired-looking /api/v namespace but MUST survive the Rank + human-eval removal
// with their route contract, auth/authz, and behavior unchanged. Static assertions (no DB, no
// network) — proves the surfaces exist, are gated, and depend on nothing that was deleted.

import { readFileSync, existsSync } from "fs";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? "  — " + detail : ""}`); }
}
const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");

// ── account deletion endpoint ──
const del = read("app/api/v/account/delete/route.ts");
ok("account deletion endpoint exists (POST /api/v/account/delete)", del.includes("export async function POST"));
ok("account deletion requires sign-in", del.includes("signin_required") && del.includes("await auth()"));
ok("account deletion is confirm-gated", del.includes('"DELETE MY ACCOUNT"') && del.includes("confirm_required"));
ok("account deletion records a data request (account_deletion)", del.includes("createDataRequest") && del.includes('"account_deletion"'));

// ── data export / privacy request endpoint ──
const dr = read("app/api/v/data-requests/route.ts");
ok("data-requests endpoint exists (POST + GET /api/v/data-requests)", dr.includes("export async function POST") && dr.includes("export async function GET"));
ok("data export is an allowed request type", dr.includes("data_export"));
ok("data-requests requires sign-in", dr.includes("await auth()"));

// ── the backing library ──
const lib = read("lib/v-data-requests.ts");
ok("v-data-requests still exists and exports createDataRequest", lib.includes("export async function createDataRequest"));
ok("v-data-requests supports data_export + account_deletion request types",
  lib.includes("data_export") && lib.includes("account_deletion"));

// ── the account settings UI that drives deletion ──
const ui = read("app/rank/app/account/delete-account.tsx");
ok("the account settings UI still calls the deletion endpoint", ui.includes('"/api/v/account/delete"'));

// ── regression: none of this account infra depends on anything removed with Rank / human-eval ──
const DELETED = /v-decision-package|v-export|v-calibration|v-checks|v-gate|v-evaluator|v-content-blocks|v-attachment-snapshot|v-attachments-db|v-attachments-validate|v-attachments|v-idempotency|v-evidence|ai-tells|v-check-ui|v-report-attachments|v-sandbox|v-projects|v-collection-links|v-quality|v-screening|v-followup|v-readiness|humanEvalEnabled|v-webhooks.*deliverTestCompleted/;
ok("account deletion + data-export code imports nothing removed with Rank/human-eval",
  ![del, dr, lib, ui].some((s) => DELETED.test(s)));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
