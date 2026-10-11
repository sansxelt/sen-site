import { CHANGELOG, entryId } from "../../v6/_content/changelog";
import { NEWS, type NewsItem } from "../_content/news";

// THE ONE HISTORY BOTH /changelog AND /company READ.
//
// NEWS (_content/news.ts) is the current record, newest first. Below it sits the v6 changelog, which describes the
// earlier browser-testing product. Its entries stay as history and keep their anchors (entryId), so an old link such
// as /changelog#2026-09-28-vraelis-now-answers-coding-agents-directly still lands on its row.
//
// Reconciled with the 2026-10-10 brief:
// - Only entries dated before DIRECTION_DAY are "earlier direction". The v6 entry ON that day ("AI security direction
//   and private foundations") is superseded by the NEWS entry of the same day; it described a private policy core
//   the brief does not list as implemented. It is not shown, and its anchor is kept on the NEWS entry instead.
// - Each earlier entry shows one neutral line, written here, not its original body. The bodies describe accounts,
//   pricing and partnerships of the earlier product in the present tense.
// - The 2026-09-27 ByteDance and 2026-09-17 Reddit entries are official partnerships (founder, 2026-10-10); their
//   records live at /partners. Neither covers or endorses Vraelis Contour.
// - No entry links out: the v6 pages they pointed at belong to the earlier product.

export const DIRECTION_DAY = "2026-10-07";

export type HistoryRow = { id: string; date: string; title: string; summary: string };

/** One line for each earlier entry, keyed by its v6 anchor. Past tense, plain, no claims about today. */
const SUMMARY: Record<string, string> = {
  "2026-10-05-recorded-task-evidence-now-in-the-app": "A local beta compared four reports of one task.",
  "2026-10-03-real-pictures-real-evidence": "Rebuilt app windows gave way to photographs and real screenshots.",
  "2026-10-03-the-site-rebuilt-around-sectors": "The site was reorganised around sector pages.",
  "2026-10-02-the-homepage-film-and-menus-with-a-picture-for-e": "A remade homepage film, and menus with pictures.",
  "2026-10-02-a-real-check-of-a-simulated-mission-console": "A recorded check of Larkspur, a simulated demo console.",
  "2026-10-02-console-onboarding-questions-and-guarantees-that": "Optional setup questions and last-check dates in the console.",
  "2026-10-01-black-site-docs-and-console": "The site, docs and console moved to one black ground.",
  "2026-10-01-two-step-verification": "Two-step verification for console accounts.",
  "2026-10-01-twelve-languages": "One language switch, twelve languages.",
  "2026-09-30-privacy-choices": "Optional storage and sending became off until turned on.",
  "2026-09-30-a-lighter-console-one-typeface-and-docs-with-rea": "A light console, one typeface, and docs screenshots from real runs.",
  "2026-09-28-vraelis-now-answers-coding-agents-directly": "The earlier product ran as an MCP server for coding assistants.",
  "2026-09-27-vraelis-and-bytedance": "Official partnership on ByteDance's Seed models. It does not cover Vraelis Contour.",
  "2026-09-18-the-typescript-sdk-now-follows-the-verification-": "A TypeScript SDK, built and tested, never published.",
  "2026-09-17-vraelis-and-reddit": "Advertising partnership on Reddit Ads. It does not cover Vraelis Contour.",
  "2026-09-07-verified-now-means-the-evidence-earned-it": "No result shown before its decision was derived.",
  "2026-08-25-the-launch-paths-were-re-attacked-before-they-we": "A security review of the launch surface, issues closed.",
  "2026-08-10-three-surfaces-that-disagreed-with-the-ground-th": "Sign-in, invite and error screens moved off a retired palette.",
  "2026-08-03-the-refusal-now-runs-on-every-path-that-starts-a": "No charge for an unbuildable check, on every run path.",
  "2026-08-03-a-tab-whose-table-has-no-writer": "A tab that could only be empty was hidden.",
  "2026-08-03-the-nudge-emails-judged-a-balance-in-a-denominat": "Balance emails counted only the payable unit.",
  "2026-07-30-the-last-false-verified": "A sweep closed cases that recorded a broken app as passing.",
  "2026-07-30-a-run-refuses-an-address-that-does-not-resolve": "Runs required a hostname that resolves.",
  "2026-07-30-a-single-verification-can-be-paid-for-on-its-own": "A single check could be bought without a subscription.",
  "2026-07-28-plans-priced-on-what-stays-proven-and-a-way-off-": "Plans reworded, with a cancellation path.",
  "2026-07-28-the-cli-installs-as-a-command": "A one-line installer for the command-line tool.",
  "2026-07-26-one-site-one-console-one-design": "The site and console shared one design.",
  "2026-07-25-a-model-may-author-a-requirement-but-only-a-pers": "A requirement a model wrote could not approve itself.",
  "2026-07-23-canonical-verification-result-page": "One read-only result page per check.",
  "2026-07-23-webhooks-verification-completed": "An event fired when a check finished.",
  "2026-07-22-reviewed-plans-approved-once-and-consumed-exactl": "A person approved a fixed plan before a run used it.",
  "2026-07-22-a-full-failed-to-verified-repair-loop-on-a-real-": "Fail, repair and recheck, end to end on a live app.",
  "2026-07-21-the-verification-primitive": "One call: claimed outcome in, recorded decision out.",
  "2026-07-20-toward-continuous-agent-oversight": "A stated direction toward continuous agent oversight, not shipped.",
};

/** A fallback for an entry added to the v6 record later: its first sentence, cut short. */
const firstSentence = (body: string[]) => {
  const first = body[0] ?? "";
  const end = first.indexOf(". ");
  const s = end === -1 ? first : first.slice(0, end + 1);
  return s.length > 90 ? `${s.slice(0, 87).trimEnd()}...` : s;
};

/** The earlier record, newest first, as rows. */
export const EARLIER: HistoryRow[] = CHANGELOG
  .filter((e) => e.date < DIRECTION_DAY)
  .map((e) => {
    const id = entryId(e);
    return { id, date: e.date, title: e.title, summary: SUMMARY[id] ?? firstSentence(e.body) };
  });

/** Old anchors of entries the current record supersedes, keyed by the NEWS id that now carries them. */
export const ALIASES: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  const target = NEWS.find((n) => n.date === DIRECTION_DAY);
  if (!target) return out;
  out[target.id] = CHANGELOG.filter((e) => e.date === DIRECTION_DAY).map(entryId);
  return out;
})();

export const CURRENT: NewsItem[] = NEWS;

export const isCapture = (src: string) => src.includes("/v8/contour/");

/** "October 10, 2026", in UTC so a date never moves a day. */
export const longDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
