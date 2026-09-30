// SPECIFIC EXAMPLES, shown one at a time as the reader scrolls the homepage (_system/examples.tsx).
//
// The founder's call (2026-09-29): the idea is general, so the homepage stays short and tight, and the
// scroll is where it gets specific. Each example names a kind of product, the one sentence someone would
// write about it, what Vraelis actually does in the browser, and the kind of bug that sentence catches.
//
// THESE ARE EXAMPLES, and the section says so. Two of them have recorded runs in the real-runs section
// directly below (the checkout and the notes app), and those two link to them; the rest show what a check
// would do. Every "does" line is built only from what a Vraelis plan can ask a browser to do: open a page,
// click, type, sign in as a test role, start a fresh session, reload, and read the page or its address. A
// device example goes through the device's web control panel, because that is the only way in today.
export type Example = {
  key: string;
  kind: string;
  sentence: string;
  does: string[];
  catches: string;
  /** Present when a recorded run of this exact kind is on the page. */
  recorded?: string;
};

export const EXAMPLES: Example[] = [
  {
    key: "subscription",
    kind: "A subscription app",
    sentence: "After paying for Pro, the account shows Pro, and still does after signing out and back in.",
    does: [
      "Opens Pricing and pays with the test card",
      "Reads the plan on the account page",
      "Signs out, then signs back in as the same customer",
      "Reads the plan again",
    ],
    catches: "A payment that goes through while access never arrives, or quietly disappears on the next sign-in.",
    recorded: "checkout",
  },
  {
    key: "drone",
    kind: "A drone fleet console",
    sentence: "When an operator presses Return home for SKY-01, it lands at Pad A and still shows Landed after a reload.",
    does: [
      "Opens the fleet console",
      "Presses Return home for SKY-01",
      "Waits for SKY-01 to report Landed at Pad A",
      "Reloads the console and reads it again",
    ],
    catches: "A command the console confirms while the aircraft it was meant for never receives it.",
  },
  {
    key: "robot",
    kind: "A robot work cell",
    sentence: "Pressing Emergency stop on Cell 2 shows the arm as Stopped, and it is still Stopped after a reload.",
    does: [
      "Opens the cell's control panel",
      "Presses Emergency stop",
      "Reads the state the arm reports",
      "Reloads the panel and reads it again",
    ],
    catches: "A stop the panel shows for a moment but does not keep.",
  },
  {
    key: "roles",
    kind: "A team workspace",
    sentence: "Someone with the Viewer role can open the quarterly report but has no way to delete it.",
    does: [
      "Signs in with the Viewer test account",
      "Opens the quarterly report",
      "Looks for a way to delete it",
      "Confirms the report is still there",
    ],
    catches: "A role that can see, or do, more than it should.",
  },
  {
    key: "notes",
    kind: "A notes app",
    sentence: "A note someone writes is still there after they sign out and sign back in.",
    does: [
      "Signs in and writes a note",
      "Saves it and finds it in the list",
      "Signs out, then signs back in",
      "Looks for the same note",
    ],
    catches: "Work that looks saved on screen and is gone on the next visit.",
    recorded: "notes",
  },
  {
    key: "booking",
    kind: "A booking site",
    sentence: "Once a visitor books the 3pm slot, the next visitor sees 3pm as taken.",
    does: [
      "Books the 3pm slot as one visitor",
      "Starts a fresh browser session as a second visitor",
      "Opens the same day's calendar",
      "Checks that 3pm reads Taken",
    ],
    catches: "Two customers holding the same slot.",
  },
];

export const EXAMPLES_NOTE = "Examples. The subscription and notes checks have recorded runs just below; the rest show what a check would do.";
export const EXAMPLES_LIMIT = "It checks what a browser can do and see: web apps, and devices through the web panel that runs them. It does not read your database, your inbox, or a device's firmware directly.";
