---
target: the current live homepage
total_score: 26
max_score: 36
na_heuristics: 7
p0_count: 0
p1_count: 2
timestamp: 2026-07-23T20-36-28Z
slug: app-rank-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Timeline self-reports Running to Verified and honestly labels itself an illustration; nothing lies about state. |
| 2 | Match System / Real World | 3 | "Verify an outcome", "deployed application", "claim" match the mental model; "entitlement" and "requirements derived" are mild jargon, explained inline. |
| 3 | User Control and Freedom | 3 | Free navigation, "See how it works" and limitations escape hatches, reduced motion honored. The auto looping hero cannot be paused. |
| 4 | Consistency and Standards | 3 | One button, one accent, consistent rhythm; dinged by the mobile timeline alignment bug and three different verbs for the one CTA. |
| 5 | Error Prevention | 3 | Low surface, no destructive actions. Primary CTA silently gates to a sign in wall (expectation mismatch, not error). |
| 6 | Recognition Rather Than Recall | 3 | Requirements, verdicts, and the repair loop are shown, not referenced; "and 2 more" hides a little. |
| 7 | Flexibility and Efficiency | n/a | Single visit persuade surface; no repeat use accelerators are expected on a landing page. |
| 8 | Aesthetic and Minimalist Design | 2 | Clean and uncluttered, but under designed against the stated reference bar; the hero is a schematic checklist and below the fold is a wall of prose. |
| 9 | Error Recovery | 3 | No page level failure modes; reduced motion degrades to the finished state. The product's own error vocabulary is exemplary. |
| 10 | Help and Documentation | 3 | "See how it works", "View the API", "limitations in full", and footer docs make help discoverable and well placed. |
| **Total** | | **26/36** | **Good (72%)** |

H7 scored n/a (Persuade surface). Applicable maximum is 36.

## Design Specificity Verdict

**Start here: is this authored for Vraelis, or category interchangeable?**

**LLM assessment (Assessment A).** The specificity lives almost entirely in the words, not the composition. The copy could not be lifted onto another tool without lying: the exact Verified / Failed / Blocked triad, "Machine derived. Not human reviewed. Always shown to you.", "Vraelis does not edit your code.", the explicit direction versus today boundary with a limitations link, and above all the `illustration` label on the hero demo. That is writing a competitor cannot copy.

The visual language is the opposite. It is category interchangeable. The single most generic element is the VerificationTimeline card's macOS traffic light chrome (three red/amber/green dots), which reads "developer tool", not "independent verifier", and ships on every observability and CI product. The two feature cards, the CLI codeblock, the green primary button, the faint grid plus soft radial glow, and the box and line diagrams in the "claim to evidence" and "Independent by design" sections are all stock SaaS vocabulary. Only two visual choices are product specific: the Instrument Serif italic accent word (the single deliberate flourish) and the warm paper plus single emerald palette. Verdict: the sentences are Vraelis, the pictures are the category. A stranger reading only the layout could not tell what makes this product different.

**Deterministic scan (Assessment B).** `detect.mjs --json` on all three source files returned exit 0, zero findings. Important scope caveat: on `.tsx` the detector runs only its line level regex matchers; the page level analyzers (marketing buzzword, aphoristic cadence, flat type hierarchy, monotonous spacing, single font, dark glow) are gated to `.html/.astro/.vue/.svelte` and never execute on `.tsx`. So "clean" means clean within the TSX applicable subset, not across every rule. The browser render is genuinely clean: zero console errors, zero page errors, zero failed requests, zero broken images, and no user visible horizontal scroll at 390 or 1440. One latent, non visible anomaly: `body.scrollWidth` overshoots the viewport (1800 vs 1440 desktop, 488 vs 390 mobile) but is fully clipped by `overflow-x: clip`, consistent with a decorative full bleed or pseudo element layer. Harmless today; it would become a real horizontal scroll bug if a future edit ever removes that clip.

**Visual overlays.** No user visible overlay was produced. The optional overlay injection flow was not run (deterministic file scan plus standalone screenshots were sufficient), so there is no `[Human]` overlay tab; the fallback signal is the detector JSON plus the read screenshots above.

## Overall Impression

