# Design 05 Phase 0C — first-viewport direction studies

Both prior visual systems were rejected (Phase 0 cream editorial ≈ 4/10; Phase 0B dark instrument ≈ 3/10, "a
generic developer-tool / observability landing page"). The engineering + interaction foundation stays accepted.

## New art-direction thesis
**Vraelis = a premium trust institution — a "Bureau of Proof" — with a powerful technical proof system inside
it.** A bright, confident, authored public world (warm document ground, big Geist display, deep authoritative
colour in large blocks). The dark technical verification lives as ONE contained artifact — a **proof chamber** —
not the whole page. Evidence is presented as **exhibits**; the verdict is an official **seal/stamp** (the ownable
brand device — a trust institution stamps things). The business message spans beyond checkout: *Vraelis
independently proves that AI-built software still does what the business requires* (tenant isolation, agent
approval gates, inventory reserved before confirm, real state change — not just the screen).

Captures: `docs/design-05/captures-0c/` — each concept at 1440×900 and 390×844. Routes:
`/dev-preview/public-v2/c0/{a,b,c,d}`. First viewport only (no later sections).

## The four concepts

### A — editorial thesis + dark proof chamber cutting through
Big bright thesis ("AI builds. Vraelis proves."), then a dark proof chamber band holding the submitted
requirement, all seven obligations resolving (three held, one broke, three not reached), Expected vs Observed,
and the "Release rejected" verdict, with the REJECTED seal stamped where the chamber meets the bright world.
- **Strengths:** the most *complete* — requirement + obligations + expected + observed + verdict all at scale;
  ~65% product story; the contained-dark-chamber-in-a-bright-institution is exactly the thesis.
- **Weaknesses:** dense; the obligation checklist can read as a "list" rather than one event; some dead space in
  the chamber's right column.

### B — requirement as a central object, surrounded by independent evidence sources
The requirement sits centre as a formal clause; six independent evidence sources flank it (real browser, payment
provider, database, account API, second identity, email) — two in CONFLICT. One requirement, six checks, one
verdict.
- **Strengths:** the most *distinctive product idea* — Vraelis cross-checks reality from many independent sources
  (the execution fabric), which no competitor communicates; makes independence the hero.
- **Weaknesses:** symmetric / centred composition (a mild template risk); doesn't show the obligations or the
  expected-vs-observed detail; the flanking-cards read a touch even.

### C — expected and observed reality splitting the viewport
A hard split: the bright left is *what the business requires* (the promise, "agent reported this as done"); the
dark right is *what Vraelis observed on the live system* (the contradiction, in red) + "Release rejected". The
seal straddles the fault line.
- **Strengths:** the most *dramatic* and the most *on-thesis* (bright company world ↔ dark proof reality); the
  best ten-second read; the seal-on-the-fault-line is a memorable, ownable moment; respects "three levels".
- **Weaknesses:** under-shows the requirement (small subline) and the obligations (none) — it stages the
  *contradiction* more than the *full proof*.

### D — the release gate (change in → proof → verdict out)
Left-to-right: the agent completes (a deploy + its claim) → the Vraelis proof gate (obligations, the break) →
"Release held" + seal. A footnote: when it holds, the release ships with the proof attached.
- **Strengths:** the clearest *operating-position* message — nothing ships on the agent's word; Vraelis sits
  between agent-completion and deployment.
- **Weaknesses:** more empty vertical space; the product story occupies less of the viewport (~50%); the
  horizontal pipeline is compact rather than commanding.

## Competitive test (Notion / Wispr / Cursor / Mercor bar)
| | A | B | C | D |
|---|---|---|---|---|
| Survives a name swap? (proprietary) | strong | strong | strong | medium |
| Not a Framer/Webflow template | yes | mild risk (symmetry) | yes | yes |
| Not observability/dev-tool | yes (institution frame) | yes | yes | yes |
| Understood in 10s | yes | yes | **yes, fastest** | yes |
| Main proof moment readable | yes | yes | **yes, biggest** | yes |
| Presence beside the references | strong | strong | **strongest** | medium |
| % product story in viewport | ~65% | ~60% | ~60% | ~50% |
| Completeness of the proof shown | **highest** | medium | lower | medium |

## Recommended winner
**Lead with C's composition, completed with A's substance.** C's bright-promise / dark-reality split with the
seal on the fault line is the most arresting, the fastest to read, and the truest expression of the "institution
+ contained proof" thesis — it makes the contradiction a *major event*, which is exactly what the rejected
signal-break failed to do. Its one gap (it under-shows the requirement and the obligations) is fixed by pulling
in A: put the **submitted requirement** as a prominent header spanning the split, and let the **obligations
resolve inside the dark "reality" side** as the check runs, culminating in the break → the observed statement →
the seal. Business breadth stays as the chips beneath.

If a single un-fused concept must be chosen, **A** is the safest — it already shows the most of the proof at
scale inside the institutional frame.

**Not recommended as the lead:** B (symmetry weakens presence, though its multi-source idea should return as a
later "how it works" section) and D (too much empty space for a first viewport, though its gate framing is the
right message for a developer/CI page).

## Remaining weaknesses to solve before implementing the winner
- The seal's outer ring text is small; needs a heavier, more legible cut (or fewer words) to read as a true
  embossed seal rather than a faint stamp.
- The requirement must carry more weight in C (currently a subline); the obligations need a home in C's dark side.
- The warm document ground is close to the rejected cream — push it slightly brighter/cooler and let the deep
  green + the dark chamber + the seal dominate so it never reads as "cream editorial".
- Motion is unproven here (these are static). The interactive build must make the check *happen* (obligations
  resolving, the split hardening at the break, the seal stamping) without becoming a thin line again.
- Mobile: the split stacks well; the header subline needs its own stacking rule; the seal placement on the seam
  needs a mobile-specific position.
