// Two gates that must both pass before a paid browser run: did Vraelis UNDERSTAND the guarantee, and did it
// build an execution path capable of JUDGING it.
//
// The first real production run exposed why one gate is not enough. Synthesis preserved the important
// requirement ("retain Pro status after signing out and signing in again"), so claim coverage was fine, but
// the execution plan never actually carried a browser through payment, then the account, then a fresh
// sign-in, then a final Pro assertion. A strong written requirement that no runnable flow proves is worth
// nothing, and a run launched on it wastes a pass and returns a verdict from evidence that was never
// gathered.
//
// Both validators are DETERMINISTIC and PURE. No model, no network. That is deliberate: a gate that decides
// whether to spend money and whether a verdict is trustworthy must itself be predictable and testable.

// ── Claim analysis ───────────────────────────────────────────────────────────────────────────────────────

export type ClaimAnalysis = {
  /** Named expected values the claim demands, in the claim's own casing: ["Pro"], ["Admin"], ["Free"]. */
  namedValues: string[];
  /** The claim requires a state to SURVIVE a boundary (retain / remain / still / after signing in / reload). */
  persistence: boolean;
  /** The claim ties the outcome to the SAME identity (same account / signing back in). */
  identity: boolean;
  /** The claim names an action that produces the outcome (upgrade / pay / cancel / reset / ...). */
  hasAction: boolean;
};

// Values that name a SPECIFIC expected state. A requirement that keeps "Pro" is stronger than one that says
// "a plan", and the whole point of these gates is to notice when the specific value is dropped.
const VALUE_LEXICON = [
  "Pro", "Free", "Admin", "Paid", "Premium", "Plus", "Enabled", "Disabled",
  "Cancelled", "Canceled", "Deleted", "Approved", "Rejected", "Verified", "Active", "Inactive",
  "Owner", "Member", "Granted", "Revoked", "Subscribed", "Unsubscribed", "Locked", "Unlocked",
];
const PERSISTENCE_RE = /\b(retain|retains|retained|persist|persists|persisted|remain|remains|remained|still|keeps?|kept|reload|refresh|returning)\b|\bafter (signing|sign|logging|log)(\s+back)?\s+in\b|\bsigning in again\b|\bacross (new )?sessions?\b/i;
const IDENTITY_RE = /\bsame (account|credentials?|user|email|login|identity)\b|\bsign(?:ing)?(\s+back)?\s+in again\b|\bsign(?:ing)?\s+back\s+in\b|\blog(?:ging)?\s+back\s+in\b/i;
const ACTION_RE = /\b(upgrade|pays?|paid|purchase|checkout|check out|subscribe|buy|sign in|log in|sign out|log out|cancel|delete|create|save|submit|reset|change|grant|enable|disable|approve|receive)\b/i;

export function analyzeClaim(claim: string): ClaimAnalysis {
  const seen = new Set<string>();
  const namedValues: string[] = [];
  for (const v of VALUE_LEXICON) {
    const m = claim.match(new RegExp(`\\b(${v})\\b`, "i"));
    if (m && !seen.has(v.toLowerCase())) { seen.add(v.toLowerCase()); namedValues.push(m[1]); }
  }
  return {
    namedValues,
    persistence: PERSISTENCE_RE.test(claim),
    identity: IDENTITY_RE.test(claim),
    hasAction: ACTION_RE.test(claim),
  };
}

// A richer, still-deterministic breakdown of the claim, used ONLY to brief the correction model — never to
// decide sufficiency. The deciders (checkClaimCoverage / checkExecutionCoverage) remain the sole authority on
// whether a proposal is enough. Actor and action are best-effort surface reads: hints for the model, not
// facts the gate relies on.
export type ClaimObligations = ClaimAnalysis & {
  /** Who performs the action ("a customer", "an admin"). Best-effort; falls back to "a user". */
  actor: string;
  /** The action that should produce the outcome ("upgrade", "pay", "change"). Null when none is detected. */
  action: string | null;
};

export function claimObligations(claim: string): ClaimObligations {
  const a = analyzeClaim(claim);
  const actorMatch = claim.match(/\b(?:a|an|the)\s+([a-z][a-z]{2,20})\b(?=\s+(?:can|who|must|is\s+able|should|gets?|receives?|changes?|pays?|upgrades?))/i);
  const actionMatch = claim.match(ACTION_RE);
  return {
    ...a,
    actor: actorMatch ? `a ${actorMatch[1].toLowerCase()}` : "a user",
    action: actionMatch ? actionMatch[0].toLowerCase() : null,
  };
}

