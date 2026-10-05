# In-page media on the sector pages: sources

Pictures used inside the sector pages (`app/dev-preview/v6/solutions/[slug]`), other than the heroes, menu pictures
and cards, which live in `public/site/` with their own CREDITS. Every file here is our own capture of our own
fixture, cropped only: never recoloured or retouched. A capture made for the site, rather than by a run, is shown
with the words "Captured <date>, not from the run."

**Licence.** Our own work. The fixtures are Vraelis's own demo apps; they hold no real data.

| File | What it shows | Source | Taken | Crop | Checked | Mean luminance |
|---|---|---|---|---|---|---|
| fieldline-broken.png | Fieldline, the simulated fleet console Vraelis serves as a demo fixture, in its broken mode a few seconds after pressing Return home for SKY-01: the selected aircraft SKY-01 still shows Status Flying, the panel says "Return home sent to SKY-01", and the command log shows SKY-10 returning, landing and landed at Pad B. Shown on /solutions/fleets below 900px wide, in place of the embedded fixture. | `http://localhost:3100/api/fixtures/drone?mode=broken` (served in production at `https://vraelis.com/api/fixtures/drone?mode=broken`, `lib/fixtures/drone-console.ts`), browser storage cleared first, then Return home pressed once | 2026-10-02 (UTC), headless Chrome, 390x844 at device pixel ratio 2 | The selected-aircraft card and its command log, CSS box x 22 to 368, y 877 to 1442, with 2 px of margin: 700x1138 | No faces, insignia, brand marks, third-party data or personal data; the times in the log are the fixture's own clock | luma 34.9 (13.7%) |
| security-16x10.jpg | The CrossLinks card for /security on /solutions/defense: a guarantee record's approved plan (Notewell), the approver's email masked. Captured 2026-10-02. It shows "Approved proof plan", the plan's thirteen requirements and its approval line, composed for a 16:10 card. The images batch made no Security card, so this is composed the way its panel cards are: the capture unchanged except for its size (scale 0.92), centred on #0E0E10 with the FrameHero panel kind's soft light, rounded corners and a 1px edge (scratchpad qa/b5a-sectors/compose-security.py, a copy of qa/b0/build_captures.py compose_panel). | `public/site/hero/security-panel.png`, a masked console capture by the images batch (its row in `public/site/hero/CREDITS.md`) | 2026-10-02 (UTC), composed | The whole capture, 1248x694 inside a 1600x1000 frame | No faces, insignia, brand marks or third-party data (Notewell is our own demo app); the approver's email was masked in the source capture and stays masked | luma 17.8 (7.0%) |
## Current Fieldline console

`fieldline-current-20261005.png` is a fresh browser capture of Vraelis's
black-and-white Fieldline simulation, captured October 4, 2026 (Pacific time).
Source: `/api/fixtures/drone?mode=broken&ui=monochrome-20261005` at a 700px viewport.
After resetting and pressing Return home, the capture shows SKY-01 still Flying
and the command log shows SKY-10 landing at Pad B. This is a current simulated
example, not a historical run artifact or a real aircraft. Original captures
remain stored for provenance; the Robotics page uses this new, versioned asset.
