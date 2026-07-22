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
// Same-identity signals. Must recognize natural phrasing without lowering the bar: a requirement still has to
// NAME a same-identity condition. Two shapes qualify — "same <identity noun>" (allowing ONE intervening word,
// so "same customer identity" counts, but not an unrelated "at the same time the user…"), and a sign/log
// back-in / in-again phrase in any tense (sign, signs, signed, signing). Missing either of these was a real
// false block: a corrected requirement that said "the same customer identity" and an original one that said
// "customer signs back in" were both rejected only because of verb tense and one intervening word.
const IDENTITY_RE = /\bsame\s+(?:\w+\s+)?(accounts?|credentials?|users?|customers?|emails?|logins?|identit(?:y|ies)|persons?|people)\b|\b(?:sign|log)(?:s|ed|ing)?\s+back\s+in\b|\b(?:sign|log)(?:s|ed|ing)?\s+in\s+again\b/i;
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

// One line of the execution contract: a milestone the flow must contain, in order. `weak` marks an item that
// is present in form but too loose to count (e.g. a generic visible-text assertion instead of an exact value).
export type ChecklistItem = { label: string; ok: boolean; required: boolean; weak?: boolean };

export type Coverage = { ok: boolean; missing: string[]; covered: string[]; checklist?: ChecklistItem[] };

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
    const idc = reqs.some((r) => IDENTITY_RE.test(r));
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

// Classify a step by what it DOES, reading intent from the action and the target text. Kept for the correction
// prompts and the journey printer; the execution CONTRACT below uses finer predicates, because "there is a
// sign-in somewhere" is not the same as "credentials were filled then submitted, in order".
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

// ── Execution CONTRACT predicates (fine-grained, order-aware) ─────────────────────────────────────────────
// The former validator asked three loose questions and passed flows that never proved the guarantee. The
// contract below encodes what a purchase-and-persistence claim ACTUALLY requires, as an ordered sequence of
// milestones, and refuses anything that only touches plausible pages.

const A = (s: StepLite) => (s.action || "").toLowerCase();
const TGT = (s: StepLite) => `${s.target ?? ""}`.toLowerCase();
const VAL = (s: StepLite) => `${s.value ?? ""}`;
const EXP = (s: StepLite) => `${s.expect ?? ""}`;

const PURCHASE_REACH_RE = /\b(upgrade|get pro|see pro|see plans|view plans|choose|select|buy|pricing)\b/i;
const PURCHASE_SUBMIT_RE = /\b(pay|complete (the )?(order|purchase|payment)|place order|submit payment|start pro|confirm (payment|purchase|order)|check ?out)\b/i;
const SUCCESS_RE = /\b(payment )?success(ful)?\b|\bthank you\b|\bpayment received\b|\border confirmed\b|\bsubscription is active\b|\bnow active\b|\bpayment complete\b/i;
const ACCOUNT_SURFACE_RE = /\b(account|dashboard|profile|settings|billing)\b|\/account/i;
const EMAIL_FIELD_RE = /\b(e-?mail|username|user name|login)\b/i;
const PASSWORD_FIELD_RE = /\b(password|passcode|pass ?word|passphrase)\b/i;

