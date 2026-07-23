# Design 05 Phase 0B — design notes (working)

Phase 0 rejected (4/10): flat cream + centered copy + subordinate console = template. Engineering foundation
(fixtures, ProofConsole state model, interactions, a11y, reduced-motion) accepted.

## New direction: dark verification instrument
- Vraelis's own token DNA (tokens.css) = "instrument-grade: dark, technical, instrumentation not marketing."
- Verification metaphor = a test bench / oscilloscope: a signal that HOLDS or BREAKS.
- The product demonstration IS the hero and fills the first viewport.
- Drama via scale + depth + glow + a real compositional BREAK at the failing obligation (not a recolored ring).
- Drop the decorative Instrument Serif italic. Geist Sans (huge, tight) + JetBrains Mono (instrument voice).
- Color quarantined to the verdict, now GLOWING on dark: emerald held, red broken.
- Dark scene resolves toward light for calmer copy (dark/light transition, sanctioned by the founder).

## Three concepts (structurally different)
- A — Interception ring (radial): huge gapped ring; agent claim at center; obligations pip the circumference;
  ring fractures at the failing angle; callout pulls to Expected/Observed. Ring-dominant.
- B — Signal break (horizontal split): full-width proof trace; the agent's flat "done" signal enters; obligations
  tick; at ob-4 the trace DROPS and the page fractures into EXPECTED (upper) / OBSERVED (lower); verdict right.
- C — Records stack (depth/sequence): three record slabs in receding depth; front = Failed w/ contradiction;
  repair + Verified recede behind, connected by a spine. Lineage-as-composition.

## Outcome (selected + implemented)
- **Selected Concept B (signal break)** for the flagship hero — it delivers the brief most literally: the claim
  enters, the proof trace holds then visibly BREAKS at the exact failing obligation, and the page fractures into
  Expected vs Observed in large legible type. Concept A (ring) was strong but the break sat awkwardly and packets
  overlapped; Concept C (records stack) was more static — so C's content became **section two** (the evolving
  lineage), pairing the two best ideas in their right roles.
- Built the full interactive first two sections (reusing the ProofConsole state model): the signal-break flagship
  (claim input beside a full-width proof trace that breaks; Expected/Observed fracture; live verdict; progressive
  disclosure of the full obligation list) + the evolving-records lineage (three connected panels with repair
  transitions; a later Verified never overwrites an earlier failure).
- Fixes during build: claim packet moved BESIDE the trace (it was hiding the held pips); obligation `tag`s added
  so the trace labels read cleanly without overlap. Verdict is the only glowing color; Failed = red break,
  Verified = complete emerald trace.
- Verified: 0 console errors; 0px horizontal overflow at 1440/1280/1024/768/430/390/320; keyboard play/pause + tab
  semantics; polite live region; one h1; 7 focusable pips; reduced-motion holds the resolved frame; `next build`
  compiles for production.

## Tried / rejected
- (Phase 0) centered hero over dashboard, two comparison cards, cream+serif flourish, tiny console — all too template.
- Claim packet overlapping the trace (hid the held obligations) — moved beside the trace.
- Full obligation sentences as trace labels (overlapped) — replaced with short tags.
