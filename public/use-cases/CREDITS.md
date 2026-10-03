# Evidence crops for the use-case pages and the record panels: sources (b5b, 2026-10-02)

Every picture in this folder is a crop of a run's own screenshot, the file the run recorded, kept in
`app/dev-preview/v6/_content/demos/` (1280x800, device pixel ratio 1). Nothing was resized, recoloured, retouched
or masked: each file is the source's pixels inside the crop box below, written as PNG by
`SP/qa/b5b-usecases/crop.mjs` (sharp `extract`). They are evidence (plan 0.2, 0.4), shown at most 640px wide and
never wider than their own pixels.

**Licence.** Our own work: screenshots of Vraelis's own demo apps and fixtures, taken by Vraelis runs. No
third-party photograph, footage or licensed material is in them.

**Checked** in every file: no faces, no insignia, no readable third-party brand mark (the "Edit with Lovable"
badge at the bottom right of the Notewell screenshot is outside its crop), no personal data, no readable
third-party data. The apps are Vraelis demo apps; the text in them is their own.

| File | Source screenshot | Run | Crop box (x, y, w, h) | What it shows | Mean luminance |
|---|---|---|---|---|---|
| checkout-before-plan.png (880x248) | checkout-failed.png | 3fad10f5, Lumen Notes, 2026-07-22, before the fix | 200, 96, 880, 248 | The account page after signing back in: "Your account", the Plan card, "Current plan: Free" | luma 250.0 of 255 |
| checkout-after-plan.png (880x248) | checkout-verified.png | 588c48f7, Lumen Notes, 2026-07-22, after the fix | 200, 96, 880, 248 (the same strip) | The same page after the fix: "Current plan: Pro" | luma 249.7 of 255 |
| notes-sign-in.png (480x480) | notes-signed-out.png | 4fc6e52c, Notewell, 2026-07-31 | 400, 200, 480, 480 | The sign-in card ("Welcome back, Sign in to your notes.") where the browser was sent after opening /dashboard while signed out | luma 235.8 of 255 |
| projects-after-reload.png (640x354) | projects-failed.png | de53ab8b, fixture dashboard (broken mode), 2026-07-14 | 320, 76, 640, 354 | After one reload: "This is a Vraelis test fixture", "Your projects", "No projects yet. Create one above.", "mode: broken (records live in memory only)" | luma 243.1 of 255 |

The Larkspur record (run vrf_51705517, 2026-10-02) needs no crop here: its contact list is already cut from the
run's screenshot as `app/dev-preview/v6/_content/demos/strike-contacts.png` (250x306).
