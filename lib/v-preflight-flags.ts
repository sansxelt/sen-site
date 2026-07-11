// Feature flags for the Vraelis Preflight pivot (production layer for AI-built software). The old
// AI-output checker keeps working; Preflight ships dark until each phase is verified. Server flags gate
// route ACCESS (the real security boundary); the NEXT_PUBLIC_ flag only controls nav VISIBILITY so
// internal testers can see the surface without exposing it publicly.
//
//   VRAELIS_PREFLIGHT_ENABLED=1          publicly enabled (later phases)
//   VRAELIS_PREFLIGHT_INTERNAL_ONLY=1    internal-only (owner/allowlist) — Phase 1 default
//   NEXT_PUBLIC_VRAELIS_PREFLIGHT=1      show the Applications nav item (client-readable)
//   VRAELIS_LEGACY_CHECKER_ENABLED       (default on) keep the AI-output checker visible
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

// The legacy AI-output checker stays available unless explicitly turned off (so the pivot never breaks
// the shipping product mid-development).
export function legacyCheckerEnabled(): boolean {
  return process.env.VRAELIS_LEGACY_CHECKER_ENABLED !== "0";
}

// Kill switch for NEW runs only. When on, the run + rerun routes refuse to queue (503 runs_paused) while
// every existing report stays readable and the worker keeps draining already-claimed work. It never hides
// history and never touches read routes.
export function runsDisabled(): boolean {
  return process.env.VRAELIS_RUNS_DISABLED === "1";
}
