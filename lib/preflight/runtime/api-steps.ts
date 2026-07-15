// PURE, shared, tested step model for the customer-facing API Flow Designer (API beta). No DB, no Next, no
// worker/canary import — the single source of truth for what a customer may author for an API runtime target,
// validated server-side before storage. It is the API-runtime sibling of flow-steps.ts (web): it exposes only
// the CURATED customer vocabulary, validates every field, rejects credential-shaped values, and translates to
// the internal ApiStep union (api-adapter.ts) at LAUNCH time — internal action names never round-trip through
// the DB or any API response, so a raw GET of a stored flow can never leak them.
//
// SECRET RULE (identical to web): a token/secret VALUE is NEVER entered into a step. "Sign in with a saved
// credential" carries a credential LABEL only; the executor resolves it to a sealed vault entry and decrypts
// it at the moment of use. Any field value that looks credential-shaped is REJECTED here.
//
// No customer-facing string in this module (action ids, labels, reasons) is an internal ApiStep action name
// (http_request/http_auth/assert_status/assert_json/assert_schema/extract/verify_persisted/set_header) or a
// fixture/canary term. That is asserted by the test suite.

import { redactSecretyValue } from "../connections-db";
import type { ApiStep } from "./api-adapter";

// The customer-authorable API actions (plain-language ids; NOT the internal ApiStep names).
export const API_FLOW_ACTIONS = [
  "sign_in",            // -> http_auth   (scheme taken from the saved credential; carries a LABEL only)
  "add_header",         // -> set_header
  "call",               // -> http_request
  "expect_status",      // -> assert_status
  "expect_field",       // -> assert_json
  "expect_fields_exist",// -> assert_schema
  "save_value",         // -> extract
  "confirm_saved",      // -> verify_persisted
] as const;
export type ApiFlowAction = (typeof API_FLOW_ACTIONS)[number];
const API_ACTION_SET: ReadonlySet<string> = new Set(API_FLOW_ACTIONS);

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const METHOD_SET: ReadonlySet<string> = new Set(HTTP_METHODS);

// A normalized, storage-shaped customer step: exactly what v_test_flows.steps holds for an API flow. This is
// the CUSTOMER vocabulary — never the internal ApiStep shape. Fields are per-action (unused ones dropped).
export type ApiFlowStep = {
  action: ApiFlowAction;
  credentialLabel?: string;   // sign_in: which saved credential to use (resolved at launch)
  method?: string;            // call
  path?: string;              // call, confirm_saved
  body?: string;              // call: a JSON body (validated as JSON)
  name?: string;              // add_header header name
  value?: string;             // add_header header value; expect_status/expect_field expected value
  field?: string;             // expect_field / save_value / confirm_saved: a JSON field path ($.a.b)
  into?: string;              // save_value: the variable name to remember it as
  status?: number;            // expect_status: the exact status
};

export const MAX_API_STEPS = 40;
const MAX_STR = 400;
const MAX_BODY = 4000;
const VAR_RE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;      // save_value target / referenced var name
const FIELD_RE = /^\$?[A-Za-z0-9_.[\]]{1,120}$/;    // a simple JSON path ($.a.b or a.b[0].c)

export type ValidateOk = { ok: true; steps: ApiFlowStep[] };
export type ValidateErr = { ok: false; reason: string };
export type ValidateResult = ValidateOk | ValidateErr;

function str(v: unknown): string { return typeof v === "string" ? v.trim() : ""; }
function looksCredentialShaped(v: string): boolean { return redactSecretyValue(v) !== v; }

