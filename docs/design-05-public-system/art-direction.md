# Art direction — static artboards (design-05)

Branch `feature/design-05-public-artboards`, from `main` (28a5db8f). Three full-screen static compositions
at `/dev-preview/artboards`, authored independently for desktop (1440×900) and mobile (390×844). No scroll
narrative, no motion beyond CSS hover. The still frame carries the quality. Nothing merged, nothing indexed.

## The visual language: evidence as monument

Vraelis's whole product is independent **proof**. So the design language treats real proof — an observed
browser state, a held requirement, a colossal verdict, a preserved record — as an **authoritative monument**,
never a dashboard card. This is what makes a frame unmistakably Vraelis instead of "an AI startup after
changing the logo."

- **White-first.** Warm paper `#FAF8F4`, near-black ink `#16150F`. One contained near-black execution field
  `#0C111C` used only where technical proof lives (the observed live software), oversized and bled off the
  frame — never a small card.
- **Colour is a verdict.** Emerald `#0A7B54` = Verified / the standing line. Clay `#A8452A` = Failed. Each
  used once per frame, decisively. No gradients on type.
- **One authoritative sans** (Geist) at monumental scale for the thesis, the requirement, and the verdicts.
  Mono (Geist Mono) only for machine text — deployment IDs, evidence values, labels — but present and
  confident, set like a record, not a timid caption.
- **Minimal rounding, very few borders.** Structure comes from hairline rules, scale, and a spine, not boxes.
- **Every empty area has a counterweight.** A monumental requirement is answered by a colossal verdict; a
  bare field is answered by real forensic evidence.

## Per-artboard rationale

**1. Homepage opening.** The thesis "AI can build the software. It cannot prove itself." sits on paper on the
left; a dominant dark execution field on the right shows the live software *observed in a real browser* —
`account.plan` returned to clay **Free**, `entitlement.pro` **inactive** — resolving to the monumental
confrontation **Expected Pro. Observed Free.** The dark evidence leads (≈58% of the frame), so the frame reads
as evidence-led, not a balanced marketing split. One CTA. The unmistakable element is the expected-versus-
observed couplet — the literal shape of a verification, which no generic SaaS hero has.

**2. Production proof.** One requirement, held across two deployments, dominates the top. A slim
`8f21ad → 72c98e` track states "one requirement, two deployments," then the story splits into a before/after:
the agent reported success, Vraelis observed the account return to Free → colossal clay **Failed** (8f21ad,
preserved); the repair was independently re-checked → colossal emerald **Verified** (72c98e, current). The two
giant verdicts are the editorial objects; the unchanged requirement visually dominates the mutable deployment
detail, exactly as the proof requires.

**3. The Guarantee object.** An emerald spine down the left *is* the durable object — "the line the agent
cannot cross" — and it carries the preserved proof history as nodes (a clay **Failed** node at 8f21ad, an
emerald **Verified** node at 72c98e current). The requirement is the object's face, with its current
**Verified** status bound directly beneath it, and a two-field record (approved once by a person; a reviewed
proof plan) at the base. It is deliberately not a card, a form, or an eight-stage list: it reads as a standing
instrument with a history, which is what distinguishes a Guarantee from a renamed test case.

## Static critique (isolated reviewer) and what changed

An isolated adversarial reviewer scored the first cut against the founder's rejection list: Homepage 5.5,
Proof 7, Guarantee 5. Acted on:

- **Homepage** was a balanced 50/50 split with a dead right band, an invisible dark-on-dark CTA, and a
  two-tone headline (read as gradient). Fixed: dark evidence now dominates, the expected/observed punch is the
  right-field payload, the duplicate CTA is gone, the headline is solid. On mobile the dark evidence became a
  rounded card (a rejection trigger) — it is now a full-bleed evidence field.
- **Proof** had a dead band between the requirement and the verdicts. Fixed with the two-deployment track and
  a tighter gap; a central spine makes the before/after explicit.
- **Guarantee** was sparse "empty typography" with a floating, disconnected Verified. Fixed: the spine is now
  load-bearing (carries the history as nodes), Verified is bound to the requirement, and the record is denser.

## Honest weaknesses

- **Homepage** still resolves as two vertical fields meeting at a hard seam. It is now evidence-led rather
  than a generic split, but the two halves are not yet locked by an element bleeding across the seam.
- **Grammar drift across the three.** They share one vocabulary (face, palette, mono ledger, decisive
  emerald/clay) but three compositional logics — a light/dark split, an all-light diptych, a spine object.
  The dark execution field appears heavily only on the Homepage. A committed system would enforce one
  background logic and one verdict scale across all routes.
- **Vertical breathing room** on the Guarantee (desktop) and lower thirds on mobile still read as generous;
  intentional given the "standing object" idea, but a hair sparse.
- These are art-direction stills, not a system. Type ramp, exact spacing scale, and component behaviour are
  deliberately deferred until a direction is approved.
