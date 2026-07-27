// PURE, shared, tested step model for the customer-facing Flow Designer (S8A). No DB, no Next, no worker
// import: this is the single source of truth for what an owner may author, and it validates every authored
// flow server-side before it is stored. The worker already EXECUTES these actions (worker/preflight/types
// StepAction union); this module exposes only the CURATED SAFE SUBSET the owner may build by hand, and
// rejects anything the worker would accept but the designer must not offer (raw selectors, screenshots,
// arbitrary presses). It duplicates the worker's AUTH_ACTIONS set rather than importing worker code (the
// web side never imports the worker), the same way lib/preflight/auth-preflight.ts does.
//
// SECRET RULE: a password/secret VALUE is NEVER entered into a step. sign_in_as / switch_role carry a ROLE
// LABEL only; the worker resolves the role to a sealed test account and decrypts it at the moment of use.
// Any step value that looks credential-shaped (the connections redact/secret-detect) is REJECTED here so a
// credential can never be typed into a flow and stored in plaintext.

import { redactSecretyValue } from "./connections-db";

// The customer-authorable actions. A curated safe subset of the worker StepAction union (spec: "Do not
// expose raw Playwright selectors as the primary editing experience"). navigate/click/fill/assert_*/refresh
// are the plain-journey actions; the six auth actions are the S6 semantic auth primitives.
export const FLOW_ACTIONS = [
  "navigate", "click", "fill", "assert_visible", "assert_text", "assert_url", "refresh",
  "sign_in_as", "verify_authenticated", "verify_unauthorized", "switch_role", "sign_out", "reset_context",
] as const;
export type FlowAction = (typeof FLOW_ACTIONS)[number];
const FLOW_ACTION_SET: ReadonlySet<string> = new Set(FLOW_ACTIONS);

// The auth actions, duplicated from worker/preflight/types.ts AUTH_ACTIONS (kept in sync; the web side does
// not import worker code — same discipline as lib/preflight/auth-preflight.ts). A flow using ANY is an
// authenticated flow whose roles must resolve at launch.
export const AUTH_FLOW_ACTIONS: ReadonlySet<FlowAction> = new Set<FlowAction>([
  "sign_in_as", "verify_authenticated", "verify_unauthorized", "switch_role", "sign_out", "reset_context",
]);
// The two actions that carry a ROLE in `target` (the sign-in targets that must resolve to a test account).
const ROLE_ACTIONS: ReadonlySet<FlowAction> = new Set<FlowAction>(["sign_in_as", "switch_role"]);

// A normalized, storage-shaped step: exactly the columns v_test_flows.steps holds. Optional fields are
// dropped (not stored as empty strings) when the action does not use them.
export type FlowStep = { action: FlowAction; target?: string; value?: string; expect?: string };

// Bounds. <=30 steps mirrors the worker's maxStepsPerFlow (see preflight-auth-flows-verify limits); string
// caps keep a single step small and prevent an adversarial giant paste from bloating the row.
export const MAX_STEPS = 30;
const MAX_TARGET = 400;
const MAX_VALUE = 400;
const MAX_EXPECT = 400;

export type ValidateOk = { ok: true; steps: FlowStep[] };
export type ValidateErr = { ok: false; reason: string };
export type ValidateResult = ValidateOk | ValidateErr;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// Does this string look like a credential the connections value-guard would redact? redactSecretyValue
// returns the string UNCHANGED when nothing matched, so an inequality means a credential shape was found.
function looksCredentialShaped(v: string): boolean {
  return redactSecretyValue(v) !== v;
}

// A navigate target must be RELATIVE or empty: the worker rebases every navigate onto the run's approved
// deployment origin, so an authored absolute URL (another origin) is never honored and is rejected here to
// keep the intent honest. Empty is allowed (navigate to the app root). A leading "/" or a bare relative
// path is fine; a scheme (http:, https:, //, javascript:, data:, etc.) is not.
function isRelativeTarget(v: string): boolean {
  if (v === "") return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return false; // any URL scheme (http:, javascript:, data:, mailto:)
  if (v.startsWith("//")) return false;             // protocol-relative — resolves to another origin
  // A PATH NEVER CONTAINS A RAW SPACE; it would be percent-encoded. Without this, the only things rejected
  // were other origins, so a SENTENCE passed validation and became a step that cannot pass: synthesis wrote
  // assert_url expect="Redirected to auth page", the worker checks url().includes(expect), and the run
  // failed against an application that had done exactly what was asked. Every field routed through here is
  // a URL path (navigate target, assert_url expect, verify_authenticated/verify_unauthorized value), so a
  // value with whitespace in it is not a path that failed, it is not a path at all.
  if (/\s/.test(v)) return false;
  return true;
}