// A path must be a RELATIVE path on the API's own base (the executor joins it onto the configured base URL and
// the adapter enforces same-origin). A full/scheme/protocol-relative URL is rejected so a flow can never
// re-aim a request at another host.
function isRelativePath(v: string): boolean {
  if (!v.startsWith("/")) return false;
  if (v.startsWith("//")) return false;
  if (/:\/\//.test(v)) return false;
  return true;
}

// Validate + normalize an authored API step list. `credentialLabels` are the labels of the app's saved API
// credentials; a sign_in step's label MUST be one of them. Pure: no DB, no vault, no network.
export function validateApiSteps(rawSteps: unknown, opts: { credentialLabels: string[] }): ValidateResult {
  if (!Array.isArray(rawSteps)) return { ok: false, reason: "Steps must be a list." };
  if (rawSteps.length === 0) return { ok: false, reason: "Add at least one step." };
  if (rawSteps.length > MAX_API_STEPS) return { ok: false, reason: `A flow can have at most ${MAX_API_STEPS} steps.` };

  const credSet = new Set(opts.credentialLabels.map((c) => c.trim().toLowerCase()).filter(Boolean));
  const out: ApiFlowStep[] = [];

  for (let i = 0; i < rawSteps.length; i++) {
    const raw = (rawSteps[i] && typeof rawSteps[i] === "object" ? rawSteps[i] : {}) as Record<string, unknown>;
    const n = i + 1;
    const action = str(raw.action) as ApiFlowAction;
    if (!API_ACTION_SET.has(action)) return { ok: false, reason: `Step ${n}: "${str(raw.action) || "(empty)"}" is not an action you can add.` };

    const credentialLabel = str(raw.credentialLabel);
    const method = str(raw.method).toUpperCase();
    const path = str(raw.path);
    const body = str(raw.body);
    const name = str(raw.name);
    const value = str(raw.value);
    const field = str(raw.field);
    const into = str(raw.into);

    // Credential-shape guard on EVERY free-text field — a token can never be typed into a step and stored.
    // credentialLabel is exempt (it is a label, not a secret) but is still length/existence-checked below.
    for (const [f, v] of [["path", path], ["body", body], ["header name", name], ["value", value], ["field", field], ["variable", into]] as const) {
      if (v && looksCredentialShaped(v)) {
        return { ok: false, reason: `Step ${n}: the ${f} looks like a credential. Secrets are never entered into a step — save the credential under Connections and reference it by name.` };
      }
    }
    if ([credentialLabel, method, path, name, value, field, into].some((s) => s.length > MAX_STR) || body.length > MAX_BODY) {
      return { ok: false, reason: `Step ${n}: a field is too long.` };
    }

    const step: ApiFlowStep = { action };
    switch (action) {
      case "sign_in": {
        if (!credentialLabel) return { ok: false, reason: `Step ${n}: choose which saved credential to sign in with.` };
        if (!credSet.has(credentialLabel.toLowerCase())) return { ok: false, reason: `Step ${n}: no saved credential named "${credentialLabel}". Add it under Connections.` };
        step.credentialLabel = credentialLabel;
        break;
      }
      case "add_header": {
        if (!name) return { ok: false, reason: `Step ${n}: name the header to add.` };
        if (!value) return { ok: false, reason: `Step ${n}: enter the header value.` };
        step.name = name; step.value = value;
        break;
      }
      case "call": {
        if (!METHOD_SET.has(method)) return { ok: false, reason: `Step ${n}: choose a method (GET, POST, PUT, PATCH, or DELETE).` };
        if (!path || !isRelativePath(path)) return { ok: false, reason: `Step ${n}: enter a path on your API (e.g. /users), not a full URL.` };
        step.method = method; step.path = path;
        if (body) {
          try { JSON.parse(body); } catch { return { ok: false, reason: `Step ${n}: the request body must be valid JSON.` }; }
          step.body = body;
        }
        break;
      }
      case "expect_status": {
        const status = typeof raw.status === "number" ? raw.status : Number(str(raw.status));
        if (!Number.isInteger(status) || status < 100 || status > 599) return { ok: false, reason: `Step ${n}: enter the status code you expect (e.g. 200).` };
        step.status = status;
        break;
      }
      case "expect_field": {
        if (!field || !FIELD_RE.test(field)) return { ok: false, reason: `Step ${n}: name the response field to check (e.g. $.id or data.name).` };
        step.field = field;
        if (value) step.value = value; // optional expected value; absent = just require the field is present
        break;
      }
      case "expect_fields_exist": {
        // value carries a comma-separated list of required top-level keys.
        const keys = value.split(",").map((k) => k.trim()).filter(Boolean);
        if (keys.length === 0) return { ok: false, reason: `Step ${n}: list the fields the response must include (comma-separated).` };
        step.value = keys.join(",");
        break;
      }
      case "save_value": {
        if (!field || !FIELD_RE.test(field)) return { ok: false, reason: `Step ${n}: name the response field to save (e.g. $.id).` };
        if (!into || !VAR_RE.test(into)) return { ok: false, reason: `Step ${n}: give the saved value a short name (letters, numbers, underscore).` };
        step.field = field; step.into = into;
        break;
      }
      case "confirm_saved": {
        if (!path || !isRelativePath(path)) return { ok: false, reason: `Step ${n}: enter the path to re-read (e.g. /users/{{id}}).` };
        if (!field || !FIELD_RE.test(field)) return { ok: false, reason: `Step ${n}: name the field that confirms it was saved (e.g. $.persisted).` };
        step.path = path; step.field = field;
        if (value) step.value = value;
        break;
      }
    }
    out.push(step);
  }
  return { ok: true, steps: out };
}

// A flow using sign_in is authenticated (its credential must resolve at launch). Mirrors flowRequiresAuth.
export function apiFlowRequiresAuth(steps: { action: string }[]): boolean {
  return steps.some((s) => s.action === "sign_in");
}
// The credential labels a flow signs in with, first-seen order.
export function apiFlowCredentials(steps: { action: string; credentialLabel?: string }[]): string[] {
  const out: string[] = [];
  for (const s of steps) if (s.action === "sign_in" && s.credentialLabel && !out.includes(s.credentialLabel)) out.push(s.credentialLabel);
  return out;
}

// Owner-facing labels for the step-builder picker — NEVER an internal ApiStep enum name.
export const API_ACTION_LABELS: Record<ApiFlowAction, string> = {
  sign_in: "Sign in with a saved credential",
  add_header: "Add a request header",
  call: "Call an endpoint",
  expect_status: "Check the response status",
  expect_field: "Check a response value",
  expect_fields_exist: "Check response fields exist",
  save_value: "Save a value from the response",
  confirm_saved: "Confirm it was saved",
};

// ── Translation to the internal ApiStep union (LAUNCH-time only) ──────────────────────────────────────
// credentialResolver maps a credential LABEL to the vault secretRef + scheme the adapter needs. This runs in
// the executor, never at author time, so the internal ApiStep shape (and secretRef) never touches the DB or a
// customer response. Returns null for a step that cannot be resolved (e.g. an unknown credential at launch).
export type ResolvedCredential = { secretRef: string; scheme: "bearer" | "api_key" | "basic"; headerName?: string };
export function mapToApiStep(step: ApiFlowStep, resolveCredential: (label: string) => ResolvedCredential | null): ApiStep | null {
  switch (step.action) {
    case "sign_in": {
      const c = step.credentialLabel ? resolveCredential(step.credentialLabel) : null;
      if (!c) return null;
      return { action: "http_auth", scheme: c.scheme, secretRef: c.secretRef, ...(c.headerName ? { headerName: c.headerName } : {}) };
    }
    case "add_header":
      return { action: "set_header", name: step.name!, value: step.value! };
    case "call":
      return { action: "http_request", method: step.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: step.path!, ...(step.body != null ? { body: JSON.parse(step.body) } : {}) };
    case "expect_status":
      return { action: "assert_status", equals: step.status! };
    case "expect_field":
      return { action: "assert_json", path: normField(step.field!), ...(step.value !== undefined ? { equals: coerce(step.value) } : { exists: true }) };
    case "expect_fields_exist":
      return { action: "assert_schema", required: (step.value ?? "").split(",").map((k) => k.trim()).filter(Boolean) };
    case "save_value":
      return { action: "extract", path: normField(step.field!), into: step.into! };
    case "confirm_saved":
      return { action: "verify_persisted", path: step.path!, jsonPath: normField(step.field!), ...(step.value !== undefined ? { equals: coerce(step.value) } : {}) };
  }
}

// A stored field like "id" or "data.name" becomes the adapter's "$.id" / "$.data.name" JSON path.
function normField(f: string): string { return f.startsWith("$") ? f : `$.${f}`; }
// A customer types expected values as text; coerce obvious JSON scalars so `equals` compares like-for-like.
function coerce(v: string): unknown {
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}
