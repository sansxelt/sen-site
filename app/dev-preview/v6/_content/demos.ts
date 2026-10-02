// REAL RUNS, REPLAYED. Every value in this file was read out of a production verification record: the
// sentence, the journeys Vraelis planned, each step the browser took with how long it took, what each check
// expected and what it saw, the final screenshot, and the decision. Nothing is scripted to look better.
//
// The apps are Vraelis's own demo apps (Lumen Notes, Notewell, the fixture dashboard), so there is no
// customer data here, and all three are public and can be opened.
//
// Where the record lacks something it is left out rather than written in: the project tracker's contract
// carries no sentence, so that demo shows the journey's recorded name instead of a claim.
//
// Source runs (v_preflight_runs.id prefix, recorded):
//   checkout, before the fix   3fad10f5  2026-07-22  blocked (public: Failed)   7.6 s
//   checkout, after the fix    588c48f7  2026-07-22  ready   (public: Verified) 9.0 s
//   notes app                  4fc6e52c  2026-07-31  ready   (public: Verified) 17.4 s
//   project tracker            de53ab8b  2026-07-14  blocked (public: Failed)   5.0 s
import type { StaticImageData } from "next/image";
import checkoutFailed from "./demos/checkout-failed.png";
import checkoutVerified from "./demos/checkout-verified.png";
import notesSignedOut from "./demos/notes-signed-out.png";
import projectsFailed from "./demos/projects-failed.png";

export type DemoStep = { say: string; ms: number; ok: boolean };
export type DemoJourney = { name: string; steps: DemoStep[] };
export type DemoRun = {
  label: string;               // what distinguishes this run inside its demo ("Before the fix")
  decision: "verified" | "failed";
  recorded: string;            // ISO date of the run
  seconds: number;             // start to decision, from the record
  journeys: DemoJourney[];
  failure?: { at: string; expected: string; observed: string };
  shot: StaticImageData;
  shotCaption: string;
};
export type Demo = {
  key: string;
  tab: string;
  title: string;
  app: string;
  url: string;
  claim: string | null;
  journeyName?: string;        // shown when the record has no sentence
  runs: DemoRun[];
  takeaway: string;
};

const ok = (say: string, ms: number): DemoStep => ({ say, ms, ok: true });
const no = (say: string, ms: number): DemoStep => ({ say, ms, ok: false });

const CHECKOUT_SAYS = [
  "Open /pricing.html", "Click “Get Pro”", "Click “Pay”", "Open /account.html",
  "Check Plan shows “Pro”", "Start a fresh browser session", "Open /signin.html",
  "Sign in as the test customer", "Confirm the session is signed in", "Open /account.html",
  "Check Plan shows “Pro”",
];
/** The same eleven planned steps, with each run's own recorded timings and outcome. */
const checkoutSteps = (ms: number[], lastOk: boolean): DemoStep[] =>
  CHECKOUT_SAYS.map((say, i) => ({ say, ms: ms[i], ok: i < CHECKOUT_SAYS.length - 1 || lastOk }));

export const DEMOS: Demo[] = [
  {
    key: "checkout",
    tab: "Checkout",
    title: "A checkout that forgets",
    app: "Lumen Notes, a Vraelis demo app",
    url: "https://broken-checkout.vercel.app",
    claim: "A customer can upgrade to Pro, receive access immediately, and retain Pro after signing out and signing back in.",
    runs: [
      {
        label: "Before the fix",
        decision: "failed",
        recorded: "2026-07-22",
        seconds: 7.6,
        journeys: [{ name: "Upgrade to Pro and verify persistence across sign-out and sign-in", steps: checkoutSteps([135, 468, 417, 113, 149, 82, 113, 1199, 275, 115, 149], false) }],
        failure: { at: "Step 11 of 11", expected: "Plan shows “Pro”", observed: "“Pro” was not on the page" },
        shot: checkoutFailed,
        shotCaption: "The account page after signing back in: Free.",
      },
      {
        label: "After the fix",
        decision: "verified",
        recorded: "2026-07-22",
        seconds: 9.0,
        journeys: [{ name: "Upgrade to Pro and verify persistence across sign-out and sign-in", steps: checkoutSteps([337, 684, 491, 306, 164, 80, 269, 1185, 261, 119, 143], true) }],
        shot: checkoutVerified,
        shotCaption: "The same page after the fix: Pro.",
      },
    ],
    takeaway: "Paying worked and the account showed Pro, so it looked done. After signing out and back in, the plan was Free. A check of the payment step alone would have passed.",
  },
  {
    key: "notes",
    tab: "Notes app",
    title: "A notes app built with Lovable",
    app: "Notewell, a Vraelis demo app built with Lovable",
    url: "https://my-safe-note.lovable.app",
    claim: "A signed-in user can create a note and still see the same note after signing out and signing back in.",
    runs: [
      {
        label: "Verified",
        decision: "verified",
        recorded: "2026-07-31",
        seconds: 17.4,
        journeys: [
          {
            name: "Create and persist a note across sign-out and sign-in",
            steps: [
              ok("Open /auth", 1312),
              ok("Sign in as the test member", 3208),
              ok("Open /dashboard", 123),
              ok("Type “Test note title” into Title", 723),
              ok("Type “Test note body content” into the note", 225),
              ok("Click “Save note”", 342),
              ok("Check Your notes shows the title", 1106),
              ok("Check Your notes shows the body", 85),
              ok("Click “Sign out”", 340),
              ok("Check the address is /auth", 250),
              ok("Sign in as the test member again", 1972),
              ok("Open /dashboard", 103),
              ok("Check Your notes shows the title", 850),
              ok("Check Your notes shows the body", 86),
              ok("Click “Delete” to clean up the test note", 345),
            ],
          },
          {
            name: "Verify dashboard is gated without authentication",
            steps: [
              ok("Start a fresh browser session", 82),
              ok("Open /dashboard while signed out", 114),
              ok("Check the address is /auth", 0),
            ],
          },
        ],
        shot: notesSignedOut,
        shotCaption: "Signed out, /dashboard sent the browser to sign in.",
      },
    ],
    takeaway: "The plan Vraelis wrote from one sentence had two journeys: the note has to survive signing out and back in, and the dashboard must not open for someone who is signed out. The check deleted its own test note at the end.",
  },
  {
    key: "projects",
    tab: "Project tracker",
    title: "A project that vanishes on reload",
    app: "Vraelis fixture dashboard, in its broken mode",
    url: "https://preflight-demo-ten.vercel.app/?mode=broken",
    claim: null,
    journeyName: "Create a project and check it persists",
    runs: [
      {
        label: "Failed",
        decision: "failed",
        recorded: "2026-07-14",
        seconds: 5.0,
        journeys: [
          {
            name: "Create a project and check it persists",
            steps: [
              ok("Open the dashboard", 455),
              ok("Type “Test Project” into Project name", 326),
              ok("Click “Create project”", 324),
              ok("Reload the page", 191),
              no("Check “Test Project” is on the page", 123),
            ],
          },
        ],
        failure: { at: "Step 5 of 5", expected: "“Test Project” is on the page", observed: "Not visible. Created data disappears after refresh." },
        shot: projectsFailed,
        shotCaption: "After one reload: No projects yet.",
      },
    ],
    takeaway: "Creating the project looked fine on screen. One reload later it was gone, which is the kind of bug nobody notices until a customer does.",
  },
];
