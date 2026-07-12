// Run-target URL resolution: the CORRECTNESS core of linked reruns. A run's deployment_url (the snapshot
// taken at queue time) is AUTHORITATIVE for execution; approved flows must never permanently bind future
// runs to whatever deployment URL existed when the flow was written. Every navigation is rebased onto the
// current run target: the STORED step keeps its route intent (pathname + its own params + hash), while the
// RUN TARGET supplies the origin and its query parameters OVERRIDE any conflicting stored ones (a stored
// mode=broken must lose to a run-target mode=fixed). Pure + deterministic; used by the worker at execution
// time, by the pre-execution invariant, and by the invalid-run repair tooling.

// Resolve the URL the browser must actually open for a navigation step.
//  - stored empty            -> the run target itself
//  - stored relative (/x)    -> run target origin + stored path, params merged (run target wins conflicts)
//  - stored absolute         -> run target ORIGIN + stored pathname + merged params (run target wins) + stored hash
//  - stored unparseable      -> the run target itself (never navigate somewhere undefined)
export function resolveNavigationUrl(stored: string | undefined | null, runTarget: string): string {
  let target: URL;
  try { target = new URL(runTarget); } catch { return (stored || "").trim() || runTarget; }
  const raw = (stored || "").trim();
  if (!raw) return target.href;

  let storedUrl: URL;
  try {
    storedUrl = raw.startsWith("/") ? new URL(raw, target.origin) : new URL(raw);
  } catch { return target.href; }

  const out = new URL(target.origin);
  out.pathname = storedUrl.pathname;
  // Merge: stored params first (route intent), then run-target params override conflicts and add their own.
  storedUrl.searchParams.forEach((v, k) => out.searchParams.set(k, v));
  target.searchParams.forEach((v, k) => out.searchParams.set(k, v));
  out.hash = storedUrl.hash;
  return out.href;
}

// Pre-execution invariant: the resolved first navigation must genuinely honor the run target, i.e. share
// its origin and carry every run-target query parameter with the run-target value. Returns a reason string
// when violated (the worker aborts the run as an infrastructure failure), null when honored.
export function targetInvariantViolation(resolvedFirstNav: string, runTarget: string): string | null {
  let target: URL, resolved: URL;
  try { target = new URL(runTarget); } catch { return "run_target_unparseable"; }
  try { resolved = new URL(resolvedFirstNav); } catch { return "resolved_url_unparseable"; }
  if (resolved.origin !== target.origin) return `origin_mismatch: resolved ${resolved.origin}, target ${target.origin}`;
  for (const [k, v] of target.searchParams.entries()) {
    if (resolved.searchParams.get(k) !== v) return `param_mismatch: ${k} resolved "${resolved.searchParams.get(k) ?? ""}", target "${v}"`;
  }
  return null;
}

// Repair-side detector: did an already-executed run open a URL that conflicts with its own snapshot target?
// True when origins differ or any run-target param was executed with a different value (e.g. the run said
// mode=fixed but the browser opened mode=broken). Used by the invalidation tool on historical runs.
export function executedTargetMismatch(runTarget: string | null | undefined, executedNavUrl: string | null | undefined): boolean {
  if (!runTarget || !executedNavUrl) return false;
  let target: URL, executed: URL;
  try { target = new URL(runTarget); executed = new URL(executedNavUrl); } catch { return false; }
  if (executed.origin !== target.origin) return true;
  for (const [k, v] of target.searchParams.entries()) {
    const got = executed.searchParams.get(k);
    if (got !== null && got !== v) return true;   // param present but wrong value -> definite conflict
    if (got === null) return true;                // run-target param never reached the browser
  }
  return false;
}

// Application health must come from the newest VALID FULL-COVERAGE completed pass, never from an
// invalidated / merely terminal run, and never from a targeted (partial-coverage) rerun: a targeted run
// may resolve its selected issues and read "Repair verified", but it verified a subset on its own target —
// it cannot certify or replace the application's launch decision. Preference: the newest ACTIVE run (so
// "In progress" still surfaces), else the newest completed FULL-coverage run WITH a launch decision, else
// the newest run of any state (honest fallback for empty histories). Runs finalized before coverage was
// recorded (no summary.coverage) executed their whole contract, so they count as full.
export type HealthRunLike = { state: string; decision: string | null; created_at: string; summary?: Record<string, unknown> | null };
const ACTIVE_STATES = new Set(["queued", "discovering", "running", "analyzing"]);
export function isLaunchHealthCandidate(r: HealthRunLike): boolean {
  return r.state === "completed" && r.decision != null && r.decision !== "repair_verified"
    && (r.summary?.coverage ?? "full") !== "partial";
}
export function pickHealthRun<T extends HealthRunLike>(runsNewestFirst: T[]): T | undefined {
  if (!runsNewestFirst.length) return undefined;
  const newest = runsNewestFirst[0];
  if (ACTIVE_STATES.has(newest.state) && !newest.decision) return newest;
  return runsNewestFirst.find(isLaunchHealthCandidate) ?? newest;
}
