// API/service execution adapter (Multi-Platform Program, Phase B) — the FIRST new runtime.
//
// Chosen first per the redline: it is a TRUE second runtime (own build identity = base URL/version; own
// evidence shape = HTTP transactions, not DOM; executes with no browser) that needs ZERO new
// infrastructure — it reuses the existing SSRF-safe fetch (lib/safe-fetch.ts), the encrypted vault for
// secrets, and the boundary discipline. It produces the platform-neutral StepObservation + provenance-
// tagged evidence from runtime/core.ts, proving the neutral interface is thin (if API needed to stub
// browser methods, the core would be wrong — it doesn't).
//
// This module is a pure state machine over API steps. It performs NO real network I/O itself: the caller
// injects a `fetcher` (production = safeFetch, SSRF-pinned; tests = a fixture). That keeps it unit-testable
// and safe to land ahead of any wiring into the production run path. All evidence is Vraelis-generated and
// fully redacted; secrets are referenced by name and never enter an observation.

import { redactSecretyValue } from "../redact";
import type { StepObservation, EvidenceItem, StepClass } from "./core";

// ── Semantic API step vocabulary (maps to the api StepClasses in core) ──────────────────────────────
export type ApiStep =
  | { action: "http_auth"; scheme: "bearer" | "api_key" | "basic"; secretRef: string; headerName?: string }
  | { action: "set_header"; name: string; value: string }
  | { action: "http_request"; method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; path: string; body?: unknown; saveAs?: string }
  | { action: "assert_status"; equals?: number; oneOf?: number[] }
  | { action: "assert_json"; path: string; equals?: unknown; exists?: boolean }
  | { action: "assert_schema"; required: string[] }
  | { action: "extract"; path: string; into: string }
  | { action: "verify_persisted"; path: string; jsonPath: string; equals?: unknown };

const ACTION_TO_CLASS: Record<ApiStep["action"], StepClass> = {
  http_auth: "http_auth", set_header: "http_auth", http_request: "http_request",
  assert_status: "assert_status", assert_json: "assert_json", assert_schema: "assert_schema",
  extract: "extract", verify_persisted: "verify_persisted",
};

// redirect is ALWAYS "manual" (SSRF hardening): safeFetch only validates + pins the FIRST URL's host, so a
// 30x from the validated target could otherwise redirect to an unvalidated/private host. We never follow
// redirects; a 30x is surfaced as its status like any other response. Matches every other outbound caller
// in the codebase (lib/v-webhooks.ts, lib/v-sso.ts, crawl).
export type ApiFetch = (url: string, init: { method: string; headers: Record<string, string>; body?: string; redirect: "manual" }) =>
  Promise<{ status: number; headers: Record<string, string>; text: string }>;

export type ApiFlowResult = { ok: boolean; steps: StepObservation[]; failedIndex: number | null };

const MAX_STEPS = 40, MAX_BODY_CHARS = 4000, MAX_HEADER_CHARS = 300;
const ALWAYS_MASK_HEADERS = new Set(["authorization", "cookie", "set-cookie", "x-api-key", "proxy-authorization"]);

function maskHeaders(h: Record<string, string>, secretValues: Set<string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    let val = ALWAYS_MASK_HEADERS.has(k.toLowerCase()) ? "***" : redactSecretyValue(String(v));
    for (const s of secretValues) if (s && val.includes(s)) val = val.split(s).join("***");
    out[k] = val.slice(0, MAX_HEADER_CHARS);
  }
  return out;
}
// JSON keys whose VALUES are credential-bearing regardless of shape — an opaque server-minted token/session
// id that the vendor-format regex can't recognize. We mask these proactively so a /login response body like
// {"token":"tok_opaque..."} never lands raw in evidence (redaction review finding).
const SECRET_JSON_KEYS = /"(token|access_token|refresh_token|id_token|secret|password|passwd|pwd|api[_-]?key|apikey|authorization|auth|session|session_id|sessionid|cookie|bearer|credential|client_secret|private_key)"\s*:\s*"([^"]*)"/gi;

function sanitizeBody(raw: string | undefined, secretValues: Set<string>): string | undefined {
  if (raw == null) return undefined;
  // 1) mask credential-bearing JSON keys by NAME (catches opaque tokens the shape-regex misses).
  let s = raw.replace(SECRET_JSON_KEYS, (_m, key: string) => `"${key}":"***"`);
  // 2) vendor-format shape redaction (sk_/JWT/AKIA/...).
  s = redactSecretyValue(s);
  // 3) mask any KNOWN value (configured secret OR runtime-extracted) that appears verbatim.
  for (const sec of secretValues) if (sec && s.includes(sec)) s = s.split(sec).join("***");
  return s.slice(0, MAX_BODY_CHARS);
}

// Redact a URL path for evidence: run the shape regex AND mask any known secret/extracted value that was
// interpolated into it (e.g. /reset/{{var:token}} -> a harvested token in the path).
function sanitizePath(path: string, secretValues: Set<string>): string {
  let s = redactSecretyValue(path);
  for (const sec of secretValues) if (sec && s.includes(sec)) s = s.split(sec).join("***");
  return s;
}

