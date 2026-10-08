# Documentation image sources

## Current editorial photography — October 7, 2026

The documentation uses 40 licensed stock photographs: two index thumbnails and
two compact context images for each of the 19 articles. Source photographs,
authors and licenses are listed in [the site photography credits](/site/photography/CREDITS.md)
and [the source manifest](/site/photography/editorial-sources.json).
These images illustrate engineering contexts; they are not Vraelis product
screenshots, facilities, customers or evidence of a deployment.

## Earlier console captures (archive)

The files documented below are historical captures. They are not shown in the
current public documentation while product access remains closed.

### Batch 7a

Every picture in this folder is a capture of the Vraelis console itself, the black console (design 08), taken on
2026-10-02 from the QA account's own records with a local signed-in session, headless Chrome at 1100 CSS px wide and
device pixel ratio 2. Nothing was created, approved, run or changed to take them: each page was only loaded and
measured. The crops are cropped only, never recoloured, retouched or resized, and saved as lossless WebP (pixel for
pixel the capture). The five figures keep their old file names and the 1678 px width of the white ones they replace,
so the marks in `app/dev-preview/v6/_content/docs.ts` are percentages measured on these files.

The runs are the QA account's checks of Notewell (https://my-safe-note.lovable.app, a demo app built with Lovable):
system 843270b4-3e27-4723-9fb7-116482e6e148, failed pass a3745f3b-2406-4d1c-a53e-5096d7554912, and verified pass
4fc6e52c-d018-4de0-ad58-9298252d8498 (recorded 2026-07-31, `_content/demos.ts`). Scripts: `SP/qa/b7a-docs/capture.mjs`
(captures and marks) and `SP/qa/b7a-docs/markview.mjs` (draws the marks to check them), where SP is the session
scratchpad.

Checked on every file: no faces, no insignia, no third-party brand marks, no personal data (no names, email
addresses, organisation names or key prefixes; the test account is labelled "member"), no readable third-party data
beyond the demo app's own address. Dev-only overlays (the Next.js indicator and the notes launcher) were hidden.

| File | What it shows | Console page | Size | Mean luminance |
|---|---|---|---|---|
| run-report-head.webp | The top of the failed run's report: Notewell, its address, when it completed, the Failed badge, and the sentence that had to be true | /systems/843270b4.../passes/a3745f3b... | 1678x640 | 15.2 |
| run-journey-failed-step.webp | The first journey of the failed run: run as the member test account, step 1 passed, step 2 (sign_in_as member) failed after 20.6 s | /systems/843270b4.../passes/a3745f3b... | 1678x682 | 25.3 |
| run-repair-prompt.webp | The repair handoff of the failed run: the repair prompt for a coding agent and its Copy button | /systems/843270b4.../passes/a3745f3b... | 1678x1000 | 25.2 |
| run-outcome-verified.webp | The outcome of the verified run: Verified, 2 of 2 critical flows passed, and why | /systems/843270b4.../passes/4fc6e52c... | 1678x392 | 14.6 |
| overview-needs-attention.webp | Needs attention on the console Overview: four findings on Notewell | /app | 1678x644 | 24.3 |
| card-getting-started.webp | A crop of run-report-head (Notewell, its address, the sentence), for the docs home | as run-report-head | 800x450 | 21.0 |
| card-the-loop.webp | A crop of run-journey-failed-step (the journey and its failed step), for the docs home | as run-journey-failed-step | 800x450 | 32.3 |
| card-ai-assistants.webp | The console's Command line page, the block after install: vraelis login, vraelis init, verify and recheck | /cli | 800x450 | 33.7 |
