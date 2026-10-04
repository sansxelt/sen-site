# Homepage spatial simulation and film

The homepage film is a silent browser recording of the working Larkspur fixture in broken mode. It reproduces the confirm-target interaction from production check `vrf_51705517-329b-4dcf-b9ce-4442e53439ed`, recorded October 2, 2026. It is a reenactment, not original session footage or a new verification-engine run. The original screenshot, contact crop and record remain separately available below the film.

The simulation uses original, locally rendered Three.js geometry: height-mapped terrain, sampled elevation contours, buildings, vehicles, a civilian bus, a patrol and an animated aircraft. It is fictional browser data, with no real aircraft, weapons, customer systems or operational mission data connected. The top bar labels it Simulation. The unchanged fixture logic clears civilian T-3 when confirming T-1 in broken mode; fixed mode clears only T-1.

Controls work in the live simulation: 2D and 3D projection, pointer camera rotation or pan, zoom, recenter, contact selection, terrain and structure layers, flight-path visibility, terrain height and motion pause. Reduced motion starts the aircraft paused. Rendering stops offscreen or when the document is hidden; a paused scene redraws only when its view or controls change. A WebGL-free browser retains the original 2D map and functional contact controls.

The homepage defaults to the film. Explore loads the same simulation in an iframe only when requested. It pauses the film, and Watch film returns to the recording. The Three.js renderer does not enter the homepage JavaScript bundle. Locally hosted Three.js module files are covered by the adjacent MIT license.

Rebuild the desktop and portrait films:

```sh
node scripts/mission-demo/capture.cjs 'http://localhost:3100/api/fixtures/strike?mode=broken'
node scripts/mission-demo/capture.cjs 'http://localhost:3100/api/fixtures/strike?mode=broken' --portrait
```

Requires Chromium and FFmpeg. Output is `public/home/spatial-check*.mp4` and matching `spatial-check-poster*.jpg`, 1440×900 and 720×960, H.264, 30 fps, silent, faststart. The film switches 2D to 3D, confirms T-1, selects T-3, and resets. A single white pointer follows the real controls. No caption overlays, fake engine messages or status-pill clusters are added.