// ── Claim coverage: do the REQUIREMENTS preserve the claim's obligations? ─────────────────────────────────
//
// Evaluated across the WHOLE requirement set, not per requirement: one broad supporting requirement does not
// fail the set, but an obligation absent from EVERY requirement does.

export type Coverage = { ok: boolean; missing: string[]; covered: string[] };

export function checkClaimCoverage(claim: string, requirements: string[]): Coverage {
  const a = analyzeClaim(claim);
  const reqs = requirements.map((r) => r.toLowerCase());
  const missing: string[] = [];
  const covered: string[] = [];

  const mentions = (needle: string) => reqs.some((r) => r.includes(needle.toLowerCase()));

  for (const v of a.namedValues) {
    if (mentions(v)) covered.push(`value:${v}`);
    else missing.push(`No requirement preserves the expected value "${v}" (the claim names it; the requirements dropped it).`);
  }

  if (a.persistence) {
    // Some requirement must pair a named value with a persistence marker (retain/remain/after sign-in).
    const persisted = a.namedValues.some((v) => reqs.some((r) => r.includes(v.toLowerCase()) && PERSISTENCE_RE.test(r)))
      || (a.namedValues.length === 0 && reqs.some((r) => PERSISTENCE_RE.test(r)));
    if (persisted) covered.push("persistence"); else missing.push("The claim requires the state to persist, but no requirement asserts it after the persistence boundary.");
  }

  if (a.identity) {
    const idc = reqs.some((r) => IDENTITY_RE.test(r) || /same (account|user|credential|identity)/i.test(r));
    if (idc) covered.push("identity"); else missing.push("The claim ties the outcome to the same identity, but no requirement carries that condition.");
  }

  return { ok: missing.length === 0, missing, covered };
}

// ── Execution coverage: does a RUNNABLE FLOW actually prove each obligation? ──────────────────────────────

export type StepLite = { action: string; target?: string | null; value?: string | null; expect?: string | null };
export type FlowLite = { steps: StepLite[]; role?: string | null; name?: string | null };

type StepKind = "assert" | "signin" | "signout" | "purchase" | "navigate" | "action";

const SIGNOUT_RE = /\b(sign|log)\s*out\b/i;
const SIGNIN_RE = /\b(sign|log)\s*in\b/i;
const PURCHASE_RE = /\b(pay|checkout|check out|buy|purchase|upgrade|subscribe|complete (the )?(order|purchase|payment))\b/i;

// Classify a step by what it DOES, reading intent from the action and the target text. Plain journeys express
// sign-in and payment as clicks/navigations, not semantic primitives, so the target text is where the intent
// lives.
export function classifyStep(s: StepLite): StepKind {
  const action = (s.action || "").toLowerCase();
  const target = `${s.target ?? ""} ${s.value ?? ""}`;
  if (action.startsWith("assert") || action === "verify_authenticated" || action === "verify_unauthorized") return "assert";
  if (action === "sign_out" || action === "reset_context") return "signout";
  if (action === "sign_in_as" || action === "switch_role") return "signin";
  if (SIGNOUT_RE.test(target)) return "signout";                 // "Sign out" click, checked before sign-in
  if (SIGNIN_RE.test(target)) return "signin";
  if (PURCHASE_RE.test(target)) return "purchase";
  if (action === "navigate") return "navigate";
  return "action";
}

// Does an assertion step check for the named value? Only asserts count: a navigate or click TO something
// named "Pro" is not proof the state IS Pro.
function assertsValue(s: StepLite, value: string): boolean {
  if (classifyStep(s) !== "assert") return false;
  const hay = `${s.target ?? ""} ${s.expect ?? ""} ${s.value ?? ""}`.toLowerCase();
  return hay.includes(value.toLowerCase());
}

