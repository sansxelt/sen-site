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
export const CATEGORY = "Control for AI-built software";

/** The opening headline, as two clauses. The first is set back, the second carries. */
export const HEADLINE: [string, string] = [
  "AI builds more of the software.",
  "Vraelis keeps the company in control.",
];

/** ONE short sentence under the headline. The opening creates scale and curiosity; proof comes later, so
 *  this line must not try to explain the product. Keep it under about 20 words. */
export const SUPPORT = "An agent says the work is done. Vraelis decides whether that is true.";

/** Page title and meta description. */
export const META_TITLE = "Vraelis | Control for AI-built software";
export const META_DESCRIPTION =
  "See what AI agents changed, catch what they missed, and keep human control over what reaches production.";

/** Link-preview text, shared by Open Graph, Twitter, and the generated OG image. */
export const OG_TITLE = "Keep control of software AI is building.";
export const OG_DESCRIPTION =
  "See what agents changed, catch the claims they cannot back up, and decide what is safe to ship.";

/** The three beats drawn in the OG artwork. */
export const OG_BEATS: [string, string, string] = ["What changed", "What it missed", "What ships"];

/** Closing scene. One statement, one short line. No recap, no feature list. */
export const CLOSE_TITLE = "Ship what you can stand behind.";
export const CLOSE_SAY = "Proof before production, and a record that outlives the change.";

/** The statement in the footer. */
export const FOOTER_STATEMENT =
  "Vraelis checks what AI agents build against what the business actually requires.";
