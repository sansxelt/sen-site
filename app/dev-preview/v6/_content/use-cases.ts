// USE CASES: FOUR RECORDED CHECKS, READ FROM THEIR RECORDS (plan S1, A9 T3 and T15; revision 2, 2026-10-02).
//
// One file feeds the /use-cases index, the four use-case pages (use-cases/[slug]/page.tsx) and the record
// panels on the sector pages (_system/record-panel.tsx). It retypes nothing that a record already holds: every
// sentence, step, timing, expectation and observation is read from the two record files,
//   _content/strike.ts   the Larkspur check, run vrf_51705517, recorded 2026-10-02 (UTC)
//   _content/demos.ts    the three demo apps: Lumen Notes (runs 3fad10f5 and 588c48f7), Notewell (4fc6e52c)
//                        and the fixture dashboard (de53ab8b)
// What this file adds is only what those files do not carry, and each addition says where it comes from:
//   - RUN_IDS: the demo runs' ids, from the header of demos.ts (run-window.tsx keeps the same map);
//   - the demo repair prompts, built by the product's own builder (lib/preflight/repair-prompt.ts) with exactly
//     the inputs _system/run-window.tsx gives it, so a prompt reads the same here as in the run window;
//   - the evidence crops in public/use-cases/ (crops of each run's own screenshot, never recoloured; their
//     sources and crop boxes are in public/use-cases/CREDITS.md);
//   - the copy a page needs around a record: its headline, outcome line, related sectors and closing.
//
// THE WORDS (plan 0.3). Pitch copy names an outcome "Found a problem" or "Did what the sentence says". A demo
// run's `label` is "Verified" or "Failed" for two of the runs, so it is never printed: a run here has a label
// only where the record has two runs ("Before the fix", "After the fix").
//
// TRANSLATION. Every string is whole. The record's own words (the sentence, steps, expected and observed) are
// rendered with data-no-translate by the components, because a translated step is not the step the run took.
import type { StaticImageData } from "next/image";
import { STRIKE } from "./strike";
import { DEMOS, type Demo, type DemoRun } from "./demos";
import type { SolutionSlug } from "./sectors";
import { buildRepairPrompt } from "@/lib/preflight/repair-prompt";
import { V6_BASE } from "@/lib/v6-routes";

/** The outcome phrases (plan 0.3). The only words pitch copy uses for a run's answer. */
export const FOUND = "Found a problem";
export const HELD = "Did what the sentence says";

/** The four recorded checks this site shows. "strike" is Larkspur; the others are the demo apps by demos.ts key. */
export type RecordKey = "strike" | "checkout" | "notes" | "projects";

export type CheckStep = { say: string; ms: number; ok: boolean };
/** One journey as the run took it. `note` is one whole sentence a panel may show beside it. */
export type CheckJourney = { name: string; steps: CheckStep[]; note?: string };

/** A screenshot as a panel shows it: a crop of the run's own screenshot, its alt text (the state shown) and
 *  the caption under it. A public/ path carries its pixel size. */
export type CheckShot = { src: string | StaticImageData; w?: number; h?: number; alt: string; caption: string };

export type CheckRun = {
  /** The run id as the site names it: "vrf_51705517", "3fad10f5". Machine text: never translated. */
  id: string;
  /** "Before the fix" or "After the fix" where a record has two runs; null otherwise. Never Verified or Failed. */
  label: string | null;
  /** true: the run found a problem. false: it did what the sentence says. */
  found: boolean;
  /** The date the run was recorded, ISO, UTC. */
  recorded: string;
  /** Start to answer, in seconds, from the record. */
  seconds: number;
  journeys: CheckJourney[];
  /** Where the problem was found and what the record says was expected and observed, verbatim. */
  failure: null | { at: string; expected: string; observed: string; more?: string };
  /** The evidence crop (at most 640 wide on the page). */
  shot: CheckShot;
  /** The repair prompt the run produced, or null when it found no problem. */
  prompt: string | null;
  /** One whole sentence about this run where the record says more than its outcome (the run after a fix). */
  note?: string;
};

