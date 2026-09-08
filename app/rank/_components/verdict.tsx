// THE PRODUCT'S ONE SIGNAL, BUILT ONCE.
//
// Verified / Failed / Blocked is the only thing this product sells, and it was implemented separately on
// eight surfaces: app/rank/app/systems/page.tsx, systems/[id]/page.tsx, systems/[id]/passes/page.tsx,
// systems/[id]/deployments/page.tsx, deployments/page.tsx, passes/page.tsx, repairs/page.tsx and
// systems/[id]/guarantee-ui.tsx. They did not agree, and a customer could see the disagreement:
//
//   COLOUR. systems/page.tsx, the most visited list in the app, painted Failed with rgba(194,84,12,...)
//   and Blocked with rgba(194,131,26,...). Those are the CREAM theme's inks, hardcoded into a graphite
//   surface, so the same run rendered a visibly different pill depending on which page you opened. It also
//   painted In progress in --acc-deep, which resolves to #FAFAFA, the headline white, so a run that had
//   not finished looked louder than one that had.
//
//   WORDS. The state where nothing has been proven yet had four names across those files: "Not tested",
//   "No verdict", "No decision" and "Not yet verified". lib/preflight/home-verdict.ts had already decided
//   it was "Not yet verified"; the pages simply were not asking it.
//
//   SIZE. .pill declares var(--fs-micro) and 103 of its 111 uses overrode it, at 9.5 / 10 / 10.5 / 11 /
//   12.5px, so one badge rendered at 8.5 effective pixels on one page and 11.1 on another.
//
//   SHAPE. Blocked and Failed both carried I.x, separating the two by amber against orange alone. That is
//   the hardest pair to tell apart with a red-green deficiency, and it contradicts the token file's own
//   statement that Blocked "is the honest third answer, not a failure". Blocked now carries its own mark.
//
// This component holds NO decision logic. It renders runVerdict(), which delegates to toPublicDecision,
// which is the same function the public API, the CI gate and the outbound webhooks answer from. A surface
// that renders <Verdict> cannot invent a fifth vocabulary, cannot drift on colour, and cannot decide for
// itself that a repair rerun counts as Verified.
import type { CSSProperties } from "react";
import { runVerdict, type Tone, type Verdict as VerdictValue } from "@/lib/preflight/home-verdict";
import { Ic, I } from "./icons";

/** Ink, wash, line and mark for each tone, from the canonical signal tokens in authenticated.css.
 *
 *  The two undecided tones are deliberately NEUTRAL rather than coloured. A run still in flight and a
 *  system nobody has checked are not states the reader should be alarmed by, and spending a signal colour
 *  on them is what left the product with no colour budget for the three that matter. */
const TONE: Record<Tone, { ink: string; wash: string; line: string; mark: string | null }> = {
  verified: { ink: "var(--go-ink)",   wash: "var(--go-wash)",   line: "var(--go-line)",   mark: I.check },
  failed:   { ink: "var(--stop-ink)", wash: "var(--stop-wash)", line: "var(--stop-line)", mark: I.x },
  blocked:  { ink: "var(--wait-ink)", wash: "var(--wait-wash)", line: "var(--wait-line)", mark: I.slash },
  progress: { ink: "var(--fg-3)",     wash: "var(--bg-2)",      line: "var(--line-2)",    mark: I.clock },
  unproven: { ink: "var(--fg-3)",     wash: "var(--bg-2)",      line: "var(--line-2)",    mark: null },
};

/** Two sizes, and only two. Every intermediate value in the old implementations existed to compensate for
 *  the shell's global zoom rather than to say anything. */
const SIZE = {
  sm: { fontSize: 11, padding: "3px 8px", gap: 5, mark: 11 },
  md: { fontSize: 12.5, padding: "5px 11px", gap: 6, mark: 13 },
} as const;

export type VerdictProps = {
  /** The run's state and decision. The component derives the public conclusion itself so a caller cannot
   *  pass one it decided on its own. */
  state?: string;
  decision?: string | null;
  /** An already-derived verdict, for callers that hold one (systemProof, guarantee status). */
  verdict?: VerdictValue;
  size?: keyof typeof SIZE;
  style?: CSSProperties;
};

export function Verdict({ state, decision = null, verdict, size = "sm", style }: VerdictProps) {
  const v = verdict ?? runVerdict(state ?? "", decision);
  const t = TONE[v.tone];
  const s = SIZE[size];
  return (
    <span
      className="verdict"
      // The label is the meaning; the mark reinforces it and the colour is third. Read aloud, this is the
      // same three words it is on screen, which is the property colour alone cannot give it.
      style={{
        display: "inline-flex", alignItems: "center", gap: s.gap,
        fontSize: s.fontSize, fontWeight: 600, lineHeight: 1.2, whiteSpace: "nowrap",
        padding: s.padding, borderRadius: 999,
        color: t.ink, background: t.wash, border: `1px solid ${t.line}`,
        ...style,
      }}
    >
      {t.mark ? <Ic d={t.mark} size={s.mark} sw={2.4} /> : null}
      {v.label}
    </span>
  );
}
