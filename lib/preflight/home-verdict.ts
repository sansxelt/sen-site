// Pure, React-free display logic for the authenticated Home records (Design 01 Increment 4).
//
// Kept out of the presentational components so it can be unit-tested against real record shapes with no Next
// runtime. It never invents a conclusion: every label is derived from a run's persisted (state, decision).
// The only vocabulary it emits is Verified / Failed / Blocked plus the honest non-verdicts In progress and
// Not yet verified. It deliberately does NOT reuse the public-API toPublicDecision mapping: that answers the
// stricter "did this single verification fully prove the claim" question and sends a proven repair to blocked,
// whereas the operational history surface treats a verified repair as the success it is.

// A run is still in flight while it has no decision and sits in one of the worker's active states.
export const ACTIVE_RUN_STATES = new Set(["queued", "discovering", "running", "analyzing"]);

export function isActiveRun(r: { decision: string | null; state: string } | null | undefined): boolean {
  return !!r && !r.decision && ACTIVE_RUN_STATES.has(r.state);
}

export type Tone = "verified" | "failed" | "blocked" | "progress" | "unproven";
export type Verdict = { label: string; tone: Tone };

// (state, decision) -> the label for a run that EXISTS. repair_verified is a positive verdict (a targeted
// rerun that proved a repair), so it reads Verified. needs_review reads Blocked (no reliable conclusion).
// blocked reads Failed (a real critical failure). A completed run with an unrecognized decision (e.g. an infra
// failure) reads Blocked; a run with no decision that is not active never reached a verdict.
export function runVerdict(state: string, decision: string | null): Verdict {
  if (isActiveRun({ state, decision })) return { label: "In progress", tone: "progress" };
  switch (decision) {
    case "ready":
    case "repair_verified":
      return { label: "Verified", tone: "verified" };
    case "blocked":
      return { label: "Failed", tone: "failed" };
    case "needs_review":
      return { label: "Blocked", tone: "blocked" };
    default:
      return decision ? { label: "Blocked", tone: "blocked" } : { label: "Not yet verified", tone: "unproven" };
  }
}

// A system's proof-state, derived ONLY from its latest health run's decision. The data model has no
// "current deployment" flag, so we never claim a deployment is live or covered — only whether the system's
// latest verification proved it. No run at all -> Not yet verified, and it needs proof.
export type SystemProof = { verdict: Verdict; needsProof: boolean };
export function systemProof(run: { state: string; decision: string | null } | null | undefined): SystemProof {
  if (!run) return { verdict: { label: "Not yet verified", tone: "unproven" }, needsProof: true };
  return { verdict: runVerdict(run.state, run.decision), needsProof: run.decision === "blocked" || run.decision === "needs_review" };
}

// Progress language derived strictly from the persisted run state; an unknown state falls back to a general
// running phrase rather than inventing a step.
export function runningStage(state: string): string {
  switch (state) {
    case "queued": return "Queued for verification";
    case "discovering": return "Mapping the deployment";
    case "running": return "Checking the deployed workflow";
    case "analyzing": return "Finalizing the verification";
    default: return "Verifying";
  }
}

export function timeAgo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const mins = Math.round((now - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
