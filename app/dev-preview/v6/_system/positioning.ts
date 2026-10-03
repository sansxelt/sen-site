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
// So the rule now is the opposite of the old one: THE HEADLINE NAMES THE INPUT AND THE ACTOR, AND THE LINE
// UNDER IT NAMES THE THREE POSSIBLE ANSWERS. The argument still exists and is still good, but it is a
// chapter further down the page for a reader who has already been told what the thing is. Nothing here
// asserts a role. The role is something the refusal machinery on /platform earns.
//
// LOCKED 2026-09-28. The previous lines asked a reader to "state what must keep working" about "a live app
// or HTTP API", under a category naming "AI-built systems". The founder found that unclear: verification of
// vague business outcomes, an API surface that is a signed-in beta, and a roadmap that reached a long way
// past the browser. The function is now stated narrowly and exactly (one sentence, checked on the deployed
// web app in a real browser, answered with evidence), and the audience is left wide on purpose.
//
// RULES FOR THIS FILE
//   1. High-level claims about what the company IS go here, and nowhere else.
//   2. Every line must name something the product literally does. If a sentence would still read the same
//      if the product worked completely differently, it does not belong here.
//   3. Scene copy elsewhere describes concrete behaviour and does not restate the thesis.
//   4. Nothing here may claim continuous monitoring, watching anyone while they work, automatic repair, or
//      control of production. What is built: a person, a pipeline or an AI assistant hands Vraelis one
//      sentence about what a deployed web app should do (through the console, the CLI, the API or MCP);
//      Vraelis writes a plan and a person approves it once; a real browser runs it on the live app; the
//      answer, with its evidence and on Failed a repair prompt, goes back to whoever asked, including an AI
//      assistant; after a fix the same approved plan can be re-checked within its limits; every run is kept.
//      That is the whole of what is built.
//   5. THE PRODUCT IS NOT ITS THREE ANSWERS (founder, 2026-09-29: "stop putting the entire product on
//      verified, blocked or failed"). The answer's vocabulary is Verified, Failed and Blocked, and wherever a
//      result is actually shown (a replayed run, the docs, the API) it is named that way. But the pitch is
//      what Vraelis DOES: it tries the sentence on the live app and shows exactly what happened. Nothing here
//      leads with the trichotomy, and a line that exists only to list the three answers does not belong.
//   6. NARROW ABOUT THE FUNCTION, WIDE ABOUT THE AUDIENCE (founder, 2026-09-28). Say exactly what it does:
//      one sentence, one approved plan, one real browser run on the live app, one answer with evidence.
//      Never make a line here about who uses it. Developers, product teams, agencies, founders, QA, CI and AI
//      coding agents all use the same check, and AI assistants over MCP are one channel among four, not the
//      identity. Nothing in this file names a specific assistant.
//   7. CONNECTED DEVICES ARE A NAMED AREA, NOT THE IDENTITY (founder, 2026-09-28). Drones, robots, fleets
//      and other connected hardware are where the niche is, so they are named: in the support line, in a
//      homepage section, and in coverage. The honest capability today is the device's WEB CONTROL PANEL: an
//      operator action goes in through a real browser, and Vraelis checks the state the system reports
//      afterwards. Reading the device itself (firmware, sensors, telemetry) is NOT built and is labelled Next
//      wherever it appears. Nothing here may imply otherwise.
//   8. THE PRODUCT DIRECTION IS CHANGING, SO THE PITCH IS THE OUTCOME, NOT THE ANSWER WORDS (founder,
//      2026-09-30: "stop with the verified blocked and failed thing, remember we are changing product
//      direction"). The public pitch is what a creator gets: knowing that what they built does what they
//      meant, checked on the live product, with what broke handed to them or their agent. Verified, Failed
//      and Blocked stay the product's vocabulary inside the console, the API and the docs, and the homepage
//      does not print them: a replayed run says "Found a problem" or "Did what the sentence says".

/** Short category label. Appears once, above the opening headline.
 *
 *  IT NAMES THE ACTIVITY AND WHERE IT HAPPENS, NOT A ROLE AND NOT AN AUDIENCE. Earlier labels named an
 *  institution, then a class of software ("AI-built systems"). Both told a reader who the company thought it
 *  was rather than what it would do for them. "On the live app" is the part a reader can check. */
export const CATEGORY = "Verification for what you build";

/** One concise homepage headline, without a forced line break. */
export const HEADLINE = "Know your systems work";

/** ONE paragraph under the headline: the loop, once, in the order it happens. Under 45 words.
 *
 *  Every clause is a thing in the code: the sentence is the claim on the reviewed plan, the plan is derived
 *  from it, approval is a separate event a person makes, the browser is a real hosted Chromium session driven
 *  against the deployment, and "every step, a screenshot and what went wrong" is the evidence a run records.
 *  "The device it controls" is rule 7: a device is checked through the web app that controls it. It ends on
 *  what the reader SEES, not on a list of verdicts (rule 5). No verb here is aspirational. */
export const SUPPORT =
  "Say what your web app, or the device it controls, should do. Vraelis checks it on the live product in a real browser, shows you exactly what happened, and hands anything broken to you or your AI agent.";

/** The one line under the headline over the homepage film. Short on purpose (founder, 2026-10-01: the
 *  opening should read like Anduril, Palantir and axiom, a headline and a line, not a paragraph). SUPPORT
 *  stays the fuller sentence for the welcome email and anywhere there is room to explain. */
export const HERO_LINE = "Checks in a real browser, on live web apps and the panels that run devices.";

/** Page title and meta description.
 *
 *  A search result is the surface where an unsupportable claim travels furthest, so the description makes
 *  exactly the claim the run itself produces and no larger one: it tries the sentence and shows what
 *  happened. It does not promise a green result, and it does not lead with the verdict words (rule 5). */
export const META_TITLE = "Vraelis | Know your systems work";
export const META_DESCRIPTION =
  "Say what your web app, or a device it controls, should do. Vraelis checks it in a real browser on the live product, shows you exactly what happened, and hands anything broken to you or your AI agent.";

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
  "Vraelis checks whether live software does what someone says it does, and shows the evidence.";
