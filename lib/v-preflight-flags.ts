// Feature flags for the Vraelis Preflight pivot (independent verification for AI-built software). Preflight ships
// dark until each phase is verified. Server flags gate route ACCESS (the real security boundary); the
// NEXT_PUBLIC_ flag only controls nav VISIBILITY so internal testers can see the surface without exposing
// it publicly. (The old AI-output checker and its VRAELIS_LEGACY_CHECKER_ENABLED flag are retired.)
//
//   VRAELIS_PREFLIGHT_ENABLED=1          publicly enabled (later phases)
//   VRAELIS_PREFLIGHT_INTERNAL_ONLY=1    A SECOND ENABLE SWITCH. It restricts nobody — see below.
//   NEXT_PUBLIC_VRAELIS_PREFLIGHT=1      show the Applications nav item (client-readable)
//   VRAELIS_RUNS_DISABLED=1              kill switch: pause NEW runs only (routes 503); history stays visible

const on = (v: string | undefined) => v === "1" || v === "true";

// Route access. Preflight is reachable when EITHER flag is set; pages redirect when neither is, so a
// guessed URL is a no-op.
//
// VRAELIS_PREFLIGHT_INTERNAL_ONLY DOES NOT RESTRICT ANYONE, and the header above used to say it was an
// "owner/allowlist, Phase 1 default", which is the kind of comment that gets believed. There was a
// preflightInternalOnly() here to express that posture and it had ZERO callers repo-wide — nothing ever
// asked it, so any signed-in account reached Preflight whenever either flag was set. It is deleted rather
// than left as a function nobody calls, because an unused predicate reads like an enforced rule.
//
// It was doubly inert in production, which is worth recording: it returned INTERNAL_ONLY && !ENABLED, and
// both vars are set there, so it would have answered false even if something had called it.
//
// The effective posture today is public-by-default for any authenticated account, with the stealth curtain
// (lib/stealth) as the actual gate on who reaches the site at all. If a real allowlist is wanted, it is new
// work — a members table and a check in v-preflight-guard — and NOT a flag that already exists. Turning one
// on and assuming it bites is how an account you meant to exclude gets in.
export function preflightEnabled(): boolean {
  return on(process.env.VRAELIS_PREFLIGHT_ENABLED) || on(process.env.VRAELIS_PREFLIGHT_INTERNAL_ONLY);
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