// Minimal dependency-free JSON path: $.a.b, $.items[0].id, a.b.
function readJsonPath(root: unknown, path: string): { found: boolean; value: unknown } {
  const clean = path.replace(/^\$\.?/, "");
  if (clean === "") return { found: true, value: root };
  const parts = clean.match(/[^.[\]]+/g) ?? [];
  let cur: unknown = root;
  for (const p of parts) {
    if (cur == null) return { found: false, value: undefined };
    const idx = /^\d+$/.test(p) ? Number(p) : null;
    if (idx !== null) {
      if (!Array.isArray(cur) || idx >= cur.length) return { found: false, value: undefined };
      cur = cur[idx];
    } else {
      if (typeof cur !== "object" || Array.isArray(cur) || !(p in (cur as Record<string, unknown>))) return { found: false, value: undefined };
      cur = (cur as Record<string, unknown>)[p];
    }
  }
  return { found: true, value: cur };
}

function substitute(input: string, vars: Map<string, unknown>, secrets: Map<string, string>): string {
  return input
    .replace(/\{\{var:([A-Za-z0-9_]+)\}\}/g, (_m, n: string) => { const v = vars.get(n); return v == null ? "" : String(v); })
    .replace(/\{\{secret:([A-Za-z0-9_]+)\}\}/g, (_m, n: string) => secrets.get(n) ?? "");
}
function deepSubstitute(body: unknown, vars: Map<string, unknown>, secrets: Map<string, string>): unknown {
  if (typeof body === "string") return substitute(body, vars, secrets);
  if (Array.isArray(body)) return body.map((x) => deepSubstitute(x, vars, secrets));
  if (body && typeof body === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) out[k] = deepSubstitute(v, vars, secrets);
    return out;
  }
  return body;
}

// A sanitized http_txn evidence item — ALWAYS vraelis_generated + factual (the adapter itself performed and
// recorded the transaction; nothing here is provider-attested or inferred).
function httpTxnEvidence(capturedAt: string, req: { method: string; path: string; headers: Record<string, string>; body?: string }, res?: { status: number; headers: Record<string, string>; body?: string }): EvidenceItem {
  return {
    kind: "http_txn", provenance: "vraelis_generated", capturedAt,
    ref: JSON.stringify({ request: req, response: res }),
    meta: { method: req.method, path: req.path, ...(res ? { status: String(res.status) } : {}) },
  };
}

export type RunApiFlowInput = {
  baseUrl: string;
  steps: ApiStep[];
  secrets: Record<string, string>;
  fetcher: ApiFetch;             // SSRF-safe in production (safeFetch)
  clock: () => number;           // injected (Date.now is unavailable in some sandboxes; always inject)
};