This is the calmest, most honest page in its category, and honesty is its real moat: the page practices the discipline it sells (it refuses to overclaim about itself, and even labels its own hero `illustration`). But it does not clear the reference bar it was measured against (Notion, Cursor, Linear, Wispr, Stripe, Mercor), and the gap is concentrated in one place: the visual design is under built. The hero is an explanatory schematic rather than a showpiece, the middle of the page collapses into documentation, and for a product whose entire pitch is trust there is no openable proof object and no reassurance at the conversion point. The single biggest opportunity: turn the honesty into a real, clickable verification artifact and build the hero around it.

**One finding that reframes the whole project.** The founder's scan described the live site as still carrying READY / NEEDS REVIEW / REPAIR VERIFIED and the retired human evaluation language. The live homepage and the developers page do not. Both already use the canonical Verified / Failed / Blocked vocabulary, and the developers page even carries a "Not available yet" honesty banner on the CI gate. The residual legacy terminology (Production Pass, READY) survives only on the /demo and /free-report pages, in the orphaned pass-demo component that nothing imports, and in the flag gated legacy pricing branch. Practical consequence: the premise that this homepage needs replacing is not supported by the page itself. The correct move is to elevate the real page, not rebuild it, and to clean up the three or four stale surfaces separately.

## What's Working

