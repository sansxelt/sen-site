// Dated release feed. Seeded only with truthful shipped milestones from the repository. Dates and claims are
// real; where a capability points at future work it is labeled as direction, not shipped.
//
// HOW AN ENTRY EARNS ITS PLACE. Every one below was written from the commit that shipped it, and the date is
// that commit's date rather than the date the entry was typed. The feed had gone eleven days stale while the
// product changed underneath it, which is a particular kind of dishonesty for a company whose whole claim is
// that a record should not drift from the thing it records. Prefer fewer, truer entries: one line of work
// that closed is one entry, even when it took nine commits, and nothing goes in that the code does not do.
//
// IT HAPPENED AGAIN, AND WORSE. The commit that now sits at the top of this list edited this very file and
// did not record itself, so the feed ran twelve days behind the code while three bodies of shipped work went
// unrecorded. Writing the entry is part of the commit, not a thing to do afterwards when the code is calm.
// Three commits in that same window are deliberately absent: two refreshed internal documents and one added
// an operator tool, and none of them changed what the product does for anyone reading this page.
//
// FUTURE SCOPE DOES NOT LIVE HERE. It lives on /platform#current, beside the list of what is live, so the two
// are read together and cannot disagree. A changelog is a record of the past; a roadmap sitting inside one
// eventually reads as though it already happened. The single Direction entry at the foot of this file is the
// exception and is dated, because on that date the direction itself was the news.
//
// THE DATES ARE UTC (2026-10-02). An entry is dated from the commit that shipped it, read with
// TZ=UTC git log --date=format-local:%Y-%m-%d, so a late-evening commit in California lands on the next day here,
// exactly as the run records do. Within one day, the later commit sits higher. The text is written from what the
// code does, never from the commit's subject line: "Hero film: the drone filmed, not simulated" (bc0ae260) shipped
// a film whose drone is a render, and the entry below says so.
export type Entry = {
  date: string; tag: "go" | "wait"; tagLabel: string; title: string; body: string[]; note?: string; href?: string; hrefLabel?: string;
  /** One real picture for the entry (plan T10): the console as captured, the film's first frame, or a run's own
   *  screenshot, each a copy in public/site/changelog (sources in its CREDITS.md). src is that public path and w, h
   *  its size in pixels; alt says what is visible. The bar the page draws above it is words only: `address` on the
   *  left (machine text, never translated) and `label` on the right, a whole string such as "Captured 2026-10-02"
   *  (a capture made for this page) or "Recorded 2026-10-02" (the run's own screenshot). `caption` is one sentence
   *  under it and `run` the record's id, printed after the caption in mono. `evidence` marks a run's own
   *  screenshot, which is never shown wider than 640px (plan 0.4). */
  media?: { src: string; alt: string; w: number; h: number; address?: string; label?: string; caption?: string; run?: string; evidence?: boolean };
};

/** An entry's anchor on /changelog: its date and title, so two entries on one day still differ. */
export const entryId = (e: Entry) => `${e.date}-${e.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48)}`;