// An ENTITLEMENT assertion, strictly: an assert_text with a concrete target and an expected value EXACTLY equal
// to the claimed value. A generic assert_visible of the word, or a descriptive sentence that merely contains
// it ("Plan section displays Pro"), does not count — those are static-copy matches, not a state check.
function isExactEntitlementAssert(s: StepLite, value: string): boolean {
  return A(s) === "assert_text" && !!TGT(s).trim() && EXP(s).trim().toLowerCase() === value.toLowerCase();
}
const isPurchaseReach = (s: StepLite) => A(s) === "click" && PURCHASE_REACH_RE.test(TGT(s));
const isPurchaseSubmit = (s: StepLite) => A(s) === "click" && PURCHASE_SUBMIT_RE.test(TGT(s));
const isSuccessAssert = (s: StepLite) => A(s).startsWith("assert") && SUCCESS_RE.test(`${TGT(s)} ${EXP(s).toLowerCase()}`);
const isAccountNav = (s: StepLite) => A(s) === "navigate" && ACCOUNT_SURFACE_RE.test(TGT(s));
// An explicit sign out: the session-clearing primitive, the semantic sign-out action, or a real "Sign out"
// control. Navigating to a sign-in PAGE is explicitly NOT a sign out.
const isSignout = (s: StepLite) => A(s) === "reset_context" || A(s) === "sign_out" || (A(s) === "click" && SIGNOUT_RE.test(TGT(s)));
const isEmailFill = (s: StepLite) => A(s) === "fill" && EMAIL_FIELD_RE.test(TGT(s)) && !!VAL(s).trim();
const isPasswordFill = (s: StepLite) => A(s) === "fill" && PASSWORD_FIELD_RE.test(TGT(s)) && !!VAL(s).trim();
const isSigninSubmit = (s: StepLite) => (A(s) === "click" && SIGNIN_RE.test(TGT(s))) || A(s) === "verify_authenticated";

// A CREDENTIALED sign-in proving the same identity was used. Two secret-safe shapes qualify:
//   (a) sign_in_as / switch_role  — references a sealed test account; the worker fills the stored credentials.
//   (b) fill email -> fill password -> submit, IN THAT ORDER — the flow supplies the identity it chose.
// Clicking a submit button on a pre-filled form is NOT sufficient: the app chose the identity, not the test.
// Returns the index AFTER the sign-in sequence, or -1.
function credentialedSigninEnd(steps: StepLite[], from: number): number {
  for (let i = from; i < steps.length; i++) {
    if (A(steps[i]) === "sign_in_as" || A(steps[i]) === "switch_role") return i + 1;
  }
  const ie = steps.findIndex((s, i) => i >= from && isEmailFill(s));
  if (ie === -1) return -1;
  const ip = steps.findIndex((s, i) => i > ie && isPasswordFill(s));
  if (ip === -1) return -1;
  const is = steps.findIndex((s, i) => i > ip && isSigninSubmit(s));
  return is === -1 ? -1 : is + 1;
}

// The first exact entitlement assertion at/after `from` whose most-recent preceding navigate is an account
// surface — static-copy protection: the value must be read on the authenticated account page, not on a
// pricing or marketing page that merely prints the word.
function exactEntitlementOnAccount(steps: StepLite[], from: number, value: string): number {
  for (let i = from; i < steps.length; i++) {
    if (!isExactEntitlementAssert(steps[i], value)) continue;
    let lastNav = -1;
    for (let j = i - 1; j >= 0; j--) { if (A(steps[j]) === "navigate") { lastNav = j; break; } }
    if (lastNav !== -1 && isAccountNav(steps[lastNav])) return i;
  }
  return -1;
}

