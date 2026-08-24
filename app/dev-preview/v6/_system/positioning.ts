// ═══════════════════════════════════════════════════════════════════════════
//  PROVISIONAL POSITIONING. One file, one edit.
// ═══════════════════════════════════════════════════════════════════════════
//
// The company category is NOT settled. Every string below is a placeholder for a decision that has not been
// made yet, and none of it should be treated as the permanent name for what Vraelis is.
//
// This module exists so that changing the category is a single edit here, not a search across the site. It is
// the ONLY place the high-level thesis is allowed to live. Everything that consumes it (the opening, the
// closing, the footer statement, the page metadata, the Open Graph image) reads from these constants.
//
// RULES FOR THIS FILE
//   1. High-level claims about what the company IS go here, and nowhere else.
//   2. Scene copy elsewhere on the site describes concrete, currently-working behaviour. It does not restate
//      the thesis. If you find yourself repeating a line from this file inside a scene, delete it there.
//   3. Nothing here may claim continuous monitoring, live agent tracking, automatic repair, or control of
//      production. Vraelis holds a requirement outside the code, checks the running software against it when
//      work is claimed complete, routes decisions to a person, rechecks a repair, and preserves the record.
//      That is the whole of what is built.
//
// Candidate lines that have been tried and are NOT settled (do not re-lock onto any of them):
//   "Control for AI-built software" / "Oversight for AI software agents" /
//   "Vraelis keeps the company in control" / "from responsibility to trusted completion" /
//   "autonomous reliability operator" / "software intent infrastructure"

/** Short category label. Appears once, above the opening headline.
 *
 *  IT NAMES AN INSTITUTION RATHER THAN AN ACTIVITY, and that is the whole edit. "Independent verification
 *  for AI-built software" describes a service somebody could be buying already. "The independent authority"
 *  is a role, it is singular, and it is the thing chapter 2 then shows has never existed for ordinary
 *  software. The hero, that chapter and the closing now share one word, which is a motif rather than a
 *  repeat: the opening says AI cannot BE the authority, the second chapter says nobody else ever was.
 *
 *  WHAT THIS IS NOT CLAIMING. Not that independent verification of software has never existed: it plainly
 *  has, wherever a regulator built it (SOC 2, DO-178C, an IV&V facility). The claim is narrower and
 *  survives a reader who knows that, and chapter 2 states it in full. Nothing here widens it. */
export const CATEGORY = "The independent authority for AI-built software";

/** THE COMPANY THESIS, as two clauses. The insight, not the mechanism: the thing that built the software
 *  cannot also be the authority on whether it worked. Everything below this line on the page is a
 *  mechanism around that idea, and no other section is allowed to restate it. */
export const HEADLINE: [string, string] = [
  "AI can build the software.",
  "It cannot be the final authority on whether it worked.",
];

/** ONE paragraph under the headline. It may describe the loop once, because this is the only place on the
 *  page that is allowed to. Under 45 words. */
export const SUPPORT =
  "Vraelis independently verifies the deployed outcome the business depends on. Give it a live application and one guarantee; it derives the checks, runs the real workflow in a browser, and returns evidence of what held, what failed, and whether the repair survived.";

/** Page title and meta description. Same discipline as CATEGORY: the title names the role, the description
 *  stays strictly inside what the product does. A search result is the one surface where an unsupportable
 *  claim travels furthest, so the description asserts nothing the run itself does not produce. */
export const META_TITLE = "Vraelis | The independent authority for AI-built software";
export const META_DESCRIPTION =
  "Software built by an agent has no authority behind it except the agent that wrote it. Vraelis independently verifies the deployed outcome the business depends on, and preserves the evidence across failures, repairs, and successful runs.";

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
  "Vraelis independently verifies the deployed outcome the business depends on and preserves the evidence behind every failure, repair, and successful run.";

/** The statement in the footer. */
export const FOOTER_STATEMENT =
  "Vraelis checks what AI agents build against what the business actually requires.";
