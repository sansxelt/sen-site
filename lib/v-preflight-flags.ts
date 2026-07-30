// Feature flags for the Vraelis Preflight pivot (independent verification for AI-built software). Preflight ships
// dark until each phase is verified. Server flags gate route ACCESS (the real security boundary); the
// NEXT_PUBLIC_ flag only controls nav VISIBILITY so internal testers can see the surface without exposing
// it publicly. (The old AI-output checker and its VRAELIS_LEGACY_CHECKER_ENABLED flag are retired.)
//
//   VRAELIS_PREFLIGHT_ENABLED=1          publicly enabled (later phases)
//   VRAELIS_PREFLIGHT_INTERNAL_ONLY=1    internal-only (owner/allowlist) — Phase 1 default
//   NEXT_PUBLIC_VRAELIS_PREFLIGHT=1      show the Applications nav item (client-readable)
//   VRAELIS_RUNS_DISABLED=1              kill switch: pause NEW runs only (routes 503); history stays visible

const on = (v: string | undefined) => v === "1" || v === "true";

// Route access. Preflight is reachable when it's publicly enabled OR internal-only is on. Internal-only
// is the Phase-1 posture; pages still redirect when neither is set, so a guessed URL is a no-op.
export function preflightEnabled(): boolean {
  return on(process.env.VRAELIS_PREFLIGHT_ENABLED) || on(process.env.VRAELIS_PREFLIGHT_INTERNAL_ONLY);
}
export function preflightInternalOnly(): boolean {
  return on(process.env.VRAELIS_PREFLIGHT_INTERNAL_ONLY) && !on(process.env.VRAELIS_PREFLIGHT_ENABLED);
}

// API RUNTIME surface flag. The API-runtime customer surface is a LIVE, generally-available product: it is
// on for every Preflight account by default. The one env control is a kill switch, not an enable gate —
// VRAELIS_API_RUNTIME_DISABLED=1 turns the whole surface off instantly (uniform 404) if something breaks.
// The legacy VRAELIS_API_RUNTIME_BETA_ENABLED=1 is still honored as an explicit force-ON for parity with old
// deploys, but is no longer required. Account-level scoping (if any) is decided by apiRuntimeAccessAllowed().
export function apiRuntimeEnabled(): boolean {
  if (process.env.VRAELIS_API_RUNTIME_DISABLED === "1") return false; // kill switch wins
  if (on(process.env.VRAELIS_API_RUNTIME_BETA_ENABLED)) return true;   // legacy explicit force-on
  return preflightEnabled(); // live by default wherever Preflight itself is enabled
}

// Kill switch for NEW runs only. When on, the run + rerun routes refuse to queue (503 runs_paused) while
// every existing report stays readable and the worker keeps draining already-claimed work. It never hides
// history and never touches read routes.
export function runsDisabled(): boolean {
  return process.env.VRAELIS_RUNS_DISABLED === "1";
}
