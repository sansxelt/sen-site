// Test-boundary policy for Preflight runs. PURE and shared by web + worker: no DB, no Next, no vendor
// SDK — the worker evaluates these rules before EVERY step, and the web side uses the same types +
// normalization for storage and display.
//
// Design (S5), with the backward-compatibility rule stated honestly:
//
//   Existing applications have NO boundaries recorded (v_applications.test_boundaries may be null) and
//   their approved flows do plain navigate/fill/click/assert on the run target. Enforcement is therefore
//   split into two kinds of rules:
//
//   1. HARD, RELIABLE denials — always enforced:
//      - The ORIGIN rule: a navigation that would leave the run target's origin is refused unless the
//        destination host is in allowed_domains. (With today's executor every stored navigation is
//        REBASED onto the run target's origin by resolveNavigationUrl, so this gate is a safety net for
//        the unparseable-target edge and for future semantic actions that may leave the origin — it can
//        never fire on an existing same-origin flow.)
//      - The fixed NEVER-rules: destructive deletion patterns ("delete account", "delete all", ...) are
//        refused regardless of permits. These are product invariants, not toggles.
//
//   2. PERMIT-governed SIDE-EFFECT classes — detected semantically from click/press targets using the
//      conservative pattern tables below: account creation, test purchases, email sending, file upload.
//      Plain fill/click/assert/navigate/refresh within the allowed origin are CORE actions and are ALWAYS
//      allowed — permits do not gate them (otherwise every existing approved flow would break).
//
//   Honest limits of this layer (documented, not hidden):
//   - permit_db_writes cannot be enforced from browser steps: every form submit is potentially a DB
//     write, so refusing on it would block everything. Where a permit-governed class cannot be detected
//     reliably we do NOT block (a false block on launch day is worse than a missed block; the hard
//     denials above ARE reliable). The permit still exists as recorded owner intent.
//   - Live payments are indistinguishable from test purchases at this layer, so purchases are governed
//     by permit_test_purchases and the run preview copy states purchases must be test-mode.

// ── Boundaries shape + normalization (moved verbatim from connections-db, which re-exports) ───────────

// Conservative-by-default test boundaries: every permit OFF until the owner turns it on. The fixed
// never-rules (no destructive actions, no live payment methods, no production-data deletion) are product
// invariants, not toggles, so they are not stored here.
export type TestBoundaries = {
  allowed_domains: string[];
  permit_account_creation: boolean; permit_db_writes: boolean; permit_email: boolean;
  permit_test_purchases: boolean; permit_file_upload: boolean;
};
export const DEFAULT_BOUNDARIES: TestBoundaries = {
  allowed_domains: [],
  permit_account_creation: false, permit_db_writes: false, permit_email: false,
  permit_test_purchases: false, permit_file_upload: false,
};
export function normalizeBoundaries(raw: unknown): TestBoundaries {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    allowed_domains: Array.isArray(r.allowed_domains)
      ? r.allowed_domains.filter((x): x is string => typeof x === "string").map((x) => x.trim().toLowerCase().slice(0, 253)).filter(Boolean).slice(0, 20)
      : [],
    permit_account_creation: r.permit_account_creation === true,
    permit_db_writes: r.permit_db_writes === true,
    permit_email: r.permit_email === true,
    permit_test_purchases: r.permit_test_purchases === true,
    permit_file_upload: r.permit_file_upload === true,
  };
}

// ── Step classification ───────────────────────────────────────────────────────────────────────────────

export type BoundaryActionClass =
  | "core"                  // plain navigate/fill/click/assert/... on the run target: always allowed
  | "external_navigation"   // a navigation whose resolved URL leaves the run target's origin
  | "account_creation" | "purchase" | "email" | "file_upload"; // permit-governed side-effect classes

export type StepClassification = {
  class: BoundaryActionClass;
  destructive: boolean;     // matched a fixed never-rule pattern (refused regardless of permits)
  matched?: string;         // what the pattern matched (for the refusal reason; owner-safe text)
  host?: string;            // external_navigation: the foreign hostname
};

// Only steps that TRIGGER something can produce a side effect. Typing into a field (fill), reading
// (assert_*/wait_for), refresh, select/check on the target origin are core: a fill whose label mentions
// "sign up" has not created anything until a click submits it.
const TRIGGER_ACTIONS = new Set(["click", "press"]);

