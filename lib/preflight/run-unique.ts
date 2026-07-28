// A PROOF THAT PASSES WITHOUT THE APP DOING ANYTHING IS NOT A PROOF.
//
// The synthesis already knows to assert the outcome rather than the furniture: after creating something,
// assert the value you typed, because a heading is still on the page when nothing was saved. That closed
// the obvious hole and left a quieter one.
//
// A plan types a FIXED value. Run 1 creates "Vraelis check". Run 2 types "Vraelis check", the app's save
// is broken and writes nothing, and the assertion finds run 1's row still sitting in the list. Verified.
// The app is broken and the verdict says it works, which is the exact defect this product exists to catch,
// occurring inside this product. It is worse than a missed defect: a false Verified is the only failure
// that makes every other verdict worth less.
//
// The fix is that each run writes something no previous run could have written. A plan carries the
// PLACEHOLDER; the run substitutes a token derived from its own id at execution time.
//
// WHY A PLACEHOLDER AND NOT A GENERATED VALUE AT MINT TIME:
// the approved plan is immutable and hash-bound (reviewed-plan binding: paid execution consumes exactly
// what a human reviewed). A value baked in at minting would be fixed for every run that plan ever serves,
// which is the bug. A value regenerated per run would change the plan text and break the hash. The
// placeholder is stable in the plan and fresh in the run, so both hold at once.
//
// This is the same shape as resolveNavigationUrl: the stored step keeps its intent, execution resolves it
// against the run. Navigations rebase onto the run's target; written values bind to the run's identity.

// What an author (or the synthesis) writes in a plan. Deliberately readable: someone reviewing a plan sees
// `Vraelis note {{unique}}` and understands that every run writes a different one.
export const UNIQUE_PLACEHOLDER = "{{unique}}";

// The token a run substitutes. Derived from the run id rather than randomness, so:
//   - the fill and the assert inside one run always agree, including across retries and across flows;
//   - the value is TRACEABLE. Someone finding `vr-3f9a2b71` in their own database can look up exactly
//     which verification wrote it, which matters because this product writes into a customer's real app.
//   - nothing here needs a clock or a random source, so a plan rehearsal is reproducible.
//
// A rerun is a NEW run with a new id and therefore a new token, which is correct: a rerun has to prove the
// app works NOW, not that a row from the original run is still lying around.
export function runUniqueToken(runId: string): string {
  const hex = String(runId).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  // Short enough to fit a title field beside real text, long enough that two runs never collide in
  // practice. Falls back to the whole id when it is shorter than the slice.
  return `vr-${hex.slice(0, 8) || "unknown"}`;
}

export function containsPlaceholder(s: string | undefined | null): boolean {
  return typeof s === "string" && s.includes(UNIQUE_PLACEHOLDER);
}

// Substitute every placeholder in the fields a step can carry. target is included because a flow often
// clicks the thing it just made ("open the note named ..."), and expect because the assertion has to look
// for the same text the fill typed.
export function applyRunUnique<T extends { target?: string; value?: string; expect?: string }>(step: T, token: string): T {
  const sub = (s: string | undefined) => (s === undefined ? undefined : s.split(UNIQUE_PLACEHOLDER).join(token));
  if (!containsPlaceholder(step.target) && !containsPlaceholder(step.value) && !containsPlaceholder(step.expect)) return step;
  return { ...step, target: sub(step.target), value: sub(step.value), expect: sub(step.expect) };
}

// ── Detecting the shape that is still unsafe ─────────────────────────────────────────────────────────
//
// A fill types a fixed literal and a later assertion looks for that same literal. The assertion cannot
// distinguish "this run saved it" from "some earlier run saved it", so it can pass against an application
// that has stopped saving entirely.
//
// NOT every match is a defect: `fill "Search" value="invoice"` then asserting "invoice" is a read of data
// the run never claimed to create, and demanding uniqueness there would be wrong. That ambiguity is why
// this REPORTS rather than refuses on its own. The caller decides: plan rehearsal, which executes against
// the live app and has no billing consequence, is where refusing is safe.
export type FixedValueRisk = { value: string; filledAt: number; assertedAt: number };

export function fixedValueAssertions(steps: { action: string; target?: string; value?: string; expect?: string }[]): FixedValueRisk[] {
  const risks: FixedValueRisk[] = [];
  steps.forEach((s, i) => {
    if (s.action !== "fill") return;
    const typed = (s.value ?? "").trim();
    // A placeholder means the run already binds this value to itself: nothing to report.
    if (!typed || containsPlaceholder(typed)) return;
    // Only a LATER assertion matters. An assertion before the fill is asserting something else.
    const j = steps.findIndex((t, k) =>
      k > i
      && (t.action === "assert_text" || t.action === "assert_visible")
      && [t.expect, t.target].some((f) => typeof f === "string" && f.trim() === typed));
    if (j >= 0) risks.push({ value: typed, filledAt: i, assertedAt: j });
  });
  return risks;
}
