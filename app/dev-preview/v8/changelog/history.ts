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
  "2026-10-05-recorded-task-evidence-now-in-the-app": "The earlier app gained a local beta that compared a request, a service response, a device report and a control-panel report for one task.",
  "2026-10-03-real-pictures-real-evidence": "The site replaced rebuilt app windows with licensed photographs and screenshots of the software being checked.",
  "2026-10-03-the-site-rebuilt-around-sectors": "The site was reorganised around sector pages, each walking through a check recorded on a Vraelis demo app.",
  "2026-10-02-the-homepage-film-and-menus-with-a-picture-for-e": "A remade homepage film, part rendered and part licensed footage, and menus with a picture beside each link.",
  "2026-10-02-a-real-check-of-a-simulated-mission-console": "One recorded browser check of Larkspur, a simulated mission console Vraelis built as a demo fixture.",
  "2026-10-02-console-onboarding-questions-and-guarantees-that": "The earlier console asked new accounts three optional setup questions and dated each guarantee's last check.",
  "2026-10-01-black-site-docs-and-console": "The site, docs, sign-in and console moved to one black ground, with result colours tuned for it.",
  "2026-10-01-two-step-verification": "Accounts in the earlier console could turn on two-step verification with an authenticator app or emailed codes.",
  "2026-10-01-twelve-languages": "One language switch changed the site, docs, sign-in and console together, across twelve languages.",
  "2026-09-30-privacy-choices": "The site began asking before storing or sending anything optional, with each optional category off until turned on.",
  "2026-09-30-a-lighter-console-one-typeface-and-docs-with-rea": "The earlier console moved to a light theme, the site moved to one typeface, and five docs pages gained screenshots from real runs.",
  "2026-09-28-vraelis-now-answers-coding-agents-directly": "The earlier product could run as an MCP server, so a coding assistant could request a browser check and read the result.",
  "2026-09-27-vraelis-and-bytedance": "Vraelis and ByteDance, the company behind TikTok, became official partners, centred on ByteDance's Seed models. The partnership does not cover Vraelis Contour. The record is at Partners.",
  "2026-09-18-the-typescript-sdk-now-follows-the-verification-": "A TypeScript SDK for the earlier verification workflow, built and tested in the repository and never published.",
  "2026-09-17-vraelis-and-reddit": "Vraelis entered an advertising partnership with Reddit, focused on Reddit Ads. It does not cover Vraelis Contour. The record is at Partners.",
  "2026-09-07-verified-now-means-the-evidence-earned-it": "The earlier console stopped showing a result before its decision was derived, and drew decision states from one shared system.",
  "2026-08-25-the-launch-paths-were-re-attacked-before-they-we": "A security review of the earlier product's launch surface, with the issues it found closed and the database changes rehearsed.",
  "2026-08-10-three-surfaces-that-disagreed-with-the-ground-th": "Fixes to sign-in, invite and error screens still drawn in a retired palette, and to in-page anchor offsets.",
  "2026-08-03-the-refusal-now-runs-on-every-path-that-starts-a": "The earlier product's refusal to charge for a check it could not build was applied to every path that starts a run.",
  "2026-08-03-a-tab-whose-table-has-no-writer": "A tab that could only ever be empty was hidden until something writes to its table.",
  "2026-08-03-the-nudge-emails-judged-a-balance-in-a-denominat": "Balance emails in the earlier product were corrected to count only the unit a check could be paid with.",
  "2026-07-30-the-last-false-verified": "An internal sweep closed cases where the earlier product could record a broken application as passing.",
  "2026-07-30-a-run-refuses-an-address-that-does-not-resolve": "The earlier product began checking that a hostname resolves before admitting a run.",
  "2026-07-30-a-single-verification-can-be-paid-for-on-its-own": "The earlier product allowed paying for a single check without a subscription.",
  "2026-07-28-plans-priced-on-what-stays-proven-and-a-way-off-": "The earlier product's plans were reworded around what they kept checked, with a cancellation path.",
  "2026-07-28-the-cli-installs-as-a-command": "A one-line installer for the earlier product's command-line tool on macOS, Linux and Windows.",
  "2026-07-26-one-site-one-console-one-design": "The public site and the earlier console were brought into one visual design.",
  "2026-07-25-a-model-may-author-a-requirement-but-only-a-pers": "Authorship and review became separate records, so a requirement a model wrote could not approve itself.",
  "2026-07-23-canonical-verification-result-page": "Each check in the earlier product gained one read-only result page.",
  "2026-07-23-webhooks-verification-completed": "External systems could receive an event when a check in the earlier product finished.",
  "2026-07-22-reviewed-plans-approved-once-and-consumed-exactl": "A dry run produced a fixed plan that a person approved before a run used exactly that plan.",
  "2026-07-22-a-full-failed-to-verified-repair-loop-on-a-real-": "A failed check, a repair and a recheck closed end to end on a live application, with the failed record kept.",
  "2026-07-21-the-verification-primitive": "The earlier product's core became one call: a claimed outcome and a deployment in, a recorded decision out.",
  "2026-07-20-toward-continuous-agent-oversight": "A stated direction for the earlier product, following agent activity continuously. It was not shipped.",
};

/** A fallback for an entry added to the v6 record later: its first sentence, cut short. */
const firstSentence = (body: string[]) => {
  const first = body[0] ?? "";
  const end = first.indexOf(". ");
  const s = end === -1 ? first : first.slice(0, end + 1);
  return s.length > 180 ? `${s.slice(0, 177).trimEnd()}...` : s;
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