// Conservative pattern tables. These match explicit action LABELS (semantic accessible names), chosen so
// benign existing targets ("Create project", "Sign in", "Add task") can never match. Missed detections
// are accepted by design; the hard denials above do not depend on these.
const DESTRUCTIVE_RE = /\b(delete\s+(my\s+|the\s+|this\s+)?account|delete\s+(all|everything)|erase\s+(all|everything)|wipe\s+(all|everything|data)|factory\s+reset|permanently\s+delete|drop\s+table)\b/i;
const ACCOUNT_CREATION_RE = /\b(sign[\s_-]?up|register\b|create\s+(an?\s+|my\s+|new\s+|your\s+)*account\b|join\s+now)\b/i;
const PURCHASE_RE = /\b(check\s?out|buy\s+now|pay\s+now|purchase\b|place\s+(the\s+|an?\s+)?order|complete\s+(the\s+)?(order|purchase))\b/i;
const EMAIL_RE = /\b(send\s+(an?\s+|the\s+|this\s+)?(e-?mail|invite|invitation|newsletter)|e-?mail\s+(all|everyone))\b/i;
const FILE_UPLOAD_RE = /\b(upload\b|attach\s+(a\s+)?file|choose\s+file)\b/i;

// Classify one step BEFORE it executes. For navigations the caller passes the ALREADY-RESOLVED target
// (resolveNavigationUrl output — where the browser will actually go), plus the run target's origin
// (null when the run target itself is unparseable).
export function classifyStepAction(
  step: { action: string; target?: string; value?: string },
  resolvedTarget: string | undefined,
  runTargetOrigin: string | null,
): StepClassification {
  if (step.action === "navigate") {
    const raw = (resolvedTarget ?? step.target ?? "").trim();
    // Only an ABSOLUTE resolved URL can leave the origin; relative paths stay on the target by
    // construction. An unparseable value falls through to core (it never navigates anywhere defined).
    if (/^https?:\/\//i.test(raw)) {
      try {
        const u = new URL(raw);
        if (runTargetOrigin === null || u.origin !== runTargetOrigin) {
          return { class: "external_navigation", destructive: false, host: u.hostname, matched: u.origin };
        }
      } catch { /* fall through to core */ }
    }
    return { class: "core", destructive: false };
  }

  if (!TRIGGER_ACTIONS.has(step.action)) return { class: "core", destructive: false };

  const text = `${step.target ?? ""} ${step.value ?? ""}`.trim();
  const destructive = DESTRUCTIVE_RE.test(text);
  const label = (re: RegExp) => text.match(re)?.[0];

  let matched: string | undefined;
  if ((matched = label(ACCOUNT_CREATION_RE))) return { class: "account_creation", destructive, matched };
  if ((matched = label(PURCHASE_RE))) return { class: "purchase", destructive, matched };
  if ((matched = label(EMAIL_RE))) return { class: "email", destructive, matched };
  if ((matched = label(FILE_UPLOAD_RE))) return { class: "file_upload", destructive, matched };
  return { class: "core", destructive, matched: destructive ? label(DESTRUCTIVE_RE) : undefined };
}

// ── Boundary evaluation ───────────────────────────────────────────────────────────────────────────────

export type BoundaryVerdict = { allowed: true } | { allowed: false; permit: string; reason: string };

const PERMIT_FOR_CLASS: Partial<Record<BoundaryActionClass, { permit: keyof TestBoundaries & string; noun: string }>> = {
  account_creation: { permit: "permit_account_creation", noun: "account creation" },
  purchase: { permit: "permit_test_purchases", noun: "a test purchase" },
  email: { permit: "permit_email", noun: "sending email" },
  file_upload: { permit: "permit_file_upload", noun: "a file upload" },
};

// Evaluate one classified step against the application's boundaries. `boundaries` null means the
// application predates boundary recording (or the column is unapplied): treated as the most conservative
// policy (DEFAULT_BOUNDARIES — every permit off, no extra domains). That is still fully backward
// compatible because CORE actions — everything existing approved flows do — are always allowed.
export function evaluateBoundary(boundaries: TestBoundaries | null, c: StepClassification): BoundaryVerdict {
  // Fixed never-rules first: destructive deletion is refused regardless of any permit.
  if (c.destructive) {
    return { allowed: false, permit: "none", reason: `destructive action ("${c.matched ?? "delete"}") is never performed by Vraelis, regardless of permits` };
  }
  if (c.class === "core") return { allowed: true };

  const b = boundaries ?? DEFAULT_BOUNDARIES;

  if (c.class === "external_navigation") {
    const host = (c.host ?? "").toLowerCase();
    const listed = b.allowed_domains.some((d) => host === d || host.endsWith(`.${d}`));
    if (listed) return { allowed: true };
    return {
      allowed: false, permit: "allowed_domains",
      reason: `navigation to ${host || "an external origin"} leaves the run target and is not in allowed_domains`,
    };
  }

  const gate = PERMIT_FOR_CLASS[c.class];
  if (!gate) return { allowed: true };   // unreachable today; fail open per the false-block rule
  if (b[gate.permit] === true) return { allowed: true };
  return {
    allowed: false, permit: gate.permit,
    reason: `"${c.matched ?? c.class}" requires ${gate.permit} (${gate.noun}), which this application's test boundaries do not grant`,
  };
}