1. **Copy honesty as brand embodiment.** The `illustration` tag, "Machine derived. Not human reviewed.", "Vraelis does not edit your code.", and the direction versus today boundary make the page enact the thing it sells. A product that sells "do not overclaim" refuses to overclaim about itself. No competitor can copy this without contradicting themselves.
2. **The failure and repair story inside the hero timeline.** Showing payment succeeds but entitlement never applies, then repair, then Reverified, teaches the core insight (an agent's "done" is not done) in one glance instead of describing it. It dramatizes the one idea the company rests on.
3. **Restraint and cohesion.** Warm paper, one emerald accent, one serif italic flourish, consistent components, faint grid and glow texture. It never reads cheap or templated loud; the calm signals operational seriousness appropriate to the category.

## Priority Issues

**[P1] The hero visual is a schematic, not a showpiece.** It misses the product as artwork bar.
Why it matters: the hero visual is what makes a flagship feel flagship. A gray checklist behind macOS traffic lights reads as "explanatory diagram", which drags the whole page down to "docs homepage", the exact reference bar gap. The headline also maxes at about 3.7rem and the first viewport whispers where the reference bar commands the screen.
Fix: elevate the timeline into a real, dimensional artifact of the actual product. Render the genuine Verified or Failed decision surface with its evidence (a screenshot thumbnail, a failed network request, a step trace), with depth and layering, and choreograph the Verified resolution as a designed moment rather than a gray to green text swap in the corner. Drop the traffic light chrome. Push the display toward 4.5rem to 6rem at desktop and give the hero more vertical presence.
Suggested command: $impeccable shape (re-conceive the flagship hero), then $impeccable bolder.

**[P1] No social proof and thin reassurance at the CTA, on a product that sells trust.**
Why it matters: there are zero logos, quotes, numbers, or openable sample reports anywhere, and the primary CTA gates straight to a sign in wall. Every reference bar site anchors trust early; for a trust product the absence is doubly damaging and is the top conversion leak. A first timer who clicks "Verify an outcome" expecting to try it hits a wall with no "free", no example, and no proof.
Fix: add a proof band with a real, openable example verification that requires no sign in, so the page has a proof object a skeptic can click into. Add reassurance microcopy at the CTA ("Run your first verification free. No card."). If there are no customers yet, the public example report is the social proof. Do not fabricate logos, metrics, or catch rates.
Suggested command: $impeccable clarify (CTA reassurance copy), then $impeccable shape (the openable example verification surface).

**[P2] Below the fold is a wall of prose, and the "claim to evidence" section violates one thing at a time.**
Why it matters: the primitive is presented as three parallel dense text columns (01, 02, 03), forcing the reader to process three things at once and creating a mid page emotional valley where the page stops feeling like a product and starts feeling like a docs site. Visitors skim and bounce.
Fix: convert 01, 02, 03 into a guided single focus sequence (one beat visible at a time, each with a small bespoke visual), and inject at least one real product artifact mid page to break the text.
Suggested command: $impeccable layout, then $impeccable delight.

**[P2] The "Independent by design" diagram contradicts its own argument.**
Why it matters: the copy says Vraelis checks "from outside, beside it instead of inside it", but the diagram stacks AI builder, then Deployed application, then Vraelis as a vertical pipeline, reading as "Vraelis is the last step in the chain", not an independent observer standing apart. The one place the page draws its core differentiator, the picture undercuts the words, in front of exactly the skeptical reader the claim is meant to win.
Fix: redraw so the deployed app is central and Vraelis sits to the side with an arrow probing in from outside, visually separated from the build pipeline. Make outside-ness the literal composition.
Suggested command: $impeccable layout (or $impeccable clarify for the accompanying labels).

**[P2] Mobile hero defect plus an unsettled primary verb.**
Why it matters: on the flagship object at the most common phone width, the hero's `text-align: center` at 960px and below cascades into the timeline card's `14px | 1fr` grid, so the step labels render centered while the status dots stay pinned to the left edge, leaving a large gap that makes each dot look disconnected from its label. It reads as broken on the one element the hero is built around. Separately, the single primary action wears three different verbs ("Check your application" in the nav, "Verify an outcome" in the hero and cards, "Check your application" again on mobile), which makes the core promise feel unfixed.
Fix: scope the centering so it does not reach the card grid (or set the card back to left alignment at that breakpoint). Pick one verb for the primary action across every surface; "Verify an outcome" matches the product vocabulary.
Suggested command: $impeccable adapt (mobile), then $impeccable clarify (verb).

## Persona Red Flags

Primary action under test: "Verify an outcome", which routes to /signin.

**Jordan (First-Timer):** clicks "Verify an outcome" expecting to try it, hits a sign in wall with no "free", no example, and no reassurance, so likely bounces. Worse, the concrete "what do I even type?" example ("A customer can upgrade to Pro and receive access immediately") is buried below the fold in the "claim to evidence" section, so the CTA over promises immediacy before Jordan understands the input.

**Riley (Stress Tester):** rewards the `illustration` honesty, then immediately asks "so show me a real one", and there is no openable real verification anywhere. Reads the confident tone as unearned given zero proof, metrics, or logos. Probes "independent" and finds the "Independent by design" diagram (a pipeline) contradicts the claim (outside and beside). The honesty lines land; the missing real artifact is what fails the stress test.

**Casey (Mobile):** the header is crowded (a big green "Check your application" plus a hamburger dominate), the CTA verb differs from the desktop hero, and the hero visual is pushed far below the fold. The concrete defect: on the timeline card the step labels render centered while the status dots stay pinned left, so the hero's own object reads as broken on the primary phone width.

## Minor Observations

- Three verbs for one action (nav, hero and cards, mobile), all routing to /signin. Pick one.
- The "mono" labels are not monospaced: the code and mono font tokens both resolve to Inter Tight dressed as mono via tracking and caps; real mono appears only in the CLI block. Deliberate and documented, but it softens the instrument texture the brand reaches for.
- The eyebrow "The independent verification layer for work performed by AI" is corporate speak as the literal first words above a strong headline; tighten toward something concrete.
- The auto loop cannot be scrubbed or paused, and the 4.2s restart can lose a slow reader's place. Reduced motion is handled well (renders the finished state).
- Uniform section rhythm: every section is separated by the same 1px hairline and similar vertical scale, reinforcing an even, flat pace. Vary texture and scale to create pace.
- The dark "N" circle bottom left in the captures is the Next.js dev indicator, a dev artifact, not shipping.
- Latent overflow: `body.scrollWidth` exceeds the viewport but is clipped by `overflow-x: clip`. No user impact today; worth removing the source so a future edit cannot turn it into a real horizontal scroll bug.

## Questions to Consider

1. If the entire thesis is "do not trust the claim, show the evidence", why is the hero a hand drawn thing you had to label `illustration`, instead of one real, openable verification report a skeptic could click into? What breaks if the proof object is real?
2. The page argues Vraelis's power is standing outside the system. What would a hero look like that made outside-ness the literal composition (the app on one side, Vraelis probing in from the other), instead of a vertical checklist that looks like every CI pipeline?
3. This is the calmest, most honest page in its category, but calm does not convert a first timer at a sign in wall. Where is the single moment of earned delight or tension on this page, and if there is not one, should it live in the caught bug reveal or the Verified resolution?