export type CheckRecord = {
  key: RecordKey;
  /** The app's name: "Larkspur", "Lumen Notes", "Notewell", "Vraelis fixture dashboard". */
  name: string;
  /** The name on a tab when several records share one panel: "Project tracker" for the fixture dashboard. */
  tab: string;
  /** One whole sentence (or two) on what the app is. */
  about: string;
  /** The address the run checked, and the same without the protocol, for a panel's bar. */
  url: string;
  address: string;
  /** The sentence, verbatim, or null when the record has none (the fixture dashboard). */
  claim: string | null;
  /** The journey's recorded name, shown in place of the sentence when the record has none. */
  journeyName: string | null;
  /** "Approved by a person, October 2, 2026, 02:03 UTC" where the record holds the approval time. */
  approved: string | null;
  /** The CLI command the run was started with, where the record holds it (Larkspur). */
  cli: string | null;
  /** The plan: its id where the record has one, its requirements (Larkspur's record holds nine; the demo
   *  records hold none), and its journeys with their planned step counts. */
  plan: { id: string | null; requirements: string[]; journeys: { name: string; steps: number }[] };
  /** The runs, in the order they were recorded. Most records have one. */
  runs: CheckRun[];
  /** What the record shows, in a few sentences. */
  takeaway: string;
  /** Its use-case page. */
  href: string;
};

/* ───────────────────────────────────────────────────────────────────────────── the Larkspur record ── */

const sr = STRIKE.run!;
const strikeFirst = sr.journeys[0];
const strikeAt = strikeFirst.steps.findIndex((s) => !s.ok);

/** "Approved by a person, October 2, 2026, 02:03 UTC" from the plan's approval time (UTC, 24-hour clock). */
function approvedLine(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return `Approved by a person, ${date}, ${time} UTC`;
}

