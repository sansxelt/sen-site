// ═══════════════════════════════════════════════════════════════════════════
//  POSITIONING. One file, one edit.
// ═══════════════════════════════════════════════════════════════════════════
//
// WHAT CHANGED, AND WHY IT HAD TO. This file used to open by declaring the category unsettled, and every
// string in it was a placeholder. What it actually held was an argument: an eyebrow naming an institution
// ("The independent authority for AI-built software") over a headline that spent both of its lines on a
// thesis ("AI can build the software. It cannot be the final authority on whether it worked."). A first
// time visitor read all of that and still did not know what they would type, what would happen, or what
// would come back. Ten seconds of a stranger's attention went entirely on premise.
//
// Meanwhile the clearest sentence the company owns, lib/social-card.ts's "Verifies software built with AI
// actually works.", rendered only in link previews. The site was more legible when shared than when
// visited, and an AI summarising it reported the positioning as inconsistent and offered two different
// companies as candidates (see the note in app/rank/_components/rank-ui.tsx).
//
// So the rule now is the opposite of the old one: THE HEADLINE NAMES THE INPUT, THE ACTOR AND THE THREE
// POSSIBLE ANSWERS. The argument still exists and is still good, but it is a chapter further down the page
// for a reader who has already been told what the thing is. Nothing here asserts a role. The role is
// something the refusal machinery on /platform earns.
//
// RULES FOR THIS FILE
//   1. High-level claims about what the company IS go here, and nowhere else.
//   2. Every line must name something the product literally does. If a sentence would still read the same
//      if the product worked completely differently, it does not belong here.
//   3. Scene copy elsewhere describes concrete behaviour and does not restate the thesis.
//   4. Nothing here may claim continuous monitoring, live agent tracking, automatic repair, or control of
//      production. Vraelis holds a requirement outside the code, checks the running software against it
//      when work is claimed complete, routes decisions to a person, rechecks a repair, and preserves the
//      record. That is the whole of what is built.
//   5. The three answers are Verified, Failed and Blocked, always in that order, always all three. Naming
//      only the good one is how a verification product starts sounding like a green check.

/** Short category label. Appears once, above the opening headline.
 *
 *  IT NAMES THE ACTIVITY, NOT A ROLE. The previous label named an institution, which is a thing a company
 *  becomes rather than a thing a visitor can buy, and it collided with the four other category sentences
 *  live on other surfaces. This one is the same claim lib/social-card.ts already makes to every scraper,
 *  in the grammatical form an eyebrow needs, so the page and the link preview finally agree. */
export const CATEGORY = "Independent verification for AI-built systems";

/** THE HEADLINE, as two clauses: the situation, then the answer.
 *
 *  Line one is the moment the buyer has already lived through and needs no explanation of. Line two names
 *  the actor, the thing it looks at, and all three possible outcomes, so the entire decision surface is
 *  known before the reader scrolls once. Between them they contain no metaphor and nothing to agree with:
 *  a reader either recognises the first line or is not the customer. */
export const HEADLINE: [string, string] = [
  "Your agent says it works.",
  "Vraelis checks it.",
];

/** ONE paragraph under the headline: the loop, once, in the order it happens. Under 45 words.
 *
 *  Every clause is a thing in the code: the sentence is the claim on the reviewed plan, the steps come
 *  from a fixed action vocabulary, approval is a separate hash-bound event, the browser is a real hosted
 *  Chromium session driven against the pinned deployment, and the evidence is the per-step record,
 *  screenshots, console errors and failed requests. No verb here is aspirational. */
export const SUPPORT =
  "Connect a live app or HTTP API and state what must keep working. Approve the check; Vraelis runs it and returns one decision with the evidence behind it.";

/** Page title and meta description.
 *
 *  A search result is the surface where an unsupportable claim travels furthest, so the description makes
 *  exactly the claim the run itself produces and no larger one. It also has to survive being read with no
 *  page around it, which is the second reason it names all three answers rather than only Verified. */
export const META_TITLE = "Vraelis | Independent verification for AI-built systems";
export const META_DESCRIPTION =
  "Vraelis checks AI-built web applications and HTTP APIs and answers Verified, Failed, or Blocked, with the evidence behind the decision.";

/**
 * Link-preview text. Re-exported from lib/social-card.ts, which is the single source for every surface:
 * one sentence, the Vraelis mark as the image, no rendered-headline artwork anywhere.
 */
export { SOCIAL_TITLE as OG_TITLE, SOCIAL_DESCRIPTION as OG_DESCRIPTION } from "@/lib/social-card";

/** The three beats drawn in the OG artwork. */
export const OG_BEATS: [string, string, string] = ["The claim", "The evidence", "The decision"];

/** Closing scene. One statement, one short line. No recap, no feature list. */
export const CLOSE_TITLE = "Ship what you can stand behind.";
export const CLOSE_SAY =
  "One requirement held outside the system, one approved check, and one decision with the evidence attached.";

/** The statement in the footer.
 *
 *  THIS WAS DEAD FOR THE WHOLE OF THE LAST DESIGN. It was exported here and imported by nothing, because
 *  the surface that used to carry it was removed and the export outlived it. It is one of the two
 *  clearest sentences the company has written, so it is now rendered by _system/shell.tsx's footer rather
 *  than sitting in this file being admired. If it goes unused again, delete it instead of leaving it. */
export const FOOTER_STATEMENT =
  "Vraelis checks what AI agents build against what the business actually requires.";
