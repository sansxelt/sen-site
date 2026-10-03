# In-page product pictures: sources

Pictures shown inside product pages (not heroes; heroes are in `public/site/hero/`). Each row names the file, what
it shows, where it came from, what was checked and its mean luminance. Pages show each one with "Captured
2026-10-02" (a console capture) or "Captured 2026-10-02, not from the run" (a fixture or demo-app capture).

## /platform, "How it works" (batch b4a)

Four captures of our own product, the Vraelis console, made on 2026-10-02 (UTC). No third-party photograph,
footage, logo or licensed material is in them; type is IBM Plex Sans and IBM Plex Mono (SIL Open Font License 1.1,
`app/fonts/OFL.txt`).

**How they were made.** Headless Chrome at 1040x900 CSS px and device pixel ratio 2, signed in as the QA account
(demo@vraelis.com) on the local console (http://localhost:3100, the same console code that serves
app.vraelis.com). Read only: every request other than GET, HEAD or OPTIONS was blocked and listed (the only ones
were the Next.js dev overlay's own stack-frame POSTs on one console page, blocked), and nothing was clicked,
typed or submitted, so no plan was created, approved or run. The floating Notes launcher, the Next.js development
badge and the console's sticky top bar were hidden while capturing. One `<details>` disclosure was opened (what a
reader's click on "View steps" does) for platform-run-steps.png. Each picture is a crop of the page; the only change to the
pixels is the masking below. Script: `SP/qa/b4a-platform/cap4.mjs` (SP is the session scratchpad).

**Masking.** Personal data is painted over with a flat #26262B box: the approver's email address in
platform-plan.png (one place, the approval line). No other email, name, organisation name or API key prefix is
inside any crop.

**Why platform-plan.png is not a pending plan.** The plan (A7.5, C /platform) asked for the Review page with a
pending plan. The Review page was empty ("Nothing is waiting on you") and creating a plan was not allowed, so the
picture is the approved plan of an existing check, and the page's caption says so.

| File | Kind | What it shows | Source page | Masked | Checked | Mean luminance |
|---|---|---|---|---|---|---|
| platform-sentence.png (1520x932) | console capture | The composer, empty, as the top bar's New verification opens it: "New verification", "What should be true?", its lead, the Deployment to verify field (placeholder your-app.vercel.app), the What must be true field (placeholder "A signed-in user can create a record, and it is still there after signing out and back in."), the Review the proof plan button and "No one is charged to review a plan. You approve the exact requirements before anything runs." The account's credit balance line under it is left out of the crop. | /app?new=1 | Nothing: no personal data inside the crop | No faces, insignia, brand marks, third-party data or personal data | luma 28.0 of 255 (11.0%) |
| platform-plan.png (1384x790) | console capture | A guarantee record's approved proof plan: thirteen requirements for the Notewell demo app, then "Approved by [masked], 67 days ago, plan v5. Each re-check runs this exact plan; a changed definition returns it for re-approval." | /systems/843270b4-3e27-4723-9fb7-116482e6e148/guarantees/grt_c8110fd1-563b-41e7-8ef4-c40db1fac6f7 | The approver's email address (one box, approval line) | No faces, insignia, brand marks or third-party data (Notewell is our own demo app); the email is masked | luma 18.4 of 255 (7.2%) |
| platform-run-steps.png (1592x798) | console capture | Run 4fc6e52c (Notewell, recorded 2026-07-31), its execution journey: the flow "Create and persist a note across sign-out and sign-in" (Authenticated, Passed, 15 steps), the authenticated-flow line (Role: member, Credential: Active, Session reuse on) and its first five recorded steps with their timings, from "Open https://my-safe-note.lovable.app/auth" (1.3 s) to "Fill Start writing..." (225 ms). | /systems/843270b4-3e27-4723-9fb7-116482e6e148/passes/4fc6e52c-d018-4de0-ad58-9298252d8498 | Nothing: no personal data inside the crop (the test member's sign-in is the step "sign_in_as member", no address) | No faces, insignia, brand marks, third-party data or personal data | luma 25.2 of 255 (9.9%) |
| platform-repair-prompt.png (1592x784) | console capture | A failed Notewell record's Repair handoff: "Each prompt describes the observed failure and the requested repair for a coding agent...", the card "Repair prompt for a coding agent" with Copy repair prompt, and the top of the prompt itself: what was being checked (Expected Your notes to show "Test note title"), what happened instead ("Test note title" was not present) and the first three steps to reproduce; the crop ends under the third step. The record's evidence screenshot, which shows a test sign-in address, is outside the crop. | /systems/843270b4-3e27-4723-9fb7-116482e6e148/passes/a3745f3b-2406-4d1c-a53e-5096d7554912 (run a3745f3b, completed 2026-07-31 01:55 UTC as the console prints it; the page's caption names the record) | Nothing: no personal data inside the crop | No faces, insignia, brand marks, third-party data or personal data | luma 25.0 of 255 (9.8%) |

## Related cards on /agents and /integrations (final review, 2026-10-02)

Two 16:10 CrossLinks cards for targets the images batch made no card for: Documentation (on /integrations) and the
AI assistant setup guide (on /agents). The Pricing card on /enterprise is `public/site/card/pricing-16x10.jpg`, the
one the sector pages use, so each target has one picture across the site. Made the way that batch made its coded-panel cards
(`public/site/card/CREDITS.md`, agents-16x10.jpg and developers-16x10.jpg): a static mock of a panel on the FrameHero
panel-kind ground (#0E0E10 with one soft light), in a MediaPanel-style shell with a words-only bar, running off the
bottom edge; no window dots and no decorative dots. Rendered headless at 480x300 CSS px, device pixel ratio 10/3
(1600x1000), in IBM Plex Sans and IBM Plex Mono (SIL Open Font License 1.1, `app/fonts/OFL.txt`), saved as JPEG
quality 82, 4:4:4. The words are read out of the page sources, never retyped. Scripts: `SP/qa/p3/fix-product/cards/`
(`extract.mjs` reads the sources, `cards.html` lays out the panels, `render.mjs` renders them), where SP is the
session scratchpad. All our own work; no photograph, logo or licensed material, and the assistants are named in our
own type, as the /agents page names them.

| File | Kind | What it shows | Source | Masked | Checked | Mean luminance |
|---|---|---|---|---|---|---|
| docs-16x10.jpg (1600x1000) | coded panel (static mock) | Bar "vraelis.com/docs" and "By interface". The docs home's four interfaces, each with the one line a reader types: Console (app.vraelis.com), CLI (vraelis verify --url URL --claim "..." --wait), API (POST /v1/verifications), AI assistants (vraelis init). | `app/dev-preview/v6/docs/page.tsx` BY_INTERFACE | Nothing to mask | No faces, insignia, brand marks, third-party or personal data | luma 17.8 of 255 (7.0%), black point 7 |
| ai-assistants-guide-16x10.jpg (1600x1000) | coded panel (static mock) | Bar "vraelis.com/docs/ai-assistants" and "Setup guide". The first six assistants the setup guide covers, each with how it connects: Claude Code, Codex, Gemini CLI, GitHub Copilot in VS Code, GitHub Copilot CLI and Cursor, all "Local server"; the list runs on past the card's edge. | `app/dev-preview/v6/agents/page.tsx` ASSISTANTS | Nothing to mask | No faces, insignia or personal data; the assistant names are set in our own type, never their marks | luma 19.5 of 255 (7.6%), black point 6 |
