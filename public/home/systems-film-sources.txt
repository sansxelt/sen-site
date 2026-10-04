# Systems film: real footage, original edit

This 31-second silent loop connects industrial robotics, software, a military research robot, an MQ-9 training flight, an Apache flyby and live-fire training demonstration, and Vraelis's own Larkspur browser simulation. It is an original edit; no Scale, Anduril or Palantir assets are used.

The field shots illustrate the systems whose software matters. They do not depict Vraelis hardware, customers, deployed military capability or a relationship with the U.S. government. Vraelis currently checks live web apps and control panels in a real browser. The final shot is a browser reenactment of its recorded software check, not aircraft control.

| Shot | Source and rights |
|---|---|
| Warehouse robotic arm | [Ocelotwood / Pexels 16938947](https://www.pexels.com/video/16938947/), [Pexels License](https://www.pexels.com/license/) |
| Software on screen | [cottonbro / Pexels 5473798](https://www.pexels.com/video/5473798/), Pexels License |
| LS3 quadruped research robot with Marines, July 10, 2014 | [Sgt. William Holdaway / DVIDS 349764](https://www.dvidshub.net/video/349764/ls3-action-along-side-3-3-marines), U.S. federal government work, public domain. [Commons source](https://commons.wikimedia.org/wiki/File:349764-LS3_in_action_along_side_3-3_Marines.webm) |
| MQ-9 training flight over Nevada, July 15, 2019 | [Senior Airman Haley Stevens / DVIDS 708466](https://www.dvidshub.net/video/708466/mq-9-reaper-aerial-video), U.S. federal government work, public domain. [Commons source](https://commons.wikimedia.org/wiki/File:MQ-9_Reaper_aerial_video_DOD_107212162-5e1342c0d88af.webm) |
| AH-64 Apache capability demonstration, Latvia, May 2, 2025 | [Sgt. Charlie Duke / DVIDS 962366](https://www.dvidshub.net/video/962366), U.S. federal government work, public domain. [Commons source](https://commons.wikimedia.org/wiki/File:AH-64_Apache_Capability_Demostration_(962366).webm) |
| Apache live-fire training, Ustka, Poland, August 27, 2025 | [Sgt. Jamie Robinson / DVIDS 975462](https://www.dvidshub.net/video/975462/12th-combat-aviation-brigade-employs-spike-nlos-missile-system-historic-live-fire-event), U.S. federal government work, public domain. [Commons source](https://commons.wikimedia.org/wiki/File:U.S._Army_AH-64E_Apache_Guardian_Launching_a_SPIKE_NLOS_Missile.webm) |
| Vraelis Larkspur simulation | Vraelis's existing browser reenactment in `public/home/spatial-check-60*.mp4`. Original recorded evidence remains available in the existing recorded-check assets. |

Rebuild using `python3 scripts/field-film/compose.py /path/to/source-clips`. Name originals `robot.mp4`, `code.mp4`, `quadruped.webm`, `mq9.webm`, `apache.webm`, `apache-fire.webm`. The script also reads the existing Larkspur films. Output: H.264, 60 fps, faststart, 1600×900 landscape and 720×1280 portrait. The portrait edit has separately reviewed crops that keep subjects visible. Deliberate cuts; no artificial frame freezing or fades. Soundtracks are removed.