const noProtocol = (u: string) => u.replace(/^https?:\/\//, "").replace(/\/$/, "");

const STRIKE_RECORD: CheckRecord = {
  key: "strike",
  name: "Larkspur",
  tab: "Larkspur",
  about: "Larkspur is a simulated mission console that Vraelis built itself and serves as a demo fixture. Nothing in it controls real hardware.",
  url: STRIKE.url,
  address: noProtocol(STRIKE.url),
  claim: STRIKE.claim,
  journeyName: null,
  approved: approvedLine(STRIKE.plan.approvedAt),
  cli: STRIKE.cli?.command ?? null,
  plan: { id: STRIKE.plan.id.slice(0, 12), requirements: STRIKE.plan.requirements, journeys: STRIKE.plan.flows },
  runs: [{
    id: sr.id.slice(0, 12),
    label: null,
    found: !!sr.failure,
    recorded: sr.recorded,
    seconds: sr.seconds,
    journeys: sr.journeys,
    failure: sr.failure
      ? { at: `Step ${strikeAt + 1} of the first journey`, expected: sr.failure.expected, observed: sr.failure.observed, more: sr.failure.more }
      : null,
    shot: {
      src: sr.shots.failure,
      alt: "The run's screenshot of Larkspur's contact list after confirming T-1: T-1 and the civilian bus T-3 both show Cleared to engage, T-2 shows Do not engage and T-4 shows Hold.",
      caption: "The contact list, cut from the run's own screenshot. T-3 is the civilian bus.",
    },
    prompt: sr.repairPrompt,
  }],
  // The run read T-1, T-2 and T-3 again after the click (steps 6 to 8), not T-4: "the contacts", never "every contact".
  takeaway: "Confirming T-1 changed more than T-1. In its broken mode Larkspur clears every contact in the confirmed contact's grid square, and the civilian bus T-3 is in that square. The check read the contacts again after the click, so it saw the bus. A check of T-1 alone would have passed.",
  href: `${V6_BASE}/use-cases/only-the-confirmed-target`,
};

/* ──────────────────────────────────────────────────────────────────────────────── the demo records ── */

/** The demo runs' ids, from the header of _content/demos.ts (v_preflight_runs.id prefixes). */
const RUN_IDS: Record<string, string[]> = {
  checkout: ["3fad10f5", "588c48f7"],
  notes: ["4fc6e52c"],
  projects: ["de53ab8b"],
};

/** The evidence crops (public/use-cases/, CREDITS.md there), one per run, each with the state it shows. */
const SHOTS: Record<string, Omit<CheckShot, "caption">[]> = {
  checkout: [
    { src: "/use-cases/checkout-before-plan.png", w: 880, h: 248, alt: "The Lumen Notes account page after signing back in, before the fix: Current plan shows Free." },
    { src: "/use-cases/checkout-after-plan.png", w: 880, h: 248, alt: "The same account page after the fix: Current plan shows Pro." },
  ],
  notes: [
    { src: "/use-cases/notes-sign-in.png", w: 480, h: 480, alt: "Notewell's sign-in page, where the browser was sent after opening /dashboard while signed out." },
  ],
  projects: [
    { src: "/use-cases/projects-after-reload.png", w: 640, h: 354, alt: "The fixture dashboard after one reload: Your projects reads No projects yet." },
  ],
};

/** What each demo app is, in a whole sentence. The fixtures' own pages say the same. */
const ABOUT: Record<string, string> = {
  checkout: "Lumen Notes is a Vraelis demo app. Nothing in it is real and no payment is taken.",
  notes: "Notewell is a Vraelis demo app built with Lovable.",
  projects: "The fixture dashboard is a Vraelis test fixture. In its broken mode, records live in memory only.",
};

const NAMES: Record<string, { name: string; tab: string }> = {
  checkout: { name: "Lumen Notes", tab: "Lumen Notes" },
  notes: { name: "Notewell", tab: "Notewell" },
  projects: { name: "Vraelis fixture dashboard", tab: "Project tracker" },
};

/** A sentence about a run, by its index (plan A8.3: "The same 11 planned steps both times"). */
const RUN_NOTES: Record<string, (string | undefined)[]> = {
  checkout: [undefined, "It took the same eleven planned steps as the run before the fix, and none of them found a problem."],
};

/** A sentence beside each journey where the record says more than its steps (plan A8.3; rules: Notewell's
 *  journey 2 passed, and every citation says so). */
const JOURNEY_NOTES: Record<string, string[]> = {
  notes: [
    "The check deleted its own test note at the end.",
    "It passed: signed out, /dashboard sent the browser to sign in.",
  ],
};

const SLUG_OF: Record<string, string> = {
  checkout: "checkout-that-forgets",
  notes: "notes-that-survive-sign-out",
  projects: "project-that-vanishes",
};

/* The repair prompt, built exactly as _system/run-window.tsx builds it (promptFor): the product's builder over
   the recorded failure, with the steps up to the failing one, the page the run ended on, and nothing the
   record does not hold (no console errors, no failed requests, no guess). */
const appName = (d: Demo) => d.app.split(",")[0];
function lastPath(run: DemoRun, upto = Infinity): string {
  const opened = run.journeys.flatMap((j) => j.steps).slice(0, upto).map((s) => /^Open (\/\S*)/.exec(s.say)?.[1]).filter(Boolean);
  return opened.length ? String(opened[opened.length - 1]) : "/";
}
const withQuery = (u: string, demoUrl: string) => (u.includes("?") || !demoUrl.includes("?") ? u : `${u}?${demoUrl.split("?")[1]}`);
function demoPrompt(demo: Demo, run: DemoRun): string | null {
  const f = run.failure;
  if (!f) return null;
  const steps = run.journeys.flatMap((j) => j.steps);
  const at = steps.findIndex((s) => !s.ok);
  return buildRepairPrompt({
    severity: "high", category: "persistence_failure", title: demo.title,
    requirement_refs: [], expected: f.expected, observed: f.observed,
    repro: steps.slice(0, at + 1).map((s, i) => `${i + 1}. ${s.say}`),
    possible_explanation: null,
    evidence: {
      failed_step_index: at, failed_action: steps[at]?.say ?? "", console_errors: [], network_failures: [],
      current_url: withQuery(`${demo.url.split("?")[0].replace(/\/$/, "")}${lastPath(run)}`, demo.url),
    },
    status: "open",
  }, { appName: appName(demo), deploymentUrl: demo.url });
}

function demoRecord(demo: Demo): CheckRecord {
  const key = demo.key as RecordKey;
  const first = demo.runs[0];
  return {
    key,
    name: NAMES[demo.key].name,
    tab: NAMES[demo.key].tab,
    about: ABOUT[demo.key],
    url: demo.url,
    address: noProtocol(demo.url),
    claim: demo.claim,
    journeyName: demo.claim ? null : demo.journeyName ?? first.journeys[0]?.name ?? null,
    approved: null,
    cli: null,
    // The demo records keep their journeys and steps; the planned steps are the steps each run took (the
    // checkout's two runs took the same eleven).
    plan: { id: null, requirements: [], journeys: first.journeys.map((j) => ({ name: j.name, steps: j.steps.length })) },
    runs: demo.runs.map((run, i) => ({
      id: RUN_IDS[demo.key][i],
      label: demo.runs.length > 1 ? run.label : null,
      found: run.decision === "failed",
      recorded: run.recorded,
      seconds: run.seconds,
      journeys: run.journeys.map((j, k) => ({ ...j, note: JOURNEY_NOTES[demo.key]?.[k] })),
      failure: run.failure ? { at: run.failure.at, expected: run.failure.expected, observed: run.failure.observed } : null,
      shot: { ...SHOTS[demo.key][i], caption: run.shotCaption },
      prompt: demoPrompt(demo, run),
      note: RUN_NOTES[demo.key]?.[i],
    })),
    takeaway: demo.takeaway,
    href: `${V6_BASE}/use-cases/${SLUG_OF[demo.key]}`,
  };
}

const demo = (key: string) => DEMOS.find((d) => d.key === key)!;

/** Every record, by key. */
export const RECORDS: Record<RecordKey, CheckRecord> = {
  strike: STRIKE_RECORD,
  checkout: demoRecord(demo("checkout")),
  notes: demoRecord(demo("notes")),
  projects: demoRecord(demo("projects")),
};

/** The steps of a run, all journeys in order. */
export const allSteps = (run: CheckRun): CheckStep[] => run.journeys.flatMap((j) => j.steps);

/** A duration as the record gives it: "40.8 s", "9.0 s". */
export const secondsText = (s: number) => `${s.toFixed(1)} s`;

/* ──────────────────────────────────────────────────────────────────────────────────── the use cases ── */

export type UseCaseSlug = "only-the-confirmed-target" | "notes-that-survive-sign-out" | "checkout-that-forgets" | "project-that-vanishes";

export type UseCase = {
  slug: UseCaseSlug;
  record: RecordKey;
  /** The h1 of its page and its row title on the index: a statement of 12 words or fewer, with a full stop. */
  title: string;
  /** The outcome line under the h1: what the run found, in one or two sentences. */
  outcome: string;
  /** One or two whole sentences on the plan: the lead of the plan section, or, where the record holds no
   *  requirements and one journey (the checkout, the fixture dashboard), the lead of the steps section, because a
   *  plan section would only repeat that journey's name. */
  planNote: string;
  /** The page title and description (no dashes). */
  metaTitle: string;
  description: string;
  /** Where a reader can open the app the run checked. Plain links; `address` is what the link reads. */
  open: { label: string; href: string; address: string }[];
  /** The sectors that cite this record, for the page's CrossLinks. */
  sectors: SolutionSlug[];
  /** The page's closing line and action (the default is Start free). */
  closing: { title: string; action?: { label: string; href: string } };
};

/** The four use cases, in priority order (plan S1): the two P0 pages first. */
export const USE_CASES: UseCase[] = [
  {
    slug: "only-the-confirmed-target",
    record: "strike",
    title: "Confirming one target also cleared the civilian bus",
    outcome: "Vraelis checked Larkspur, a simulated mission console it built itself. At step 8, the civilian bus T-3 showed Cleared to engage.",
    planNote: "Vraelis wrote the plan from the sentence before anything ran: what it would hold the console to, and three journeys to take.",
    metaTitle: "Only the confirmed target",
    description: "A real check of Larkspur, a simulated mission console Vraelis built itself: confirming T-1 also cleared the civilian bus T-3. The sentence, the plan, every step and the repair prompt.",
    open: [
      { label: "Open Larkspur in its broken mode", href: "/api/fixtures/strike?mode=broken", address: "vraelis.com/api/fixtures/strike?mode=broken" },
      { label: "Open Larkspur in its fixed mode", href: "/api/fixtures/strike?mode=fixed", address: "vraelis.com/api/fixtures/strike?mode=fixed" },
    ],
    sectors: ["defense", "fleets"],
    closing: { title: "Check your console on a simulation build", action: { label: "Talk to us", href: `${V6_BASE}/contact?topic=defense` } },
  },
  {
    slug: "notes-that-survive-sign-out",
    record: "notes",
    title: "A note that survives signing out and back in",
    // Steps 13 and 14 of journey 1 read the note again after signing back in. The clean-up is said once, by the
    // record's takeaway ("What this shows"), not here as well.
    outcome: "Vraelis checked Notewell, a demo app built with Lovable. It did what the sentence says: the note was still there after signing out and back in.",
    planNote: "Vraelis wrote two journeys from the one sentence.",
    metaTitle: "Notes that survive sign-out",
    description: "A real check of Notewell, a demo app built with Lovable: a note survives signing out and back in, and a signed-out visitor is sent to sign in. Every step, as recorded.",
    open: [
      { label: "Open Notewell", href: "https://my-safe-note.lovable.app", address: "my-safe-note.lovable.app" },
    ],
    sectors: ["ai-built-apps", "public-sector", "saas"],
    closing: { title: "Check what your agent built, on the live app" },
  },
  {
    slug: "checkout-that-forgets",
    record: "checkout",
    title: "A checkout that forgets Pro after signing back in",
    outcome: "Paying worked and the account showed Pro. After signing out and back in, “Pro” was not on the page. After the fix, the same steps did what the sentence says.",
    planNote: "One journey of eleven planned steps. The run after the fix took the same steps.",
    metaTitle: "A checkout that forgets",
    description: "Two real runs on Lumen Notes, a Vraelis demo app: before the fix, Pro was gone after signing back in; after the fix, the same eleven steps did what the sentence says.",
    open: [
      { label: "Open Lumen Notes", href: "https://broken-checkout.vercel.app", address: "broken-checkout.vercel.app" },
    ],
    sectors: ["commerce", "saas", "agencies"],
    closing: { title: "Know the upgrade sticks before a release" },
  },
  {
    slug: "project-that-vanishes",
    record: "projects",
    title: "A project that vanishes after one reload",
    outcome: "On the Vraelis fixture dashboard, a new project looked fine on screen. One reload later it was gone, and the check found it at step 5 of 5.",
    planNote: "One journey of five planned steps.",
    metaTitle: "A project that vanishes",
    description: "A real check of the Vraelis fixture dashboard in its broken mode: a project created a moment earlier was gone after one reload. Every step, as recorded.",
    open: [
      { label: "Open the fixture dashboard in its broken mode", href: "https://preflight-demo-ten.vercel.app/?mode=broken", address: "preflight-demo-ten.vercel.app/?mode=broken" },
    ],
    sectors: ["saas", "agencies", "ai-built-apps"],
    closing: { title: "Check that saved work is still there" },
  },
];

export const useCaseBySlug = (slug: string) => USE_CASES.find((u) => u.slug === slug);
export const useCaseOf = (key: RecordKey) => USE_CASES.find((u) => u.record === key)!;
