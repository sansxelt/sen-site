// THE FIGURES IN THE RESEARCH ARTICLES (plan C, /research/<slug>, 2026-10-02).
//
// The prose is not here and never will be: it stays in app/rank/research/_articles.ts, the one registry, and
// research/[slug]/page.tsx renders it. This file only says which recorded screenshot sits in which article and
// where: after the last block of the section whose h2 is `after` (the heading's text, verbatim from the registry),
// or at the end of the article when no heading matches, so an edit to the prose can move a figure but never lose it.
//
// EVERY PICTURE IS EVIDENCE. Each is a crop of a run's own screenshot (_content/demos/*.png, 1280x800), cut to the
// strip the caption describes and never recoloured or retouched, copied into public/site/changelog with its source
// in the CREDITS.md there. They are shown at their own size, at most 640px wide (plan 0.4), one figure per article.
// The words follow the records in _content/demos.ts: the labels "Before the fix" and "After the fix" are the
// record's own, and Notewell's second journey is said to have passed because it did.
//
// Two of the five articles have no figure: they argue a definition and a structure, and no recorded screenshot
// shows either.

/** One recorded screenshot: a public path with its size, what it shows, and the words-only bar above it. */
export type ResearchShot = { src: string; w: number; h: number; alt: string; address: string; label: string };

/** A figure: one shot, or a before-and-after pair cut to the same strip (which counts as one, plan 0.4). `caption`
 *  is whole sentences; `runs` are the record ids, printed after it in mono; `record` is the use-case page that
 *  tells the whole check, with its path written without the site prefix. */
export type ResearchFigure = {
  after: string;
  shots: ResearchShot[];
  caption: string;
  runs: string[];
  record: { href: string; label: string };
};

export const RESEARCH_FIGURES: Readonly<Record<string, ResearchFigure>> = {
  // Run 4fc6e52c, Notewell (built with Lovable), 2026-07-31. Its second journey, "Verify dashboard is gated without
  // authentication", passed: signed out, /dashboard sent the browser to sign in. Crop of notes-signed-out.png.
  "ai-said-it-was-done": {
    after: "What would actually settle it",
    shots: [{
      src: "/site/changelog/research-notes-signed-out.png", w: 400, h: 416,
      alt: "Notewell's sign-in card, Welcome back, where the browser landed after opening /dashboard while signed out.",
      address: "my-safe-note.lovable.app/auth",
      label: "Recorded 2026-07-31",
    }],
    caption: "From a recorded check of Notewell, an app built with Lovable: signed out, /dashboard sent the browser to sign in. That journey passed.",
    runs: ["4fc6e52c"],
    record: { href: "/use-cases/notes-that-survive-sign-out", label: "Read the record" },
  },
  // Run de53ab8b, the fixture dashboard in its broken mode, 2026-07-14: found a problem at step 5 of 5, expected
  // "Test Project" on the page, observed "Not visible. Created data disappears after refresh." Crop of
  // projects-failed.png.
  "browser-testing-is-not-verification": {
    after: "Where they come apart",
    shots: [{
      src: "/site/changelog/research-projects-reload.png", w: 628, h: 288,
      alt: "The fixture dashboard after one reload: under Your projects it says No projects yet. Create one above.",
      address: "preflight-demo-ten.vercel.app/?mode=broken",
      label: "Recorded 2026-07-14",
    }],
    caption: "The same shape in a recorded check of our fixture dashboard: creating a project looked fine on screen, and after one reload the page said No projects yet.",
    runs: ["de53ab8b"],
    record: { href: "/use-cases/project-that-vanishes", label: "Read the record" },
  },
  // Runs 3fad10f5 (before the fix: found a problem at step 11 of 11, after signing out and back in) and 588c48f7
  // (after the fix), Lumen Notes, both 2026-07-22, the demonstration this article walks through. The same strip of
  // checkout-failed.png and checkout-verified.png: the Plan card's first line.
  "from-failure-to-verified-repair": {
    after: "Verified",
    shots: [
      {
        src: "/site/changelog/research-checkout-before.png", w: 500, h: 136,
        alt: "Lumen Notes' account page after signing out and back in, before the fix: Current plan: Free.",
        address: "broken-checkout.vercel.app",
        label: "Before the fix",
      },
      {
        src: "/site/changelog/research-checkout-after.png", w: 500, h: 136,
        alt: "The same strip after the fix: Current plan: Pro.",
        address: "broken-checkout.vercel.app",
        label: "After the fix",
      },
    ],
    caption: "The account page after signing out and back in, from two runs recorded on 2026-07-22: Free after the incomplete repair, Pro after the complete one.",
    runs: ["3fad10f5", "588c48f7"],
    record: { href: "/use-cases/checkout-that-forgets", label: "Read the record" },
  },
};