export function checkExecutionCoverage(claim: string, flows: FlowLite[]): Coverage {
  const a = analyzeClaim(claim);
  const missing: string[] = [];
  const covered: string[] = [];

  // Nothing runnable at all.
  if (!flows.length || flows.every((f) => !f.steps?.length)) {
    return { ok: false, missing: ["No runnable flow was produced, so nothing can prove the claim."], covered: [] };
  }

  for (const v of a.namedValues) {
    // 1) SOME flow asserts the value at all (not merely navigates or clicks something named for it).
    const assertedAnywhere = flows.some((f) => f.steps.some((s) => assertsValue(s, v)));
    if (!assertedAnywhere) {
      missing.push(`No flow ASSERTS the "${v}" state; a plan that only navigates to or clicks "${v}" never checks the outcome is true.`);
      continue; // the stronger checks below are moot without any assertion of the value
    }

    // 2) The value is asserted AFTER an action in the same flow. A confirmation before or without the action
    //    (a checkout success page) does not prove the account received the value.
    const assertedAfterAction = flows.some((f) => {
      const kinds = f.steps.map(classifyStep);
      const actionIdx = kinds.findIndex((k) => k === "purchase" || k === "action");
      const assertIdx = f.steps.findIndex((s) => assertsValue(s, v));
      return actionIdx !== -1 && assertIdx > actionIdx;
    });
    if (!assertedAfterAction) {
      missing.push(`The "${v}" state is never asserted AFTER the action that should produce it (a plan that stops at a success page proves nothing about the account).`);
    }

    // 3) Persistence: the value is asserted AFTER a persistence boundary (a sign-in OR a reload), so it
    //    survives a fresh session, not just the moment right after the action.
    if (a.persistence) {
      const persisted = flows.some((f) => hasAssertAfterBoundary(f, (s) => assertsValue(s, v)));
      if (!persisted) {
        missing.push(`The "${v}" state is never asserted AFTER signing back in or reloading, so persistence (which the claim requires) is not proven.`);
      }
    }
  }

  // Persistence claims whose value is DYNAMIC (a changed email, a created record) carry no lexicon value, so
  // the per-value checks above never fire. They still must assert SOMETHING after the boundary, or "it
  // remained" is unproven.
  if (a.persistence && a.namedValues.length === 0) {
    const proven = flows.some((f) => hasAssertAfterBoundary(f, (s) => classifyStep(s) === "assert"));
    if (!proven) {
      missing.push("The claim requires the state to persist, but no flow asserts anything after signing back in or reloading.");
    }
  }

  if (a.namedValues.length) covered.push("value-assertions");
  return { ok: missing.length === 0, missing, covered };
}

// A persistence boundary is a sign-in or a reload. Returns true when SOME step matching `assert` occurs after
// the first such boundary in a flow.
function hasAssertAfterBoundary(f: FlowLite, matches: (s: StepLite) => boolean): boolean {
  const boundaryIdx = f.steps.findIndex((s) => classifyStep(s) === "signin" || (s.action || "").toLowerCase() === "refresh");
  if (boundaryIdx === -1) return false;
  return f.steps.some((s, i) => i > boundaryIdx && matches(s));
}

// ── The combined pre-run gate ────────────────────────────────────────────────────────────────────────────

export type CoverageReport = {
  claim: Coverage;
  execution: Coverage;
  /** True only when BOTH gates pass. A paid browser run may begin only then. */
  readyToLaunch: boolean;
};

export function coverageReport(claim: string, requirements: string[], flows: FlowLite[]): CoverageReport {
  const claimCov = checkClaimCoverage(claim, requirements);
  const execCov = checkExecutionCoverage(claim, flows);
  return { claim: claimCov, execution: execCov, readyToLaunch: claimCov.ok && execCov.ok };
}

/** Every gap, both gates, in one flat list for a caller that just wants to know what is missing. */
export function coverageGaps(report: CoverageReport): string[] {
  return [...report.claim.missing, ...report.execution.missing];
}

// An imperative fix, derived deterministically from the claim and which gate failed. The gaps say what is
// wrong ("no flow asserts Pro after signing back in"); this says what to DO ("check the account shows Pro
// after checkout, then sign back in and check again"), phrased for the agent that built the app.
export function repairPrompt(claim: string, report: CoverageReport): string {
  const a = analyzeClaim(claim);
  const val = a.namedValues[0];
  const lines: string[] = [];

  if (!report.claim.ok) {
    lines.push("Write the requirements so they say exactly what the claim promises:");
    for (const m of report.claim.missing) lines.push(`  - ${m}`);
  }

  if (!report.execution.ok) {
    lines.push("Give the test a runnable flow that actually proves the claim, end to end:");
    if (val) {
      lines.push(`  - After the action that should grant "${val}", assert the app itself shows "${val}" (check the account, not just a success page).`);
      if (a.persistence) {
        lines.push(`  - Then ${a.identity ? "sign out and sign back in with the same account" : "reload the page"}, and assert "${val}" is still shown.`);
      }
    } else if (a.persistence) {
      lines.push(`  - After the change, ${a.identity ? "sign back in with the same account" : "reload the page"} and assert the changed value is still present.`);
    } else {
      lines.push("  - Assert the specific outcome the claim names after the action that should produce it.");
    }
  }

  return lines.join("\n");
}
