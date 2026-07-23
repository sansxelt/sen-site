// Pure, React-free DISPLAY layer over the ONE canonical public-decision translator (lib/preflight/
// public-decision.ts). It holds NO decision logic of its own: runVerdict DELEGATES to toPublicDecision and
// only adds presentation metadata (a display label, a tone, and the In progress / Not yet verified wording
// for a run that has no public conclusion yet). Home and the verification result page both render through
// this, and the public API, outbound webhooks, and CI gate render through the SAME toPublicDecision, so all
// five surfaces share one contract and cannot drift — verified / failed / blocked, with repair_verified
// mapping to blocked everywhere (a targeted repair rerun did not pass the full verification scope).
import { toPublicDecision } from "./public-decision";

// A run is still in flight while it has no decision and sits in one of the worker's active states.
export const ACTIVE_RUN_STATES = new Set(["queued", "discovering", "running", "analyzing"]);

export function isActiveRun(r: { decision: string | null; state: string } | null | undefined): boolean {
  return !!r && !r.decision && ACTIVE_RUN_STATES.has(r.state);
}

export type Tone = "verified" | "failed" | "blocked" | "progress" | "unproven";
export type Verdict = { label: string; tone: Tone };

// (state, decision) -> the display verdict, delegated to the canonical translator. The three public
// conclusions map 1:1 (verified/failed/blocked); when the translator returns null the run has no public
// conclusion yet, which we present as In progress (worker still running) or Not yet verified (otherwise).
export function runVerdict(state: string, decision: string | null): Verdict {
  const pub = toPublicDecision(state, decision);
  if (pub === "verified") return { label: "Verified", tone: "verified" };
  if (pub === "failed") return { label: "Failed", tone: "failed" };
  if (pub === "blocked") return { label: "Blocked", tone: "blocked" };
  return isActiveRun({ state, decision }) ? { label: "In progress", tone: "progress" } : { label: "Not yet verified", tone: "unproven" };
}

// A system's proof-state, derived ONLY from its latest health run's public conclusion. The data model has no
// "current deployment" flag, so we never claim a deployment is live or covered — only whether the system's
// latest verification reached Verified. No run at all -> Not yet verified, and it needs proof. A run that did
// not reach Verified (failed or blocked, which includes a repair_verified partial rerun) still needs proof.
export type SystemProof = { verdict: Verdict; needsProof: boolean };
export function systemProof(run: { state: string; decision: string | null } | null | undefined): SystemProof {
  if (!run) return { verdict: { label: "Not yet verified", tone: "unproven" }, needsProof: true };
  const verdict = runVerdict(run.state, run.decision);
  return { verdict, needsProof: verdict.tone === "failed" || verdict.tone === "blocked" };
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