// Validate + normalize an authored step list. Returns the normalized steps (only the fields each action
// uses) or a specific, owner-safe reason. `rolesAvailable` is the app's test-account role labels; a
// sign_in_as / switch_role target MUST be one of them (case-insensitive) so the launch-time auth-readiness
// gate can resolve it. Pure: no DB, no vault, no I/O.
export function validateSteps(rawSteps: unknown, opts: { rolesAvailable: string[] }): ValidateResult {
  if (!Array.isArray(rawSteps)) return { ok: false, reason: "Steps must be a list." };
  if (rawSteps.length === 0) return { ok: false, reason: "Add at least one step." };
  if (rawSteps.length > MAX_STEPS) return { ok: false, reason: `A flow can have at most ${MAX_STEPS} steps.` };

  const roleSet = new Set(opts.rolesAvailable.map((r) => r.trim().toLowerCase()).filter(Boolean));

  const out: FlowStep[] = [];
  for (let i = 0; i < rawSteps.length; i++) {
    const raw = (rawSteps[i] && typeof rawSteps[i] === "object" ? rawSteps[i] : {}) as Record<string, unknown>;
    const n = i + 1; // owner-facing 1-based step number
    const action = str(raw.action) as FlowAction;
    if (!FLOW_ACTION_SET.has(action)) return { ok: false, reason: `Step ${n}: "${str(raw.action) || "(empty)"}" is not an action you can add.` };

    const target = str(raw.target);
    const value = str(raw.value);
    const expect = str(raw.expect);

    // The value channel is the ONLY place an owner types free text that could be a credential. Guard every
    // string field: no credential-shaped value is ever stored on a step, whatever the action.
    for (const [field, v] of [["target", target], ["value", value], ["expect", expect]] as const) {
      if (v && looksCredentialShaped(v)) {
        return { ok: false, reason: `Step ${n}: the ${field} looks like a credential. Passwords are never entered into a step. Add the account under Connections and sign in by role.` };
      }
    }
    if (target.length > MAX_TARGET) return { ok: false, reason: `Step ${n}: the target is too long (max ${MAX_TARGET}).` };
    if (value.length > MAX_VALUE) return { ok: false, reason: `Step ${n}: the value is too long (max ${MAX_VALUE}).` };
    if (expect.length > MAX_EXPECT) return { ok: false, reason: `Step ${n}: the expected text is too long (max ${MAX_EXPECT}).` };

    const step: FlowStep = { action };

    switch (action) {
      case "sign_in_as":
      case "switch_role": {
        if (!target) return { ok: false, reason: `Step ${n}: choose a role to ${action === "sign_in_as" ? "sign in as" : "switch to"}.` };
        if (!roleSet.has(target.toLowerCase())) {
          return { ok: false, reason: `Step ${n}: no test account is configured for the "${target}" role. Add one under Connections.` };
        }
        step.target = target;
        break;
      }
      case "navigate": {
        if (target && !isRelativeTarget(target)) {
          return { ok: false, reason: `Step ${n}: navigate to a path on this app (e.g. /dashboard). A path, not a description and not another website.` };
        }
        if (target) step.target = target; // empty = the app root (worker rebases)
        break;
      }
      case "click":
      case "assert_visible": {
        if (!target) return { ok: false, reason: `Step ${n}: name what to ${action === "click" ? "click" : "check is visible"} (a button label, link text, or heading).` };
        step.target = target;
        break;
      }
      case "assert_text": {
        if (!target) return { ok: false, reason: `Step ${n}: name where to check the text (an element or region).` };
        if (!expect) return { ok: false, reason: `Step ${n}: enter the text you expect to see.` };
        step.target = target;
        step.expect = expect;
        break;
      }
      case "assert_url": {
        // Verify the browser is on the expected route. The worker checks page.url().includes(expect), so
        // `expect` is a route fragment (e.g. /dashboard). Keep it RELATIVE for the same reason navigate is:
        // an authored absolute URL on another origin can never be honored, so we reject it to keep the
        // intent honest and owner-safe.
        if (!expect) return { ok: false, reason: `Step ${n}: enter the path you expect to be on (e.g. /dashboard).` };
        if (!isRelativeTarget(expect)) {
          return { ok: false, reason: `Step ${n}: check a path on this app (e.g. /dashboard). A path, not a description of where the user should be.` };
        }
        step.expect = expect;
        break;
      }
      case "fill": {
        if (!target) return { ok: false, reason: `Step ${n}: name the field to fill (its label or placeholder).` };
        if (!value) return { ok: false, reason: `Step ${n}: enter the value to type into the field.` };
        step.target = target;
        step.value = value;
        break;
      }
      case "verify_authenticated":
      case "verify_unauthorized": {
        // Optional expectations the worker already consumes (execute-run reads value=expected route,
        // expect=expected element for these). Both are optional — the bare "verify signed in / signed out"
        // check still works with neither. When provided, value is a RELATIVE route fragment (same rule as
        // navigate/assert_url) and expect is element text; both already passed the credential guard above.
        if (value) {
          if (!isRelativeTarget(value)) {
            return { ok: false, reason: `Step ${n}: the expected page must be a path on this app (e.g. /dashboard). A path, not a description.` };
          }
          step.value = value;
        }
        if (expect) step.expect = expect;
        break;
      }
      case "refresh":
      case "sign_out":
      case "reset_context":
        // No fields: these actions carry no target/value/expect.
        break;
    }
    out.push(step);
  }

  // A JOURNEY THAT NEEDS A SESSION MUST DECLARE IT.
  //
  // The worker has a complete apparatus for authenticated journeys: a launch-time readiness check that
  // refuses before any money moves when a role has no usable credential, and an auth_config_failed flow
  // state that carries no severity, opens no issue, and softens the run rather than blaming the customer.
  // All of it hangs off the semantic auth actions. A flow that signs in by TYPING bypasses every piece of
  // it, so nothing knows authentication was attempted and nothing checks that it worked.
  //
  // That is not theoretical. A guarantee about note persistence produced a journey that filled an email
  // field and clicked Sign in against an app requiring email confirmation. The sign-in silently did not
  // happen, the remaining steps ran as an anonymous visitor, and the run was published as the application
  // failing to provide a Save control. The verifier had no basis to judge the guarantee at all, and said
  // the customer's software was broken instead.
  //
  // Filling a password field is the unambiguous signal. A journey may legitimately exercise the sign-in
  // FORM without a session (checking the fields render), so clicking a control named "Sign in" is not
  // enough to refuse; typing a password is, because a real session is the only reason to do it.
  if (!out.some((s) => ROLE_ACTIONS.has(s.action))) {
    const typed = out.findIndex((s) => s.action === "fill" && /pass\s*(word|code)?|pwd|secret/i.test(s.target ?? ""));
    if (typed >= 0) {
      return {
        ok: false,
        reason: `Step ${typed + 1}: this journey signs in by typing a password, so Vraelis cannot confirm the sign-in worked and would report a signed-out page as a defect in your app. Add the test account under Connections and sign in by role instead.`,
      };
    }
  }

  return { ok: true, steps: out };
}

