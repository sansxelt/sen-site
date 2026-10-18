# Defense visual review: LS3 still (proposal, not integrated)

Review material only. Nothing in this folder is published on the site or referenced by any page. The Defense page
stays text-only until the founder approves a still.

## The proposal

One still of the Legged Squad Support System (LS3), an unarmed legged research robot, walking alone along a shaded
forest road. Desktop cut 21:9, phone cut 4:5, placed under the existing Defense headline in the hero media slot
(stacked, as on the other application pages). No caption and no notice strip. Apache and MQ-9 footage are excluded.

| File | What it is |
|---|---|
| `still-desktop-21x9.jpg` | Desktop cut, 1280×549: source frame rows 95–643, full width. |
| `still-portrait-4x5.jpg` | Phone cut, 576×720: source frame columns 322–897, full height. |
| `source-frame-101.25s.png` | The full 1280×720 source frame the cuts come from (lossless PNG). |
| `detail-200pct.jpg` | The front legs at 200%, to judge softness. |
| `in-context-desktop-960-2x.jpg` | Mock-up under the Defense headline, frame limited to about 960px, at 2× density. |
| `in-context-phone-3x.jpg` | Mock-up on a 390px phone at 3× density. |
| `original-scan-001-079s.jpg`, `original-scan-081-153s.jpg` | The whole original sampled every 2 s, with timestamps. |
| `candidate-frames-099-153s.jpg` | Full-resolution candidates from the two stretches without people near the robot. |

## Source frame

- Original time: **101.25 s** (1:41.25). The clean stretch runs about 101.2–103.5 s; a soldier walks into frame at
  104.25 s. Everything else in the original has Marines, rifles or vehicles close to the robot, or is washed out
  (147–153 s) or shows the robot tipped over (133–143 s).
- The frame shows no people, rifles, insignia, unit markings or vehicle labels.
- Frames were taken by playing the original in Microsoft Edge (Playwright) at native 1280×720 and screenshotting.
  The cuts were made from that PNG with sharp. Re-encoding to JPEG is lossy; the PNG is the reference.

## Original file

| | |
|---|---|
| Downloaded from | https://upload.wikimedia.org/wikipedia/commons/4/4e/349764-LS3_in_action_along_side_3-3_Marines.webm (Wikimedia Commons), 17 October 2026 |
| Size | 74,991,294 bytes; 1280×720 VP9, Opus audio; 154.162 s |
| SHA-1 | `bab2645260fd4a3ec7e6c5b7c8274cbcb071204d` (matches the Commons page) |
| SHA-256 | `3b764c65074a5581439feadb29a4239fc66ec3a4368355ea0cb0730868ec43ef` |
| Primary source | DVIDS video 349764, https://www.dvidshub.net/video/349764/ls3-action-along-side-3-3-marines |

The DVIDS page marks the video **PUBLIC DOMAIN**, subject to the conditions on https://www.dvidshub.net/about/copyright.
Taken 10 July 2014 at Kahuku Training Area, Oahu, Hawaii (RIMPAC 2014 experiment); VIRIN 140715-M-CP369-001; filename
DOD_101811393. DVIDS's own high-resolution download needs a validated account, which was not created, so the Commons
copy is the original used.

Caveats to resolve before publishing:

- The DVIDS page gives the photographer as "Sgt." in its description and "SSgt" in its licence line. Confirm the rank.
- The Commons file page is flagged "License review needed", and its licence template says U.S. Army while the credit
  is U.S. Marine Corps. DVIDS is cited as the authority.
- The source is 720p, so the desktop cut is soft on high-density screens. A frame limited to about 960px wide reduces
  this. If the softness is not acceptable, the alternative is a new search for sharper public-domain footage of
  unarmed defense autonomy.

## DVIDS conditions that apply (read 17 October 2026)

- No use that implies Department of War endorsement of a for-profit business. Commercial use, which includes
  marketing, is asked to display the non-endorsement disclaimer "to the maximum extent practicable".
- Commercial users are asked to obscure distinctive U.S. military markings; insignia and seals are protected marks.
- Posting does not waive the publicity or privacy rights of people shown. The chosen frame shows no people.

## Proposed text, added only when the still is integrated

**`/image-sources` entry:**

> Defense page: the Legged Squad Support System (LS3) research robot during a U.S. Marine Corps experiment at Kahuku
> Training Area, Oahu, Hawaii, on 10 July 2014. U.S. Marine Corps motion imagery by Sgt. William L. Holdaway, DVIDS
> video 349764 (VIRIN 140715-M-CP369-001), public domain. Still from 1:41 of the original. The appearance of U.S.
> Department of War (DoW) visual information does not imply or constitute DoW endorsement.

**Defense "What we do not claim" line:**

> No endorsement by the U.S. Department of War. The robot footage is public-domain government imagery from 2014.

This placement is the founder's decision. It is not assumed to satisfy DVIDS's "maximum extent practicable" wording;
that judgement stays open and is for legal review.

## Motion (proposal only, not implemented)

The still ships first. A loop that plays automatically for more than five seconds needs a pause control (WCAG
2.2.2), and those controls were retired. Recommended later: one play of the clean 101.2–103.5 s stretch (about two
seconds) when the frame scrolls into view, ending on the still, never looping, and never under reduced motion.
