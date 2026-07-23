# Design 05 Phase 0E, light first homepage

One complete homepage that puts the tenant isolation proof story inside a bright, confident public brand world.
The dark verification environment is used only as a contained product artifact, never as the identity of the page.
Route: `/dev-preview/public-v2/home`. Captures in `docs/design-05/home-0e/`: full desktop page, 1440 hero,
390 mobile, and the dark chamber interaction state. Static design, not merged. `next build` compiles the route.

## Why the light world and the dark chamber are the same brand

The authenticated app is light, warm, and operational. The public site now uses that same brand rather than a
separate dark developer aesthetic, so the two feel like one company:

- **Same tokens.** The page inherits the app's light palette and type: warm paper `#F7F3EA`, white cards, warm
  ink, the emerald `#0C7A50` primary, and Geist as the display face. A visitor who signs in lands in the same
  world they just read about.
- **The dark chamber is a device inside the light page, not the page.** It appears in exactly three places, each a
  contained product artifact framed by the light world: the hero (the live tenant verification), a couple of the
  story ribbon steps (the breach step tinted, the decision step dark), and the developer code block. Everywhere
  else is light. Dark reads as "the place where reality gets challenged," which is a meaningful contrast, not a
  competing identity.
- **One verdict language across both.** Verified is emerald, rejected is a warm red, the same tones the app uses,
  so a decision reads the same on the marketing page and in the product.
- **The chamber is real, not decorative.** It shows an actual product surface (User A's screen with a foreign
  Organization B row) and toggles between Challenge and Result, so it behaves like the thing users log into, not a
  screenshot.

## The homepage, top to bottom
1. **Light nav and hero.** "AI builds. Vraelis proves." with the supporting line, two calls to action, and a
   proven in production trust line, beside the contained dark proof chamber.
2. **The contained chamber** shows the tenant breach compactly: the agent's claim, the business invariant, User A's
   live screen holding an Organization B record, and "Release rejected." A Challenge / Result toggle reveals the
   fresh identities Vraelis spawns and the verifying state.
3. **One verification, start to finish.** A single continuous ribbon of six steps (claim, challenge, breach,
   evidence, decision, next round), not a slideshow. The breach and decision steps carry the chamber's colour into
   the light flow.
4. **Breadth.** Checkout is one example. Six business invariants shown as real promises: tenant isolation, agent
   approval gates, inventory truth, payment and access, real state change, permission changes.
5. **The real production case.** The checkout persistence story as a preserved lineage: two rejected attempts and a
   final verified one. Vraelis is real, and checkout is a case study, not the category.
6. **Today, next, horizon.** What ships now versus the direction, with the future clearly marked as direction.
7. **Developers.** Put Vraelis between the agent and the deploy, with a contained dark code artifact showing the
   verification request and the rejected decision a pipeline can enforce.
8. **Final call to action** and a light footer with an honest fixture data note.

## Honest read
This is the first version that looks like a real company rather than an exploration. It is light first, it matches
the app, the product moment is contained and legible, and the page has the section variety and rhythm of a real
homepage. Remaining work before it becomes the live site: push the chamber and case study to full product fidelity,
add real motion to the chamber (the challenge running into the breach) and light scroll reveals, replace the
placeholder customer and pricing links with real pages, and tune the type scale and spacing across breakpoints.
Copy avoids middots, em dashes, and dash separators throughout.
