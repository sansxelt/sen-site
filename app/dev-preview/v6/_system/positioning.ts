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

/** Short category label. Appears once, above the opening headline. */
export const CATEGORY = "Independent verification for AI-built software";

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

/** Page title and meta description. */
export const META_TITLE = "Vraelis | Verification for AI-built software";
export const META_DESCRIPTION =
  "Vraelis independently verifies deployed software built by AI against the outcome the business depends on, then preserves the evidence across failures, repairs, and successful runs.";

/** Link-preview text, shared by Open Graph, Twitter, and the generated OG image. */
export const OG_TITLE = "AI can build the software. It cannot verify itself.";
export const OG_DESCRIPTION =
  "Independent verification of the deployed outcome the business depends on, with the evidence preserved.";

/** The three beats drawn in the OG artwork. */
export const OG_BEATS: [string, string, string] = ["The claim", "The evidence", "The decision"];

/** Closing scene. One statement, one short line. No recap, no feature list. */
export const CLOSE_TITLE = "Ship what you can stand behind.";
export const CLOSE_SAY =
  "Vraelis independently verifies the deployed outcome the business depends on and preserves the evidence behind every failure, repair, and successful run.";

/** The statement in the footer. */
export const FOOTER_STATEMENT =
  "Vraelis checks what AI agents build against what the business actually requires.";