export async function runApiFlow(input: RunApiFlowInput): Promise<ApiFlowResult> {
  const steps = input.steps.slice(0, MAX_STEPS);
  const secrets = new Map(Object.entries(input.secrets));
  // Values to mask in ALL evidence. Starts with the configured vault secrets and GROWS as `extract`
  // harvests values from responses — a runtime-harvested credential re-injected into a later request
  // (custom header, path, or body) must be masked wherever it appears (redaction review finding).
  const secretValues = new Set(Object.values(input.secrets).filter(Boolean));
  const vars = new Map<string, unknown>();
  const headers = new Map<string, string>();
  const out: StepObservation[] = [];

  const resolveUrl = (path: string): string | null => {
    try {
      const u = new URL(path, input.baseUrl.endsWith("/") ? input.baseUrl : input.baseUrl + "/");
      const base = new URL(input.baseUrl);
      if (u.origin !== base.origin) return null; // never leave the app's own API origin (boundary)
      return u.toString();
    } catch { return null; }
  };

  let lastResponse: { status: number; json: unknown } | null = null;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepClass = ACTION_TO_CLASS[step.action];
    const t0 = input.clock();
    const iso = new Date(t0).toISOString();
    const rec = (ok: boolean, detail: string, evidence: EvidenceItem[] = []): StepObservation =>
      ({ stepClass, ok, detail, ms: Math.max(0, input.clock() - t0), evidence });

    let obs: StepObservation;
    switch (step.action) {
      case "http_auth": {
        const secret = secrets.get(step.secretRef);
        if (!secret) { obs = rec(false, `no secret named "${step.secretRef}"`); break; }
        if (step.scheme === "bearer") headers.set("Authorization", `Bearer ${secret}`);
        else if (step.scheme === "basic") headers.set("Authorization", `Basic ${secret}`);
        else headers.set(step.headerName || "X-API-Key", secret);
        obs = rec(true, `auth set (${step.scheme})`);
        break;
      }
      case "set_header": {
        headers.set(step.name, substitute(step.value, vars, secrets));
        obs = rec(true, `header ${step.name} set`);
        break;
      }
      case "http_request":
      case "verify_persisted": {
        const method = step.action === "http_request" ? step.method : "GET";
        // Substitute extracted variables into the path FIRST (e.g. /projects/{{var:pid}}), then resolve.
        // Only var substitution here — a secret must never be interpolated into a URL path.
        const resolvedPath = substitute(step.path, vars, new Map());
        const url = resolveUrl(resolvedPath);
        if (!url) { obs = rec(false, `path "${resolvedPath}" is not on this API's origin`); break; }
        const bodyObj = step.action === "http_request" && step.body != null ? deepSubstitute(step.body, vars, secrets) : undefined;
        const bodyStr = bodyObj != null ? JSON.stringify(bodyObj) : undefined;
        const outHeaders: Record<string, string> = { ...Object.fromEntries(headers), ...(bodyStr ? { "content-type": "application/json" } : {}) };
        const safePath = sanitizePath(resolvedPath, secretValues);
        const reqEv = { method, path: safePath, headers: maskHeaders(outHeaders, secretValues), body: sanitizeBody(bodyStr, secretValues) };
        let res: { status: number; headers: Record<string, string>; text: string };
        try { res = await input.fetcher(url, { method, headers: outHeaders, body: bodyStr, redirect: "manual" }); }
        catch (e) { obs = rec(false, `request failed: ${(e as Error).message.slice(0, 80)}`, [httpTxnEvidence(iso, reqEv)]); break; }
        let json: unknown = undefined;
        try { json = res.text ? JSON.parse(res.text) : undefined; } catch { /* non-JSON */ }
        lastResponse = { status: res.status, json };
        const respEv = { status: res.status, headers: maskHeaders(res.headers, secretValues), body: sanitizeBody(res.text, secretValues) };
        const ev = [httpTxnEvidence(iso, reqEv, respEv)];
        if (step.action === "http_request") {
          obs = rec(true, `${method} ${safePath} -> ${res.status}`, ev);
        } else {
          const got = readJsonPath(json, step.jsonPath);
          const ok = got.found && (step.equals === undefined || JSON.stringify(got.value) === JSON.stringify(step.equals));
          obs = rec(ok, ok ? `persisted: ${step.jsonPath} matches` : `persisted check failed: ${step.jsonPath}`, ev);
        }
        break;
      }
      case "assert_status": {
        if (!lastResponse) { obs = rec(false, "no response to assert on"); break; }
        const s = lastResponse.status;
        const ok = step.equals !== undefined ? s === step.equals : step.oneOf ? step.oneOf.includes(s) : false;
        obs = rec(ok, ok ? `status ${s}` : `expected ${step.equals ?? step.oneOf?.join("/")} got ${s}`);
        break;
      }
      case "assert_json": {
        if (!lastResponse) { obs = rec(false, "no response to assert on"); break; }
        const got = readJsonPath(lastResponse.json, step.path);
        let ok = got.found;
        if (ok && step.exists === false) ok = false;
        if (ok && step.equals !== undefined) ok = JSON.stringify(got.value) === JSON.stringify(step.equals);
        obs = rec(ok, ok ? `${step.path} ok` : `${step.path} ${got.found ? "value mismatch" : "not found"}`);
        break;
      }
      case "assert_schema": {
        if (!lastResponse || typeof lastResponse.json !== "object" || lastResponse.json == null) { obs = rec(false, "response is not a JSON object"); break; }
        const missing = step.required.filter((k) => !(k in (lastResponse!.json as Record<string, unknown>)));
        obs = rec(missing.length === 0, missing.length === 0 ? "schema ok" : `missing keys: ${missing.join(", ")}`);
        break;
      }
      case "extract": {
        if (!lastResponse) { obs = rec(false, "no response to extract from"); break; }
        const got = readJsonPath(lastResponse.json, step.path);
        if (!got.found) { obs = rec(false, `extract: ${step.path} not found`); break; }
        vars.set(step.into, got.value);
        // Treat every harvested string value as a secret-to-mask: if it is later re-injected into a header,
        // path, or body it must never appear raw in evidence (redaction review finding).
        if (typeof got.value === "string" && got.value) secretValues.add(got.value);
        obs = rec(true, `extracted ${step.path} -> ${step.into}`);
        break;
      }
    }

    out.push(obs);
    if (!obs.ok) return { ok: false, steps: out, failedIndex: i };
  }
  return { ok: true, steps: out, failedIndex: null };
}

// The API adapter's declared capabilities — the honest capability surface the core reads to reject
// unsupported steps. Note: no image/viewport/screenshot; API evidence is http_txn only.
export const API_CAPABILITIES = {
  runtime: "api" as const,
  version: "api-1",
  steps: new Set<StepClass>(["http_auth", "http_request", "assert_status", "assert_schema", "assert_json", "extract", "verify_persisted"]),
  evidence: new Set(["http_txn"] as const),
  executesUntrustedArtifact: false,
};
