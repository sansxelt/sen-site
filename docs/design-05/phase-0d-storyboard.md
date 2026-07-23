# Design 05 Phase 0D — cinematic proof storyboard

Phase 0C rejected (~4.25/10). The failure was process: references were translated into typography/cards/color
instead of a proprietary product world. This phase designs **one flagship moment** — the moment Vraelis proves an
AI-built app wrong — as a 10-frame film, using **real product surfaces as the actors**.

Frames rendered and captured at 1440×900 (desktop) and 390×844 (mobile): `docs/design-05/storyboard-0d/`
(`sb-f1..f10`). Routes: `/dev-preview/public-v2/sb/f1..f10`. These are storyboard art, not an interactive build.

## The world — "the Proof Arena"
A deep, warm-graphite stage with directional light and volumetric depth (not flat, not a grid). The **actors are
real product interfaces** — believable organization apps, at scale, floating at depth. Vraelis's own energy is a
live emerald; a violation is hot vermilion; the business invariant is a fixed luminous law. No cream, no seals, no
"Bureau", no dashboards, no thin traces. The hero invariant is **tenant isolation**, not checkout.

## Visual-object system (the proprietary language)
| Object | What it is | How it reads |
| --- | --- | --- |
| **AI change packet** | a tangible release object carrying the agent's claim + deploy ref, emerald edge | a thing that MOVES through the system; repair variant has a gold edge |
| **Business invariant** | a fixed, luminous inscribed law, gold, anchored outside the code | the promise the code must keep — it never moves |
| **Org world** | a real product surface: one organization's live data view, seen as one of its users | the actor; bright light UI against the dark stage; can show a foreign (red) row |
| **Fresh identity** | an identity token Vraelis spawns (User A/B/C/D, fresh session id) | proof that Vraelis builds its own challenge, not the agent's setup |
| **Tenant boundary** | the luminous gold line between two org worlds; turns vermilion when broken | the thing that must hold |
| **Execution / reach** | a live traced request; the breach is a red reach crossing the boundary | the forbidden action happening |
| **Evidence** | independent sources (identity, record owner, API, browser DOM) pinned to a point | the contradiction reconciled — not an opinion |
| **Release decision** | a gate the change passes (verified) or is repelled by (rejected) — never a stamp | the outcome as a physical event |
| **Proof record** | a preserved ledger slab (rejected = red edge, verified = emerald edge) | permanent history; a later pass never erases an earlier failure |
| **Reverification lineage** | the growing row of records over time | the cycle; the proof cannot be memorized |

## The 10 frames
Each: **copy · composition · objects · transition out · motion · what the visitor understands.**

