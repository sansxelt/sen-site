# Systems film: civilian footage, original edit

The v8 homepage Applications tile plays /home/systems-film-civil.mp4 (poster /home/systems-poster-civil.jpg). It is a 24.5-second silent loop with no military material: a robot arm on a production line, a factory floor with mobile robots, a drone view of a power substation, a civilian quadcopter in flight, a drone view of a solar farm, a warehouse robot arm stacking pallets, and software on screen. It is an original edit; every clip is from Pexels under the Pexels License (https://www.pexels.com/license/), chosen without recognisable faces or prominent brand logos.

The shots illustrate the kinds of systems whose software matters. They do not depict Vraelis hardware, customers or deployments, and no endorsement or relationship with any creator, manufacturer or operator is implied. Vraelis develops cybersecurity software for AI in defense, critical infrastructure and autonomous systems; its first product, Vraelis Contour, is in private development.

| Shot | Pexels title | Creator | Source | Rights |
|---|---|---|---|---|
| Robot arm on a production line | Industrial Robot Arm in High-Tech Factory | Usman AbdulrasheedGambo | [Pexels 32386532](https://www.pexels.com/video/industrial-robot-arm-in-high-tech-factory-32386532/) | [Pexels License](https://www.pexels.com/license/) |
| Factory floor with mobile robots | Futuristic Factory Floor with Advanced Machinery | Usman AbdulrasheedGambo | [Pexels 32386627](https://www.pexels.com/video/futuristic-factory-floor-with-advanced-machinery-32386627/) | Pexels License |
| Drone view of a power substation | Aerial View on Power Station | Thanh Văn | [Pexels 10416553](https://www.pexels.com/video/aerial-view-on-power-station-10416553/) | Pexels License |
| Civilian quadcopter in flight | Flying Drone in Cloudy Sky | Grisha Grishkoff | [Pexels 4446375](https://www.pexels.com/video/flying-drone-in-cloudy-sky-4446375/) | Pexels License |
| Drone view of a solar farm | Drone Footage of a Solar Farm | Roman Odintsov | [Pexels 7042814](https://www.pexels.com/video/drone-footage-of-a-solar-farm-7042814/) | Pexels License |
| Warehouse robot arm stacking pallets | (title not recorded) | Ocelotwood | [Pexels 16938947](https://www.pexels.com/video/16938947/) | Pexels License |
| Software on screen | (title not recorded) | cottonbro studio | [Pexels 5473798](https://www.pexels.com/video/5473798/) | Pexels License |

Rebuild using `python3 scripts/field-film/compose-civil.py /path/to/source-clips` (set FFMPEG if ffmpeg is not on PATH). Download each original from https://www.pexels.com/download/video/<id>/ and name it `robot-line.mp4` (32386532), `agv-floor.mp4` (32386627), `substation.mp4` (10416553), `drone.mp4` (4446375), `solar.mp4` (7042814), `robot.mp4` (16938947), `code.mp4` (5473798). Output: H.264 High, yuv420p, 60 fps, faststart, 1600×900, about 8.2 MB; the poster is the frame at 0.8 s. Same treatment as the earlier edits: cover crop, light grade, deliberate hard cuts, no frame freezing or fades, soundtracks removed.

# Earlier edits (not shown on the v8 site)

The other /home/systems-film-* files and their posters are earlier edits. systems-film-opening*, systems-film-field* and systems-film-smooth* include the U.S. military public-domain footage credited below (field and smooth also show a burned-in U.S. Army logo), and systems-film.mp4 (built by app/film/systems/compose.py) also shows military vehicles and aircraft; systems-film-defense* and systems-film-spatial* are interface renders. The opening edit is still used by the older v6 preview hero; the v8 site plays none of these files.

The opening edit is a 25-second silent loop that opens with an Apache live-fire training launch, then moves through an Apache flyby, an MQ-9 training flight, a military research robot, industrial robotics and software. It is an original edit; no Scale, Anduril or Palantir assets are used. The field shots illustrate the systems whose software matters. They do not depict Vraelis hardware, customers, deployed military capability or a relationship with the U.S. government.

| Shot | Source and rights |
|---|---|
| Warehouse robotic arm | [Ocelotwood / Pexels 16938947](https://www.pexels.com/video/16938947/), [Pexels License](https://www.pexels.com/license/) |
| Software on screen | [cottonbro / Pexels 5473798](https://www.pexels.com/video/5473798/), Pexels License |
| LS3 quadruped research robot with Marines, July 10, 2014 | [Sgt. William Holdaway / DVIDS 349764](https://www.dvidshub.net/video/349764/ls3-action-along-side-3-3-marines), U.S. federal government work, public domain. [Commons source](https://commons.wikimedia.org/wiki/File:349764-LS3_in_action_along_side_3-3_Marines.webm) |
| MQ-9 training flight over Nevada, July 15, 2019 | [Senior Airman Haley Stevens / DVIDS 708466](https://www.dvidshub.net/video/708466/mq-9-reaper-aerial-video), U.S. federal government work, public domain. [Commons source](https://commons.wikimedia.org/wiki/File:MQ-9_Reaper_aerial_video_DOD_107212162-5e1342c0d88af.webm) |
| AH-64 Apache capability demonstration, Latvia, May 2, 2025 | [Sgt. Charlie Duke / DVIDS 962366](https://www.dvidshub.net/video/962366), U.S. federal government work, public domain. [Commons source](https://commons.wikimedia.org/wiki/File:AH-64_Apache_Capability_Demostration_(962366).webm) |
| Apache live-fire training, Ustka, Poland, August 27, 2025 | [Sgt. Jamie Robinson / DVIDS 975462](https://www.dvidshub.net/video/975462/12th-combat-aviation-brigade-employs-spike-nlos-missile-system-historic-live-fire-event), U.S. federal government work, public domain. [Commons source](https://commons.wikimedia.org/wiki/File:U.S._Army_AH-64E_Apache_Guardian_Launching_a_SPIKE_NLOS_Missile.webm) |

Rebuild using `python3 scripts/field-film/compose.py /path/to/source-clips`. Name originals `robot.mp4`, `code.mp4`, `quadruped.webm`, `mq9.webm`, `apache.webm`, `apache-fire.webm`. Output: H.264, 60 fps, faststart, 1600×900 landscape and 720×1280 portrait. The portrait edit has separately reviewed crops that keep subjects visible. Deliberate cuts; no artificial frame freezing or fades. Soundtracks are removed.