export const CHANGELOG: Entry[] = [
  {
    date: "2026-10-05", tag: "go", tagLabel: "Shipped",
    title: "Recorded task evidence, now in the app",
    body: [
      "Evaluate whether a request, service response, device report and control-panel report agree on the same task. Review criteria, inspect source events, compare recordings and export the original source with its SHA-256 hash.",
      "The local beta accepts normalized JSON and uncompressed MCAP with flat JSON task-event topics. Files stay in your browser. Included examples are simulations, not customer evidence. Live hardware connections, ROS CDR decoding and compressed MCAP are not built.",
    ], href: "/verifications/recorded", hrefLabel: "Open recorded evidence",
  },
  {
    date: "2026-10-03", tag: "go", tagLabel: "Shipped",
    title: "Real pictures, real evidence",
    body: [
      "The marketing site now uses licensed photographs and genuine screenshots of the software being checked. Rebuilt app windows and screenshots of the current Vraelis console have been removed from the homepage, product and sector pages, menus, cards, documentation and account entry screens.",
      "The recorded examples keep their original run IDs, dates and evidence. Photographs carry their source separately, and the homepage film identifies its rendered scenes."
    ],
    href: "/use-cases", hrefLabel: "Read the records",
  },
  // ── 2026-10-03 (UTC), the day the rebuilt site was pushed, written from the code ─────────────────────────────
  // Plan D, Batch 8: one entry for the rebuild, dated the push day in UTC (if the push slips past 2026-10-04 00:00
  // UTC, this date moves with it). Every fact is in _content/sectors.ts (the registry the Solutions menu, /solutions
  // and the footer read; Enterprise keeps /enterprise), _content/sector-pages.ts (each sector page's record view, a
  // real recorded check), _content/use-cases.ts with use-cases/page.tsx (four records read from strike.ts and
  // demos.ts, on Larkspur and the Vraelis demo apps), _content/docs.ts (the four "Ways to run" pages, whose
  // reference material moved there from /developers) and _system/kit.tsx (FrameHero, the homepage film frame's
  // size). The picture is a capture of /solutions made for this entry (public/site/changelog/CREDITS.md).
  {
    date: "2026-10-03",
    tag: "go",
    tagLabel: "Shipped",
    title: "The site, rebuilt around sectors",
    body: [
      "The menu at the top now has Solutions, with a page for each sector and team Vraelis checks software for: Defense, Robotics and fleets, Fintech and commerce and Public sector, then AI-built apps, SaaS product teams and Agencies. Enterprise keeps its own page. /solutions lists all eight, and each sector page walks through a real recorded check.",
      "Use cases, at /use-cases, tell four recorded checks step by step: the sentence, the plan, every step and what each run found. They ran on Larkspur, a simulated mission console Vraelis built, and on three Vraelis demo apps.",
      "The docs gained four pages under Ways to run: the command line, the API, gating a release in CI, and webhooks. The request and response shapes, the dry run, the gate script and the webhook signature check, which used to sit on the developers page, now live there.",
      "The product pages, every sector page, /company, /security and /limitations now open on one rounded frame, the same size as the homepage film's.",
    ],
    note: "Every check these pages show ran on Larkspur or on a Vraelis demo app, never on a customer's app.",
    href: "/solutions",
    hrefLabel: "See every sector",

  },
  // ── 2026-10-02 to 2026-09-30 (UTC), written on 2026-10-02 from the code and the records ───────────────────
  // 10c6b20f, with bc0ae260, e761edc1, ef7a9c93 and 1ef74d43. Every fact is in _system/hero.tsx, app/film/CREDITS.md,
  // public/home/menu/pics/CREDITS.md and _system/shell.tsx (MENUS).
  {
    date: "2026-10-02",
    tag: "go",
    tagLabel: "Shipped",
    title: "The homepage film, and menus with a picture for every link",
    body: [
      "The homepage film was remade. Our drone, a model rendered by Vraelis, lifts off a pad in a garage and circles the camera while photographed panoramas from Poly Haven change behind it. It holds one place and one size in the frame throughout.",
      "The last shot, a hand catching a drone on a riverbank, is licensed stock footage from Pexels, reframed so that its drone sits where ours was. Phones get a vertical cut of the same film. With reduced motion on, the first frame stays still and the film is not downloaded, and the film can always be paused.",
      "The menus at the top now show a picture beside their links, and it changes to the picture of the link you point at or focus. The pictures are frames of the film, licensed photographs and a screenshot from a real check. Near the end of the homepage, a row now lists the latest entries from this page.",
    ],
    note: "The film is an illustration. It shows no check and claims no result.",
    media: {
      src: "/site/changelog/film-first-frame.jpg", w: 1360, h: 765,
      alt: "Our drone on its landing pad on a garage floor: the first frame of the homepage film, a render made for Vraelis.",
      caption: "The film's first frame, cropped. Our drone is rendered by Vraelis, and the garage is a Poly Haven panorama.",
    },
  },
  // 33313e75, with the fixture from dce43dc9 (lib/fixtures/strike-console.ts). Every fact is in _content/strike.ts,
  // the record of run vrf_51705517.
  {
    date: "2026-10-02",
    tag: "go",
    tagLabel: "Shipped",
    title: "A real check of a simulated mission console",
    body: [
      "Larkspur is a simulated mission console that Vraelis built and serves as a demo fixture. It tracks four contacts on a map and follows one rule: only a hostile contact the operator has confirmed may show Cleared to engage. In its broken mode, confirming T-1 also clears the civilian bus T-3, which is parked in the same grid square.",
      "The homepage now walks through one real check of it, recorded on 2026-10-02: the command that asked for it, the plan a person approved, the steps the browser took and what it found. At step 8 the bus showed Cleared to engage. Every value shown comes from the run's own record.",
    ],
    note: "Nothing in Larkspur controls hardware. Vraelis does not make mission software: it checks it, on a simulation or a staging build.",
    href: "/use-cases/only-the-confirmed-target",
    hrefLabel: "Read the record",
    media: {
      src: "/site/changelog/larkspur-run.png", w: 962, h: 754, evidence: true,
      alt: "The Larkspur console after the operator confirmed T-1: in the contact list, T-1, the armoured vehicle, and T-3, the civilian bus, both show Cleared to engage, and on the map both sit in grid square B3.",
      address: "vraelis.com/api/fixtures/strike?mode=broken",
      label: "Recorded 2026-10-02",
      caption: "The run's own screenshot, cropped to the contacts and the map.",
      run: "vrf_51705517",
    },
  },
  // 496ca8a3 (lib/onboarding.ts, onboarding-card.tsx, setup-checklist.tsx), 09bbf949 (guaranteeFreshness and the
  // record labels in lib/v-audit.ts) and 3f2e4463 (_system/hero.tsx: /app?new=1&url=).
  {
    date: "2026-10-02",
    tag: "go",
    tagLabel: "Shipped",
    title: "Console onboarding questions, and guarantees that say when they were checked",
    body: [
      "The console's Overview now asks an account that is still setting up three questions, once: what you want to check first, how you build, and who looks at the results. Every answer is optional, and Save or Skip puts the card away for good.",
      "The answers shape the setup checklist. Someone who builds with a coding agent is asked to connect it second, not after reading the first record. A team is asked to invite a teammate, and an agency to give its client read-only access. The choices stay within what is built: a web app or a device's control panel can be checked, and a desktop or mobile app says it is not built yet.",
      "A guarantee now says when it was last checked, and says so when its system has been checked again since. In Records, an event about a check names its system, shows the sentence a run checked, and opens the record. The address field on the homepage opens the console's composer with the address already filled in.",
    ],

  },
  // e626f96e (v6.css, pagekit.css, public/vraelis/authenticated.css and styles.css, app/globals.css, shell.tsx).
  {
    date: "2026-10-01",
    tag: "go",
    tagLabel: "Shipped",
    title: "Black site, docs and console",
    body: [
      "The site, the docs, sign-in and the console now share one black ground. Cards sit a step above it with a visible hairline, the main action on a page is white, and text keeps clear steps of grey. It replaces the lighter console from September 30.",
      "The colours that carry a result were tuned for black, so a check that held, one that needs a person and one that failed still read apart. Selected text is inverted everywhere, and the phone menu no longer lets the page behind it scroll.",
    ],

  },
  // 832acebf (5d136273) and b7a7103f: lib/two-step.ts (TOTP_DIGITS, EMAIL_CODE_TTL_S, RECOVERY_CODE_COUNT),
  // lib/two-step-db.ts, lib/two-step-session.ts, app/api/v/two-step/route.ts, account/two-step-section.tsx.
  {
    date: "2026-10-01",
    tag: "go",
    tagLabel: "Shipped",
    title: "Two-step verification",
    body: [
      "An account can now turn on two-step verification from its Account page, with an authenticator app, codes sent by email, or both. Turning it on gives ten recovery codes, shown once.",
      "Once it is on, every way of signing in asks for a code: a password, Google, GitHub and single sign-on. The code is checked on the server, an emailed code works once and for ten minutes, and changing the setting later needs a current code.",
    ],
    note: "It is set for each account. An organization cannot require it of its members.",

  },
  // 3e7fcd3d: lib/i18n/locales.ts (READY_LOCALES), components/language-controller.tsx, lib/i18n/client.ts,
  // components/english-only-notice.tsx.
  {
    date: "2026-10-01",
    tag: "go",
    tagLabel: "Shipped",
    title: "Twelve languages",
    body: [
      "One language switch now changes the site, the docs, sign-in and the console together. They read in English, German, Spanish, French, Hindi, Indonesian, Italian, Japanese, Korean, Dutch, Portuguese and Chinese.",
      "The choice travels on every link, so a shared link opens in the language it was read in, including on the way into the console. A browser remembers it only when Preferences is on in the privacy choices.",
      "Legal pages stay in English, with a note in the reader's language that the English text is the one that applies.",
    ],
    note: "Pages are written in English and translated in the browser. A sentence that has no translation yet shows in English, never as a blank.",

  },
  // 4d80a640 (47884651): app/_components/privacy-choices.tsx, lib/privacy-choice.ts, /cookies and /acceptable-use.
  {
    date: "2026-09-30",
    tag: "go",
    tagLabel: "Shipped",
    title: "Privacy choices",
    body: [
      "Vraelis now asks before it stores or sends anything optional. The same question appears on the site, the docs, sign-in and the console, with three categories: Preferences, Analytics and Advertising measurement. Each stays off until a person turns it on.",
      "Essential only and Save my choices are the same size. A browser that sends Global Privacy Control keeps every optional category off. The legal pages ask in a bar at the foot of the page, so they can be read first.",
      "Privacy choices, in the footer of the site, the docs, the account screens and the console, opens the question again. A cookie policy lists every cookie and storage key the code sets, and the acceptable use policy has its own page.",
    ],

  },
  // ── the entries below were written before 2026-10-02 and stay exactly as written: they are records ───────────
  {
    date: "2026-09-30",
    tag: "go",
    tagLabel: "Shipped",
    title: "A lighter console, one typeface, and docs with real screenshots",
    body: [
      "The console is now light: a grey page with white cards, one blue for the things you act on, and green, amber and red kept for results only. Section titles are real headings, the coloured bars down the left of issue rows are gone, and the button at the end of a run opens that run rather than the list of runs.",
      "The site, the console and every email now use IBM Plex Sans and IBM Plex Mono. Emails share one plain layout: what happened, the details in a table, one action, and why you received it.",
      "The homepage and the docs list everything Vraelis is for, each marked Live, Not built yet or Not covered, from the same list /platform uses. Five docs pages now carry annotated screenshots from real runs, every page says in one sentence what it does not do, and each can be copied as Markdown. /llms.txt indexes the docs for AI assistants.",
    ],
    href: "/docs/what-you-can-check",
    hrefLabel: "What you can check",
  },
  {
    date: "2026-09-28",
    tag: "go",
    tagLabel: "Shipped",
    title: "Vraelis now answers coding agents directly",
    body: [
      "Vraelis runs as an MCP server, so an AI coding assistant can ask for a check after it changes a web app and read the answer itself. Locally, the CLI starts it with vraelis mcp. Hosted, it lives at https://vraelis.com/mcp for ChatGPT and Claude, which sign in with OAuth: the person signs in to Vraelis and clicks Allow, which creates an API key named after the connector that they can revoke under Developers. In ChatGPT and Claude the result shows as a Vraelis card with the status, the claim, the requirements, what broke, and a button that opens the approval page.",
      "There are three tools, vraelis_verify, vraelis_status and vraelis_recheck, and none of them can approve a plan. vraelis init writes the MCP setup for the assistants it finds on the machine and adds a short rule to the project's AGENTS.md telling the assistant to verify before it says it is done.",
      "Every check that waits on a person now returns an approval link, and the CLI prints it, opens it when a person is at the terminal, waits, and runs. API keys can no longer approve plans at all: the approve endpoint answers 403 plan_requires_human with the link. After a fix, POST /v1/verifications/{id}/recheck runs the same approved plan again without a new approval, within 24 hours of the approval, up to 10 times, on the same site, and each re-check is billed as one verification. The TypeScript SDK moved to 0.3.0 with getPlan, waitForApproval and recheck.",
    ],
    note: "The SDK is still unpublished, and the CLI still installs by script rather than from npm.",
    href: "/agents",
    hrefLabel: "Set up an AI assistant",
  },
  {
    date: "2026-09-27",
    tag: "go",
    tagLabel: "Established",
    title: "Vraelis and ByteDance",
    body: [
      "Vraelis and ByteDance, the company behind TikTok, are now official partners. ByteDance’s AI partnerships team first reached out on August 17 about its Seed models. The published record names the date and scope without claiming endorsement, exclusivity or private data access.",
    ],
    href: "/partnerships/bytedance",
    hrefLabel: "Read the partnership record",
  },
  {
    date: "2026-09-18",
    tag: "go",
    tagLabel: "Shipped",
    title: "The TypeScript SDK now follows the verification primitive",
    body: [
      "The SDK can prepare an immutable verification plan, record its approval as a separate event, launch exactly that approved plan with an idempotency key, and read the running or completed result with its decision, evidence, failures and repair guidance.",
      "The workflow keeps review and execution separate in client code instead of making an integration reconstruct the HTTP sequence itself. Offline package tests cover both module formats, request paths, plan binding, retry keys and the terminal decision shape.",
    ],
    note: "The package is built and tested in the repository but is still private and has not been published to npm.",
    href: "/developers",
    hrefLabel: "Read the developer guide",
  },
  {
    date: "2026-09-17",
    tag: "go",
    tagLabel: "Established",
    title: "Vraelis and Reddit",
    body: [
      "Vraelis established an advertising relationship with Reddit to develop its presence and reach relevant communities through Reddit Ads. The published record names the date and scope without claiming endorsement, exclusivity, campaign performance or private user-data access.",
    ],
    href: "/partnerships/reddit",
    hrefLabel: "Read the partnership record",
  },
  {
    date: "2026-09-07",
    tag: "go",
    tagLabel: "Shipped",
    title: "Verified now means the evidence earned it",
    body: [
      "The console could briefly render Verified while a decision was still being derived, and the same signal was drawn nine different ways across the product. The premature result is gone and the decision state now comes from one shared system.",
      "The public launch was tightened at the same time: missing routes stop inviting search engines to index them, attribution no longer collapses a large share of visits into other, and the repository check runs against the same code that is deployed.",
    ],
  },
  {
    date: "2026-08-25",
    tag: "go",
    tagLabel: "Hardened",
    title: "The launch paths were re-attacked before they were trusted",
    body: [
      "An independent security pass and follow-up review closed cross-tenant reads, incomplete session revocation, weak sign-in limits, unsafe outbound requests, origin gaps, unbounded resources and payment decisions that could rely on model output alone.",
      "Database privilege changes were rehearsed against staging, applied in an ordered production migration and paired with rollback verification. Credit holds, expirations and payment caps now use atomic database operations rather than read-then-write decisions.",
    ],
    note: "This records the reviewed launch surface. It is not a claim that future code or every dependency is free of defects.",
  },
  {
    date: "2026-08-10",
    tag: "go",
    tagLabel: "Shipped",
    title: "Three surfaces that disagreed with the ground they were standing on",
    body: [
      "Six arrival surfaces painted the retired cream palette on a graphite ground. Sign in measured 1.0:1. The team invite page, both error screens, the console bar's pre-measurement fallback and the product's mobile drawer were the others, the last of which opened as a cream sheet over the graphite console with its active-page marker in green, which in this product means a verification held.",
      "Every in-page anchor landed 97px past the section it named, because the scrollport's reserved space and the target's own offset add rather than replace. There is one offset now, measured from the real bar. And a window shorter than 768px cut the third layer off a pinned scene instead of compressing it, so pinning stops below that height.",
    ],
  },
  {
    date: "2026-08-03",
    tag: "go",
    tagLabel: "Shipped",
    title: "The refusal now runs on every path that starts a run",
    body: [
      "Vraelis declines to charge when it cannot build a check that would prove the claim. That refusal ran on the public API and on guarantee preparation, and nowhere else, so the two paths a person actually takes, a launch from the console and a targeted rerun, never reached it. It now runs above every credit hold and above the free pass, so nothing is spent before the decision to refuse is made.",
      "A contract that never stated an outcome cannot be gated, because there is nothing to gate it against. Those launches are recorded as ungated rather than counted as having passed, so the size of what is left is measurable instead of arguable.",
    ],
  },
  {
    date: "2026-08-03",
    tag: "go",
    tagLabel: "Shipped",
    title: "A tab whose table has no writer",
    body: [
      "Repairs read from a table that nothing inserts into, so the tab and its page rendered an empty state on every account that has ever existed. Both are hidden until something writes it, which is one flag the day something does. Nothing was deleted.",
    ],
    note: "Hidden, not removed. The repair prompt itself is unaffected: it lives on the issue and on the run report, which is where it always was.",
  },
  {
    date: "2026-08-03",
    tag: "go",
    tagLabel: "Shipped",
    title: "The nudge emails judged a balance in a denomination nobody spends",
    body: [
      "The ledger has held two units since passes were priced, and the lifecycle mailer summed both into one number. An account holding nothing but dead rows was told its balance was waiting for it.",
      "The low-balance email also fired at a threshold from a retired pricing model, which was three per cent of a single launch. It now fires at the moment the balance can no longer buy one pass, which is the same moment the product itself refuses.",
    ],
  },
  {
    date: "2026-07-30",
    tag: "go",
    tagLabel: "Shipped",
    title: "The last false Verified",
    body: [
      "An adversarial sweep of the live guarantee found that eight of eleven approved plans could not tell a working application from a broken one. A rejected sign-in was recorded as a successful one, because the check looked for a session-shaped cookie and an anonymous visitor already carries several. An unsaved form satisfied the assertion that it had saved. A flow that never ran was dropped from the verdict instead of failing it, and an empty one passed.",
      "Every one of those is now closed, and the last surface that translated a partial-coverage rerun into a green Verified was corrected to say Blocked, which is what the API, the CI gate and the webhooks had been saying about the same run all along.",
    ],
    note: "A repair rerun exercises only the flows that had failed. That is evidence the repair worked, not evidence the whole guarantee holds, and it is no longer allowed to read as the latter.",
  },
  {
    date: "2026-07-30",
    tag: "go",
    tagLabel: "Shipped",
    title: "A run refuses an address that does not resolve",
    body: [
      "A verification pointed at a mistyped hostname used to queue, drive a real browser at nothing, return Blocked, and keep the charge. The product took payment to report that a URL was wrong. The hostname is now resolved before a run is admitted, above the hold and above the free pass, so a typo costs nothing rather than costing the one free run an account is given.",
      "It asks only whether the name resolves. A real deployment is allowed to answer 404 or 401, and everything ambiguous is let through, including a timeout, because refusing a real customer over a slow second is worse than the charge it would have prevented.",
    ],
  },
  {
    date: "2026-07-30",
    tag: "go",
    tagLabel: "Shipped",
    title: "A single verification can be paid for on its own",
    body: [
      "Pay as you go no longer needs a subscription behind it. The price and the balance had been held in different units, so a customer could top up, watch the balance rise, relaunch, and be refused again forever by a product that could not see the money it had just taken.",
    ],
  },
  {
    date: "2026-07-28",
    tag: "go",
    tagLabel: "Shipped",
    title: "Plans priced on what stays proven, and a way off one",
    body: [
      "The four plans differed only by three numbers, and not one of them mentioned a guarantee. Nobody wants forty verifications; they want checkout to keep granting access and sign-in to keep working. A plan now leads with how many guarantees it keeps proven, and the capacity that pays for that is stated underneath rather than sold as the product.",
      "There is an enterprise tier, and cancelling is a real path with a record rather than a button with nothing behind it.",
    ],
  },
  {
    date: "2026-07-28",
    tag: "go",
    tagLabel: "Shipped",
    title: "The CLI installs as a command",
    body: [
      "One line puts a vraelis command on the PATH, on macOS, Linux and Windows. It signs in and stores a key, says which credential is winning when a machine holds more than one, and exits 0, 1 or 2 for Verified, Failed and Blocked, so a deploy can be gated on the exit code alone. The installer is served as plain text so it can be read before it is run.",
    ],
    note: "Installed by script. The npm package is prepared but not published yet, so the script is the only way to install it for now.",
  },
  {
    date: "2026-07-26",
    tag: "go",
    tagLabel: "Shipped",
    title: "One site, one console, one design",
    body: [
      "The public site was replaced and the console was given the same treatment on a graphite ground, so the walk from a marketing page to sign-in to the product no longer crosses three visual identities. Six pages were added, including the limitations and current-capability surfaces this company would rather a reader found on its own site than worked out later.",
    ],
  },
  {
    date: "2026-07-25",
    tag: "go",
    tagLabel: "Shipped",
    title: "A model may author a requirement, but only a person may review it",
    body: [
      "Authorship and review became separate recorded facts. A requirement the system wrote is marked machine-authored and awaiting review, and there is no state in which it approves itself. Submitting a claim without an approved plan returns the plan for review and runs nothing.",
      "Running discovery again against an approved contract now refuses, rather than quietly rewriting the meaning an earlier verification was measured against.",
    ],
  },
  {
    date: "2026-07-23",
    tag: "go",
    tagLabel: "Shipped",
    title: "Canonical verification result page",
    body: [
      "A verification now has one read-only result page: the claim, the decision, the evidence, and the provenance, in a single canonical route. A decision is translated through one place, so what a person reads and what a machine reads never disagree.",
    ],
  },
  {
    date: "2026-07-23",
    tag: "go",
    tagLabel: "Shipped",
    title: "Webhooks: verification.completed",
    body: [
      "External systems can now receive a verification.completed event when a run finishes, with the canonical decision and a reference to its evidence. The production delivery path was proven end to end against a real run.",
    ],
  },
  {
    date: "2026-07-22",
    tag: "go",
    tagLabel: "Shipped",
    title: "Reviewed plans, approved once and consumed exactly",
    body: [
      "A dry run now mints an immutable plan. A person approves that exact plan, and a paid execution consumes exactly what was reviewed, nothing more. The standard a completion is judged by is fixed before the work is judged, and the building agent cannot change it.",
    ],
  },
  {
    date: "2026-07-22",
    tag: "go",
    tagLabel: "Proven",
    title: "A full Failed to Verified repair loop, on a real run",
    body: [
      "The complete loop closed end to end against a live application: a claim failed against its requirement, a repair was submitted, and the repair was independently verified, with the earlier failed record preserved rather than overwritten.",
    ],
  },
  {
    date: "2026-07-21",
    tag: "go",
    tagLabel: "Shipped",
    title: "The verification primitive",
    body: [
      "The core surface became a single primitive: submit a claimed outcome and a deployment, receive an evidence-backed decision of Verified, Failed, or Blocked. Everything else in the product is built on that one honest answer.",
    ],
  },
  {
    date: "2026-07-20",
    tag: "wait",
    tagLabel: "Direction",
    title: "Toward continuous agent oversight",
    body: [
      "The verification engine is one capability inside a broader direction: following an agent's activity continuously, ingesting live plans and changes, and making autonomy decisions from an agent's track record.",
    ],
    // The renderer already prints a bold "Direction" label before this, so the note must not open with the
    // word again: it extracted and read as "DirectionDirection, not shipped."
    note: "Not shipped. Live activity ingestion and autonomy decisions are not yet available.",
  },
];
