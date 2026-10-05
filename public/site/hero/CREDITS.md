# Hero pictures: sources

Fourteen pictures for the FrameHero of ten pages, all made on 2026-10-02 by the images batch (Batch 0): the scene
pictures of /platform, /company, /solutions/fleets and /solutions/defense, and the panel images of
/solutions/commerce, /solutions/saas, /solutions/ai-built-apps, /solutions/agencies, /enterprise and /security.
The coded panels (/agents, /developers, /integrations, /solutions/public-sector) are drawn by their pages and have
no file here. Every row below gives the file, what it shows, its source, its author and licence, what was checked,
what was masked and its mean luminance (plan A7.4). Luminance is the Rec. 709 luma of the encoded values, as
`SP/qa/imagecheck.mjs` measures it; the black point is the 0.5th percentile of that luma. SP is the session
scratchpad.

**Renders (platform, fleets, company).** Stills from our own renders: the homepage film's renderer, `app/film/orbit`,
used as it is, with its still parameters (`?dpr=1.5&dx=..&dy=..`, and `&portrait` for the 9:16 cut), and our own
drone model (`app/dev-preview/v6/_system/drone-model.tsx`). The camera turns (`dx`, `dy`) were solved from the
take's own camera math so the drone sits clear of the headline, at the upper right. Each still is one instant, so
the drone is whole and sharp; none is cut from `public/home/film.mp4`, and none uses the hand catch. The places are
Poly Haven panoramas, CC0 (https://polyhaven.com/license): Autoshop 01 (https://polyhaven.com/a/autoshop_01) and
Bambanani Sunset (https://polyhaven.com/a/bambanani_sunset). Grade (plan A7.3): the renderer's own vignette divided
out exactly (no vignette is left beyond the FrameHero shade), saturation 80% in linear light, one exposure solved
for the mean luminance, a gentle contrast curve (1.08), the black point lifted to #0C0C0D, light monochrome grain,
JPEG quality 82. Scripts: `SP/qa/b0/film-stills.mjs`, `SP/qa/b0/project.py`, `SP/qa/b0/grade.py`,
`SP/qa/b0/build_renders.py`.

**Captures of our fixtures and demo apps (defense, commerce, saas).** Fresh captures of Vraelis demo fixtures and
demo apps, headless Chrome, UTC clock, a new browser each time, nothing changed but the steps named in the row;
cropped only, never recoloured. Each is labelled "Captured 2026-10-02, not from the run" wherever it is shown. The
Larkspur pictures come from the same fixture code vraelis.com serves (`lib/fixtures/strike-console.ts`), loaded at
http://localhost:3100/api/fixtures/strike?mode=broken. Larkspur is a simulated mission console Vraelis built; say
so wherever it is shown. Scripts: `SP/qa/b0/capture-larkspur.mjs`, `SP/qa/b0/capture-demos.mjs`,
`SP/qa/b0/build_captures.py`.

**Recorded evidence (ai-built-apps).** A crop of the screenshot run 4fc6e52c recorded on 2026-07-31; cropped only,
never recoloured, never resized.

**Console captures (enterprise, security, agencies).** Our own product. Headless Chrome at 900x900 CSS px and device
pixel ratio 2, signed in as the QA account (demo@vraelis.com) on the local console (http://localhost:3100, the same
console code that serves app.vraelis.com). The capture was read only: every request other than GET, HEAD or OPTIONS
was blocked, and nothing was clicked, typed or submitted, so no plan was created, approved or run. The floating
Notes launcher and the Next.js development badge were hidden while capturing. Each picture is a crop of the page;
the only change to the pixels is the masking. Scripts: `SP/qa/b0/console-capture.mjs` then `SP/qa/b0/mask-crop.py`.

**Masking.** Personal data was painted over with flat #121214 boxes: the account's email address wherever it
appeared inside a crop, which is two places, the approval line of security-panel.png and the Members row of
agencies-panel.png. No names, organisation names or API key prefixes are inside any crop (the workspace name, the
avatar and the API key list are outside all three; the member list inside agencies-panel.png is the account's own
row, with its email masked). The masks came from a text search of each page for the account email, any email, the display
name and the `vr_live_` and `vr_test_` key prefixes. Unmasked raw captures stay in the scratchpad only
(`SP/qa/b0/raw/`).

**Licences.** Renders, captures and evidence are our own work. The panoramas are CC0 (Poly Haven, links above). The
console's type is IBM Plex Sans and IBM Plex Mono, SIL Open Font License 1.1 (`app/fonts/OFL.txt`,
https://openfontlicense.org).

| File | Kind | What it shows | Source | Author and licence | Checked | Masked | Mean luminance |
|---|---|---|---|---|---|---|---|
| platform.jpg (2880x1440, 206 KB) | render | Our drone, graphite, rotors turning and its leg lights on, hovering over the concrete floor of a garage, upper right of the frame. Behind it the garage wall with two windows and a wooden door, two parked black cars on the left, a white pillar on the right; plain floor in the lower left, under the headline. | Render, app/film/orbit at t = 6.0 s (the garage), `?dpr=1.5&dx=0.1546&dy=0.1456`, 2880x1620 still cropped to rows 125 to 1565 | Vraelis, our render and drone model; panorama Autoshop 01 (https://polyhaven.com/a/autoshop_01), Poly Haven, CC0 (https://polyhaven.com/license) | No faces or people, no insignia or flags, no readable brand marks (the car badges are unreadable, the number plates are blank in the panorama, the canisters by the pillar carry no readable label), no readable third-party or personal data (a notice in a back window is unreadable) | Nothing | luma 68.9 of 255 (27.0%), black point 12 |
| platform-portrait.jpg (1440x2560, 235 KB) | render | The same drone in the same garage, phone cut: the drone at about 30% of the height, the wall, windows and door above it, the floor below for the headline. | Render, app/film/orbit at t = 6.6 s, `?portrait&dpr=1.5&dx=0.0098&dy=0.3312`, 1620x2880 still cropped to x 30 to 1470, y 160 to 2720 (the empty landing pad is left out) | Vraelis; panorama Autoshop 01 (https://polyhaven.com/a/autoshop_01), Poly Haven, CC0 (https://polyhaven.com/license) | As platform.jpg (the rear of one car at the left edge, no readable badge or plate) | Nothing | luma 68.9 of 255 (27.0%), black point 12 |
| fleets.jpg (2880x1440, 261 KB) | render | Our drone flying low over a dry field at dusk, upper right of the frame, a line of trees and a strip of evening sky along the top; open field in the lower left, under the headline. | Render, app/film/orbit at t = 10.8 s (the field), `?dpr=1.5&dx=0.1626&dy=0.1476`, cropped to rows 45 to 1485 | Vraelis; panorama Bambanani Sunset (https://polyhaven.com/a/bambanani_sunset), Poly Haven, CC0 (https://polyhaven.com/license) | No faces, people, vehicles, insignia, flags, brand marks, third-party or personal data | Nothing | luma 73.9 of 255 (29.0%), black point 27 |
| fleets-portrait.jpg (1440x2560, 282 KB) | render | The same field, phone cut: sky and trees at the top, the drone at about a third of the height, the field below. | Render, app/film/orbit at t = 10.8 s, `?portrait&dpr=1.5&dx=0.0153&dy=0.2883`, cropped to x 90 to 1530, y 160 to 2720 | Vraelis; panorama Bambanani Sunset (https://polyhaven.com/a/bambanani_sunset), Poly Haven, CC0 (https://polyhaven.com/license) | As fleets.jpg | Nothing | luma 74.0 of 255 (29.0%), black point 29 |
| company.jpg (2880x1440, 286 KB) | render | Our drone resting on its round landing pad on the garage's concrete floor, propellers still, upper right of the frame; plain floor elsewhere. Not the hand catch. | Render, app/film/orbit at t = 0.3 s (on the pad), `?dpr=1.5&dx=0.1592&dy=0.1382`, cropped to rows 150 to 1590 | Vraelis, our render, drone and pad models; panorama Autoshop 01 (https://polyhaven.com/a/autoshop_01), Poly Haven, CC0 (https://polyhaven.com/license) | Floor only: no faces, people, insignia, brand marks, third-party or personal data | Nothing | luma 73.9 of 255 (29.0%), black point 29 |
| company-portrait.jpg (1440x2560, 223 KB) | render | The drone on its pad, phone cut, in the top quarter, floor below. | Render, app/film/orbit at t = 0.3 s, `?portrait&dpr=1.5&dx=-0.0022&dy=0.3833`, cropped to x 90 to 1530, y 160 to 2720 | Vraelis; panorama Autoshop 01 (https://polyhaven.com/a/autoshop_01), Poly Haven, CC0 (https://polyhaven.com/license) | As company.jpg | Nothing | luma 73.9 of 255 (29.0%), black point 32 |
| defense.jpg (2880x1440, 154 KB) | capture, scene | The Larkspur demo console in broken mode after Confirm target on T-1, with T-3 selected: the Selected contact panel reads Contact T-3, Sector B3, Type Bus, civilian, Classification Civilian, Engagement Cleared to engage (red), with "T-1 confirmed as a target" under the buttons; the right part of the live map (columns C to E, T-2) on the left, under the headline. | Capture, Larkspur demo fixture, http://localhost:3100/api/fixtures/strike?mode=broken, viewport 1440x900 at DPR 4, 2026-10-02 09:58 UTC: Confirm target pressed on T-1, then the T-3 row selected (selecting changes nothing but the panel). Cropped to CSS x 540 to 1440, y 38 to 488 (3600x1800 px at DPR 4), scaled down to 2880x1440; DPR 4 rather than A7.1.2's DPR 2 so this closer crop is never enlarged | Vraelis, our demo fixture (a simulated mission console Vraelis built) | No faces, people, real units, insignia, flags or brand marks (the contact symbols are the fixture's own generic shapes); no third-party or personal data; nothing here controls hardware | Nothing | luma 18.4 of 255 (7.2%), black point 9, as captured |
| defense-portrait.jpg (1440x2560, 173 KB) | capture, scene | The same moment, phone cut: the fixture's top bar (LARKSPUR, Mission North Ridge, Aircraft LARK-3, Link OK); the Contacts list with T-1 (Armoured vehicle) and T-3 (Bus, civilian) both "Cleared to engage" in red, T-2 "Do not engage", T-4 "Hold"; beside it the map's left part with LARK-3 and grid square B3 holding T-1 and T-3; the fixture's rule ("Only a contact classified Hostile and confirmed by the operator can be cleared to engage...") and the start of the legend at the bottom. | Capture, the same fixture and steps at viewport 1101x900, DPR 4 (the three-column layout at its narrowest, so square B3 sits beside the list), 2026-10-02 10:01 UTC; cropped to CSS x 0 to 486, y 0 to 864 (1944x3456 px, exactly 9:16), scaled down to 1440x2560. Re-cut by the merge pass from the same capture: starting at the fixture's top bar moves the Contacts header and the T-1 row out from under the FrameHero credit plate on phones (the first cut, CSS x 0 to 459, y 46 to 862, is kept at `SP/qa/b0/merge/replaced/`) | Vraelis, our demo fixture (a simulated mission console Vraelis built) | As defense.jpg (Mission North Ridge and LARK-3 are the fixture's own made-up names) | Nothing | luma 17.7 of 255 (7.0%), black point 8, as captured |
| commerce-panel.png (1760x1412, 23 KB) | capture, panel image | The Lumen Notes pricing page: "Pricing", "Start free. Upgrade when you outgrow three notebooks.", the Free and Pro plan cards with a Get Pro button, "Check which plan you are on", and the app's own footer: "Lumen Notes is a fixture app used to demonstrate Vraelis. Nothing here is real and no payment is taken." | Capture, https://broken-checkout.vercel.app/pricing.html as served (nothing clicked), viewport 1440x900 at DPR 2, 2026-10-02 09:55 UTC; cropped to CSS x 280 to 1160, y 54 to 760 | Vraelis, our demo app | No faces, insignia or brand marks other than our own demo app's name; the prices are the demo app's own, not Vraelis prices; no third-party or personal data | Nothing | luma 248.6 of 255 (97.5%), near white |
| saas-panel.png (1296x952, 17 KB) | capture, panel image | The Vraelis fixture dashboard right after creating a project named "Test Project", before any reload: "This is a Vraelis test fixture", "Your projects", the Project name form, the list row "Vraelis Fixture: Test Project" with its "fixture" tag, and "mode: broken (records live in memory only)". | Capture, https://preflight-demo-ten.vercel.app/?mode=broken, viewport 1440x900 at DPR 2, 2026-10-02 09:56 UTC: typed "Test Project", pressed Create project, captured 0.25 s after the row appeared; cropped to CSS x 396 to 1044, y 64 to 540 | Vraelis, our demo fixture | No faces, insignia, brand marks, third-party or personal data (the hidden sign-in fields are empty and outside the crop) | Nothing | luma 243.7 of 255 (95.6%), near white |
| ai-built-apps-panel.png (888x530, 22 KB) | recorded evidence, panel image | Notewell's dashboard as recorded by the run: the header (Notewell, "0 / 3 notes", Upgrade to Pro, Sign out), the New note form, and Your notes: "No notes yet. Write your first one above." | `app/dev-preview/v6/_content/demos/notes-dashboard.png`, recorded by run 4fc6e52c on 2026-07-31 (1280x800); cropped to x 196 to 1084, y 10 to 540, pixels unchanged | Vraelis, recorded evidence of our own demo app (built with Lovable) | The "Edit with Lovable" badge in the screenshot's corner is cropped out; no faces, insignia, third-party or personal data | Nothing | luma 246.2 of 255 (96.5%), near white |
| enterprise-panel.png (1356x1142, 30 KB) | console capture, panel image | The Records page: the Export card (Export CSV, Export JSON, "Exports include sanitized governance activity only...") and the Trust controls grid: Organization, Verified domains, Single sign-on (OIDC for verified domains), Domain provisioning, Team roles, Billing admins, Client viewer access, API & webhooks. | Console /records (app.vraelis.com/records), QA account, 2026-10-02 | Vraelis, our own work (a screenshot of our console); type IBM Plex, SIL OFL 1.1 | No faces, insignia, brand marks, third-party data or personal data | Nothing: no personal data inside the crop | luma 19.9 of 255 (7.8%), black point 8 |
| agencies-panel.png (1356x1006, 23 KB) | console capture, panel image | The Team page's Members and Roles cards. Members: the workspace owner's row ("(you)", "Joined 7/20/2026", Owner) and "Your workspace is just you for now. Invite collaborators or clients to review your reports with you." Roles: Owner, Admin, Editor, Viewer and Client viewer, each with what it can do, and "Billing stays with the workspace owner. Client viewers never see billing, API keys, webhooks or source details." | Console /team (app.vraelis.com/team), QA account, 2026-10-02 09:30 UTC. The images batch's taller crop of the same capture (`SP/qa/b0/raw/agencies-members-roles-masked.png`), pixels unchanged, put in place by the final review (2026-10-03 UTC): the Roles card alone (1356x666, kept at `SP/qa/p3/fix-solutions/replaced/`) was a 2:1 strip that left the top half of the hero frame empty at 1440 | Vraelis, our own work (a screenshot of our console); type IBM Plex, SIL OFL 1.1 | No faces, insignia, brand marks or third-party data; the account's email is masked, and the box was checked to cover all of it (nothing of the address at its edges; the masked and unmasked crops differ only inside the box) | The account's email address in the Members row (one flat #121214 box, x 77 to 293, y 116 to 156, just before "(you)") | luma 23.4 of 255 (9.2%), black point 9 |
| security-panel.png (1356x754, 21 KB) | console capture, panel image | A guarantee record's approved proof plan: thirteen requirements for the Notewell demo app, then "Approved by [masked], 66 days ago, plan v5. Each re-check runs this exact plan; a changed definition returns it for re-approval." | Console /systems/843270b4-3e27-4723-9fb7-116482e6e148/guarantees/grt_c8110fd1-563b-41e7-8ef4-c40db1fac6f7, QA account, 2026-10-02 | Vraelis, our own work (a screenshot of our console); type IBM Plex, SIL OFL 1.1 | No faces, insignia, brand marks or third-party data (Notewell is our own demo app); the email is masked, and the merge pass confirmed the box is one solid colour with nothing of the address at its edges | The approver's email address (one flat #121214 box, x 163 to 341, y 706 to 740, in the approval line; the comma after it stays visible) | luma 18.8 of 255 (7.4%), black point 10 |

## Using them

These are the picture settings the Batch 0 merge pass checked on the real FrameHero (see "Checks" below). The
page owns them (`_content/sector-pages.ts`, `company/page.tsx`, `platform/page.tsx`).

| Page | object-position (landscape / portrait) | Credit or bar | Suggested alt text |
|---|---|---|---|
| /platform | 50% 60% / 50% 80% | none | "Our drone hovers over the concrete floor of a garage, a render made for Vraelis." |
| /solutions/fleets | 50% 55% / 50% 75% | none | "Our drone flies low over a dry field at dusk, a render made for Vraelis." |
| /company | 50% 65% / 50% 50% | none | "Our drone on its landing pad on a garage floor, a render made for Vraelis." |
| /solutions/defense | 100% 50% / 0% 20% | "Larkspur demo fixture. Captured 2026-10-02, not from the run." | "Larkspur, a simulated mission console Vraelis built, after the operator confirmed T-1: the civilian bus T-3 also shows Cleared to engage." Portrait: "The Larkspur contact list after confirming T-1: T-1 and the civilian bus T-3 both show Cleared to engage." |
| /solutions/commerce | panel, at most 640 wide, left top | bar: `broken-checkout.vercel.app/pricing.html`, "Captured 2026-10-02, not from the run" | "The pricing page of Lumen Notes, a Vraelis demo app: a Free plan and a Pro plan with a Get Pro button." |
| /solutions/saas | panel, at most 640 wide, left top | bar: `preflight-demo-ten.vercel.app/?mode=broken`, "Captured 2026-10-02, not from the run" | "The Vraelis fixture dashboard right after creating a project: the list shows Vraelis Fixture: Test Project." |
| /solutions/ai-built-apps | panel, evidence, at most 640 wide, left top | bar: "Notewell, run 4fc6e52c, July 31, 2026" | "Notewell's dashboard recorded by the run: the New note form, and Your notes with No notes yet." |
| /enterprise | panel, left top | bar: `app.vraelis.com/records`, "Captured 2026-10-02" | "The Vraelis console's Records page: Export CSV and Export JSON, and the trust controls, including single sign-on with OIDC for verified domains, team roles and billing admins." |
| /security | panel, left top | bar: `app.vraelis.com/systems/.../guarantees/...`, "Captured 2026-10-02" | "An approved proof plan in the Vraelis console: thirteen requirements, approved by a person whose email is hidden, plan version 5." |
| /solutions/agencies | panel, left top | bar: `app.vraelis.com/team`, "Captured 2026-10-02" | "The Members and Roles cards on the Vraelis console's Team page: the workspace owner and an invitation to bring in collaborators or clients, then Owner, Admin, Editor, Viewer and Client viewer, and billing that stays with the workspace owner." |

Why these values:
- The landscape vertical value only matters when the frame is wider than 2:1 (short or very wide windows), and the
  portrait horizontal value only on tall phones. The renders keep A7.5's landscape values: 50% across leaves each
  drone 79 to 106 px clear of the headline at 1440 and 24 to 49 px at 1024x768; a larger value moves it into the
  headline there.
- Render portraits: the vertical value matters on phones whose frame is under about 658 px tall (an iPhone in Safari
  with its bars is about 587). A7.5's 50% 55% puts the platform drone under the headline on a 520 frame; 50% 80%
  keeps it 9 to 26 px clear on every short phone frame tried, where 100% cuts it at the top of a 414-wide frame. Fleets at
  50% 75% is clear everywhere (50% touches the eyebrow on 340 to 375 wide short phones). Company at 50% 50% is clear
  everywhere but a 360-wide short phone (50% 35% leaves 9 px on a 520 frame; A7.5's 60% cuts the pad on a
  414-wide one).
- Defense landscape at 100% 50%: the subject, the Selected contact panel, is the console's right column. At 100% the
  whole panel is in the frame at 1440, 1024 and 1920; at 85% its right column is clipped at 1440 (the header reads
  "T-" for "T-3"); at A7.5's 50% 40% the Sector column is cut at 1440 and "Cleared to engage" leaves the frame
  entirely at 768 wide.
- Defense portrait at 0% 20%: anchored at its left edge so the contact symbols stay in. The vertical value only
  matters on frames wider than 9:16: at 390x844 (a 767 frame) the portrait is cut at its sides, not its top, and all
  four rows are clear of the plate and the eyebrow at any value. On a 587 frame (390x664, about an iPhone in Safari),
  measured again by the final review on 2026-10-03 (UTC) on the portrait as the merge pass re-cut it: the four rows are taller than
  the room between the plate and the eyebrow, so no value clears all of them. 20% keeps T-2, T-3 (Cleared to engage)
  and T-4 in view and T-1's "Cleared to engage" just under the plate's edge, with T-1's label under the plate; 0%
  frees T-1 but puts the eyebrow over T-4; 50%, the page's value before this pass, puts all of T-1 under the plate.
  Shots: `SP/qa/p3/fix-solutions/shots/pt-390x664-sheet.png`.

## Where these differ from the plan (A7.5)

- /solutions/defense: captured at DPR 4 instead of 2, so the closer crops are never enlarged. After Confirm target
  on T-1, the T-3 row was selected; that only changes which contact the details panel shows.
- /enterprise asked for the organization's single sign-on settings. The QA account has no organization, and that
  card renders only for an organization owner or admin; creating an organization is a state change the batch was
  not allowed to make. The Records page's Export card and Trust controls grid (which lists single sign-on, team
  roles and billing admins) is used instead. To capture the real settings card later, create and verify an
  organization for the QA account, point the `enterprise` target in `SP/qa/b0/console-capture.mjs` at
  `/organization`, then run it, `mask-crop.py`, `render-panels.mjs enterprise` and `finalize.py`.
- /security asked for the Review page with a pending plan minted from the composer. Minting a plan was not allowed,
  and the Review page is empty for the QA account ("Nothing is waiting on you"), so the picture is the plan section
  of an existing record: a guarantee whose plan a person approved. "66 days ago" is relative to the capture date,
  2026-10-02; the console's Guarantees list shows the same approval as "Jul 27".
- /solutions/agencies first used the Roles card only, because on the QA account the Members card is one masked row
  plus "Your workspace is just you for now". The final review (2026-10-03 UTC) swapped in the Members and Roles crop:
  the Roles card alone left the top 47% of the frame empty at 1440 (56% at 1920), and the Members card's own words
  ("Invite collaborators or clients to review your reports with you") are the page's point about bringing a client in.

## Checks

- Batch 0 merge pass, 2026-10-02, on the real FrameHero (the /company hero with each picture and each page's own copy
  swapped in the browser; nothing in the site changed; script `SP/qa/b0/merge/heroclear4.mjs`, frames and boxes in
  `SP/qa/b0/merge/real/`): with the values above, at 1440x900 (frame 1385x807) and at 390 wide with a 720 tall frame
  no subject lies under any line of text. Drone gaps are 79 to 106 px at 1440 and 62 to 142 px on that phone; the
  defense panel is whole at 1440 with only the credit plate on its top border; on the phone the T-1 and T-3 rows are
  clear (25 and 111 px) and the plate covers only the Contacts header. Also run at 767, 587, 558 and 520 tall phone
  frames, a 360-wide phone, 768x1024, 1024x768, 1280x720, 1440x760 and 1920x1080.
- Defense crop, kept at y 38 to 488 (final review, 2026-10-03 UTC). The fixture's header border (CSS y 45 of the
  capture) is in its top rows, so at the hero's 1.03 start scale a 1px line shows along the frame's top edge at 1440
  until the page scrolls. A re-cut from y 46 removes it but moves the Selected contact panel's header ("SELECTED
  CONTACT", "T-3") up under the credit plate at 1440 and 1920; a start between 38 and 46 only trades one for the
  other within a pixel or two (worked out at 1440), and two texts over each other read worse than the line. The tried crop is kept at
  `SP/qa/p3/fix-solutions/replaced/defense-recut-46-496-rejected.jpg`, its shots at `SP/qa/p3/fix-solutions/shots/fresh-def-*`.
- Limits no object-position fixes: at 768x1024 the landscape picture is cut to about 1.15:1 under a headline that
  spans the frame, so each drone sits partly behind the headline block and meets the right edge (83% in frame), and
  the defense sub runs across the Confirm target button; on the shortest phone frames (520 tall, and 360-wide
  phones) the defense headline covers the T-3 row and the company eyebrow sits on the pad.
- Text contrast over the pictures (`SP/qa/herocheck.mjs`, 1440x900 and 390x844, English and German) with these
  values on /solutions/defense, /solutions/fleets and /company, and the platform picture on the /company hero: no
  text block under 4.5:1 (3:1 for large text); the worst is 6.89:1, the German eyebrow on /company on a phone.
- Batch 0a's mock checks (headline box at 1440x807, 390x720 and 768x1024; worst contrast 6.8:1) are in
  `SP/qa/b0/hero-mocks-0a-desk.jpg` and `hero-mocks-0a-phone.jpg`.

## Current sector-page simulation capture

`larkspur-current-console.png` is an actual browser capture of Vraelis's current
Larkspur simulation at `/api/fixtures/strike?mode=broken&ui=terrain-20261005`,
captured October 4, 2026 (Pacific time), after clicking Confirm target on T-1.
It shows the current black-and-white 3D console, not a historical run artifact.
Sector pages label this distinction explicitly. Original run images and records
remain unchanged. No real hardware or customer deployment is depicted.