// PURE flow classification, mirroring worker/preflight/types.ts (a flow using any auth action is an
// authenticated flow whose roles must resolve at launch). Re-derived here so the web side never imports
// the worker; identical semantics.
export function flowRequiresAuth(steps: { action: string }[]): boolean {
  return steps.some((s) => AUTH_FLOW_ACTIONS.has(s.action as FlowAction));
}

// The roles a flow signs into (sign_in_as / switch_role targets), de-duplicated, in first-seen order.
export function flowRoles(steps: { action: string; target?: string }[]): string[] {
  const out: string[] = [];
  for (const s of steps) {
    if (ROLE_ACTIONS.has(s.action as FlowAction) && s.target && !out.includes(s.target)) out.push(s.target);
  }
  return out;
}

// A short, owner-facing description of one action for the step-builder picker (no raw enum leaks in the UI).
export const ACTION_LABELS: Record<FlowAction, string> = {
  navigate: "Go to a page",
  click: "Click something",
  fill: "Fill a field",
  assert_visible: "Check something is visible",
  assert_text: "Check text says",
  assert_url: "Check the page is",
  refresh: "Refresh the page",
  sign_in_as: "Sign in as a role",
  verify_authenticated: "Verify signed in",
  verify_unauthorized: "Verify signed out",
  switch_role: "Switch to another role",
  sign_out: "Sign out",
  reset_context: "Reset the session",
};
