// Physical-system software is the focus. Live browser execution and local recorded
// evidence review are separate workflows; neither proves physical safety.
export const CATEGORY = "Software verification for physical systems";

/** One concise homepage headline, without a forced line break. */
export const HEADLINE = "Know your systems work.";

/** ONE paragraph under the headline: the loop, once, in the order it happens. Under 45 words.
 *
 *  Every clause is a thing in the code: the sentence is the claim on the reviewed plan, the plan is derived
 *  from it, approval is a separate event a person makes, the browser is a real hosted Chromium session driven
 *  against the deployment, and "every step, a screenshot and what went wrong" is the evidence a run records.
 *  "The device it controls" is rule 7: a device is checked through the web app that controls it. It ends on
 *  what the reader SEES, not on a list of verdicts (rule 5). No verb here is aspirational. */
export const SUPPORT =
  "Verify the software behind physical systems. Exercise a live control panel, or evaluate recorded task reports against reviewed criteria. Inspect the evidence behind each result.";

/** The one line under the headline over the homepage film. Short on purpose (founder, 2026-10-01: the
 *  opening should read like Anduril, Palantir and axiom, a headline and a line, not a paragraph). SUPPORT
 *  stays the fuller sentence for the welcome email and anywhere there is room to explain. */
export const HERO_LINE = "Independent verification for the software behind physical systems.";

/** Page title and meta description.
 *
 *  A search result is the surface where an unsupportable claim travels furthest, so the description makes
 *  exactly the claim the run itself produces and no larger one: it tries the sentence and shows what
 *  happened. It does not promise a green result, and it does not lead with the verdict words (rule 5). */
export const META_TITLE = "Vraelis | Know your systems work.";
export const META_DESCRIPTION =
  "Software verification for defense, infrastructure and robotics. Verify live control panels and inspect recorded task-state evidence independently of the builder.";

/**
 * Link-preview text. Re-exported from lib/social-card.ts, which is the single source for every surface:
 * one sentence, the Vraelis mark as the image, no rendered-headline artwork anywhere.
 */
export { SOCIAL_TITLE as OG_TITLE, SOCIAL_DESCRIPTION as OG_DESCRIPTION } from "@/lib/social-card";

/** The three beats drawn in the OG artwork. */
export const OG_BEATS: [string, string, string] = ["The claim", "The evidence", "The decision"];

/** Closing scene. One statement, one short line. No recap, no feature list. */
export const CLOSE_TITLE = "Ship what you can stand behind";
export const CLOSE_SAY =
  "Say what should work, approve the plan, and see it checked on the live product, with everything it saw attached.";

/** The statement in the footer.
 *
 *  THIS WAS DEAD FOR THE WHOLE OF THE LAST DESIGN. It was exported here and imported by nothing, because
 *  the surface that used to carry it was removed and the export outlived it. It is now rendered by the
 *  footer in _system/close.tsx rather than sitting in this file being admired. If it goes unused again,
 *  delete it instead of leaving it. */
export const FOOTER_STATEMENT =
  "Vraelis verifies software behind physical systems, with evidence you can inspect.";