// Build the ordered execution checklist for ONE flow, given the claim shape. Every required item must be
// present AND in order; a later milestone is only credited after the previous one's position.
function flowChecklist(steps: StepLite[], value: string, shape: { purchase: boolean; persistence: boolean; identity: boolean }): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  let cur = 0;
  const seq = (label: string, pred: (s: StepLite) => boolean, required = true) => {
    let idx = -1;
    for (let i = cur; i < steps.length; i++) if (pred(steps[i])) { idx = i; break; }
    const ok = idx !== -1;
    if (ok) cur = idx + 1;
    items.push({ label, ok, required });
    return idx;
  };

  if (shape.purchase) {
    seq("reaches the purchase surface/control", isPurchaseReach);
    seq("submits payment (completes checkout)", isPurchaseSubmit);
    // OPTIONAL. The proof is the entitlement assertion on the account, not a success screen. A success page is
    // often reached by a post-submit redirect the crawler never sees, so REQUIRING a success assertion forces
    // the model to guess on-page text ("checkout success") that may not exist, which fails a WORKING app. It
    // is credited when present (and it is what makes a fake_success finding legible), but never required.
    seq("observes a checkout success result", isSuccessAssert, false);
  } else {
    // Non-purchase state change (e.g. an admin grant): the producing action is the first click/fill/auth step.
    seq("performs the action that should produce the outcome", (s) => ["click", "fill", "sign_in_as", "switch_role"].includes(A(s)));
  }

  // First exact entitlement assertion, on the account surface, after everything above.
  {
    const idx = exactEntitlementOnAccount(steps, cur, value);
    const ok = idx !== -1;
    if (ok) cur = idx + 1;
    items.push({ label: `asserts the exact "${value}" value on the account surface after the action`, ok, required: true });
    // Flag a weak near-miss: the value is "asserted" but only as generic visible text, not an exact assert_text.
    if (!ok && steps.some((s) => A(s) === "assert_visible" && TGT(s).includes(value.toLowerCase()))) {
      items.push({ label: `(the "${value}" check present is a generic visible-text assertion, not an exact account-plan assertion)`, ok: false, required: false, weak: true });
    }
  }

  if (shape.persistence && shape.identity) {
    seq("performs an explicit sign out", isSignout);
    // Credentialed sign-in (compound, order-checked).
    const end = credentialedSigninEnd(steps, cur);
    const ok = end !== -1;
    if (ok) cur = end;
    items.push({ label: "signs back in with stored credentials (same account), not a bare submit click", ok, required: true });
    const idx2 = exactEntitlementOnAccount(steps, cur, value);
    items.push({ label: `asserts the exact "${value}" value AGAIN on the account surface after signing back in`, ok: idx2 !== -1, required: true });
  } else if (shape.persistence) {
    // Persistence without identity: a reload is the boundary.
    seq("reloads the page (persistence boundary)", (s) => A(s) === "refresh");
    const idx2 = exactEntitlementOnAccount(steps, cur, value);
    items.push({ label: `asserts the exact "${value}" value AGAIN after reloading`, ok: idx2 !== -1, required: true });
  }

  return items;
}

// A value-less persistence claim (a changed email, a created record): no lexicon value to assert exactly, so
// the contract is lighter — the flow must assert SOMETHING after the persistence boundary.
function valuelessPersistenceChecklist(steps: StepLite[]): ChecklistItem[] {
  const boundaryIdx = steps.findIndex((s) => classifyStep(s) === "signin" || A(s) === "refresh");
  const ok = boundaryIdx !== -1 && steps.some((s, i) => i > boundaryIdx && A(s).startsWith("assert"));
  return [{ label: "asserts the persisted state after signing back in or reloading", ok, required: true }];
}

export function checkExecutionCoverage(claim: string, flows: FlowLite[]): Coverage {
  const a = analyzeClaim(claim);

  if (!flows.length || flows.every((f) => !f.steps?.length)) {
    return { ok: false, missing: ["No runnable flow was produced, so nothing can prove the claim."], covered: [], checklist: [] };
  }

  const purchase = a.hasAction && /\b(upgrade|pay|paid|purchase|checkout|check out|buy|subscribe)\b/i.test(claim);
  const value = a.namedValues[0] || "";

  // Choose the contract by claim shape, then score EVERY flow against it and keep the strongest (the flow that
  // satisfies the most required milestones). Coverage passes only if that flow satisfies ALL required ones.
  const buildFor = (steps: StepLite[]): ChecklistItem[] =>
    value ? flowChecklist(steps, value, { purchase, persistence: a.persistence, identity: a.identity })
          : valuelessPersistenceChecklist(steps);

  let best: ChecklistItem[] = [];
  let bestScore = -1;
  for (const f of flows) {
    const cl = buildFor(f.steps);
    const score = cl.filter((c) => c.required && c.ok).length;
    if (score > bestScore) { bestScore = score; best = cl; }
  }

  const missing = best.filter((c) => c.required && !c.ok).map((c) => c.label);
  // A weak item (present-but-loose) is a failure too: it means the value was "checked" in a way that does not
  // prove entitlement. Surface it so the reason is legible.
  for (const w of best.filter((c) => c.weak)) missing.push(w.label);
  const ok = missing.length === 0 && best.every((c) => !c.required || c.ok);
  const covered = best.filter((c) => c.required && c.ok).map((c) => c.label);
  return { ok, missing, covered, checklist: best };
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