1. **AI builds. Vraelis proves.** — thesis large; an Org world floats at depth, a change packet ("Tenant permissions
   fixed.") arrives. *Transition:* the packet slides into verification. *Motion:* packet drifts in, arena parallax.
   *Understands:* an agent shipped a change and called it done; Vraelis is about to check.
2. **The claim meets the requirement** — the change packet (the agent's word) vs the invariant law ("Users can only
   access data belonging to their own organization"), a thread between. *Transition:* Vraelis reads the requirement.
   *Motion:* the law ignites. *Understands:* the requirement lives outside the code, independent of the agent.
3. **Vraelis builds the challenge** — two org worlds materialize (A, B) with fresh identities (User A/B), intact gold
   boundary. *Transition:* sessions go live. *Motion:* worlds assemble, identities spawn. *Understands:* Vraelis
   builds its own isolated environment — nothing the agent supplied.
4. **Parallel challenge running** — both worlds executing; a Vraelis challenge engine mid-run; boundary under load.
   *Transition:* one challenge targets the boundary. *Motion:* requests fire from both sides. *Understands:* Vraelis
   drives the real product from every side at once.
5. **The breach** *(the signature)* — User A's real screen shows an Org B record (a red foreign row); the boundary
   breaks; a red reach crosses it; evidence begins to converge; "Cross-tenant access observed." *Transition:* freeze.
   *Motion:* the reach snaps across, the boundary ruptures, everything stills. *Understands:* the live system
   violated the invariant — shown IN the product, not asserted.
6. **Frozen at the violation** — the breach frozen; five independent sources reconciled on the contradiction.
   *Transition:* to the decision. *Motion:* sources pin in, the scene desaturates around the lit contradiction.
   *Understands:* the contradiction is undeniable, agreed by identity, record owner, API, and browser.
7. **Release rejected** — the change packet held at a vermilion gate; "Release rejected. This change does not ship."
   *Transition:* the rejected change falls to history. *Motion:* the packet is repelled at the gate. *Understands:*
   Vraelis stops the release — nothing ships on the agent's word.
8. **Kept in history** — the rejected release lands as a permanent proof record in a dimensional ledger. *Transition:*
   the agent responds. *Motion:* the record drops and seals into the stack. *Understands:* nothing is overwritten;
   the failure is preserved with all its evidence.
9. **The agent tries again** — a repair packet (gold edge) enters beside the preserved failure. *Transition:* a new
   challenge is built. *Motion:* repair arrives, history holds behind. *Understands:* the agent repairs; Vraelis will
   not re-run the same trace.
10. **Never the same test twice** — new identities (User C/D), a different valid path (direct URL, reused token,
    delayed re-auth), the record lineage growing (rejected → rejected → re-verifying). *Motion:* fresh challenge
    spins up; the lineage extends. *Understands:* every release is challenged fresh; the proof can't be memorized;
    the record grows either way.

## Transition & motion specification
- **Camera, not slides.** The film reads as one camera moving through a single dimensional space; frames 3-6 share
  the same two-world stage from moving vantage points (assemble → run → breach → freeze).
- **Objects carry state between frames.** The same change packet from F1 is the thing rejected in F7 and preserved
  in F8; the same two worlds are built in F3 and breached in F5.
- **Three motion registers:** ambient (slow arena parallax + volumetric drift), functional (packets moving, requests
  firing, the reach crossing, the record dropping — all reflecting real state), and the **freeze** (F5→F6: hard
  stop, desaturate, the contradiction stays lit). Emerald = Vraelis acting; vermilion = a violation; gold = the law.
- **Pacing:** F1-4 build with rising density; F5 is the hit (fast, then dead stop); F6-7 are heavy and slow; F8-10
  resolve and re-open the loop. Reduced-motion: the film holds each frame's resolved state; no auto-play.

## Ten-second comprehension test (copy hidden)
Watching frames 1 → 5 → 7 with body copy hidden, a visitor sees: an AI change enters a system → Vraelis builds two
isolated organizations with its own users → **User A's screen fills with an Organization B file, glowing red, and a
line tears across the boundary** → the change is stopped at a gate. The takeaway without reading a word: *the agent
said it was fixed; Vraelis ran the real product and caught it letting one company read another's data; the release
was rejected.* That is the moment — the forbidden thing happening in a real interface — that none of the prior
directions delivered.

## Honest comparison against the reference bar
- **vs the prior Vraelis attempts:** a decisive jump. This is a *world* with proprietary objects and real product
  surfaces at depth, not a headline + panel. The breach (F5/F6) is a genuine product event, which is what every
  prior direction lacked. Estimate: the strong frames (1, 3, 5, 6, 7, 10) clear the "would this stop a scroll" bar
  the earlier work failed.
- **vs Cursor/Linear:** closer on *depth, real product as artwork, density, product-cinema*. Still short on their
  motion craft (these are static frames) and on the polish of their custom illustration; our org-world UIs are
  believable but simpler than Cursor's real IDE.
- **vs Notion/Wispr:** we now have a proprietary object language (the arena) rather than borrowed vocabulary, but we
  don't yet have Notion's illustration warmth or Wispr's "product in real life" humanity — our world is more
  serious/infrastructural, which suits tenant isolation but should gain warmth in the copy and secondary scenes.

## Honest remaining weaknesses (before implementing the interactive hero)
- **Empty lower halves** on F6 and F7 — the product should push down and fill more of the frame; F6's evidence is
  still small mono (needs to become larger, more forensic objects, not a list).
- **The breach reach line** in F5 is subtle — the "tear" across the boundary should be more violent/physical.
- **Mobile is a draft** — the depth scenes are stacked below the text (legible) but not re-composed; each frame needs
  dedicated mobile art after the desktop direction is approved.
- **Motion is unproven** — the whole thesis rests on the freeze and the reach animating well; that must be
  prototyped before committing.
- **The org-world UIs** are believable but should be pushed to full product fidelity (real columns, states, chrome)
  so they read unmistakably as "the actual product," Cursor-style.
