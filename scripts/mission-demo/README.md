# Platform spatial simulation and film

The Platform demo film is a silent browser recording of the working Larkspur fixture in broken mode. It reproduces the confirm-target interaction from production check `vrf_51705517-329b-4dcf-b9ce-4442e53439ed`, recorded October 2, 2026. It is a reenactment, not original session footage or a new verification-engine run. The original screenshot, contact crop and record remain unaltered in the existing recorded-check assets.

The simulation uses original, locally rendered Three.js geometry: textured height-mapped terrain, sampled elevation contours, a connected road network, industrial buildings, instanced forest geometry, vehicles, a civilian bus, a patrol and an animated aircraft. It is fictional browser data, with no real aircraft, weapons, customer systems or operational mission data connected. The top bar labels it Simulation. The unchanged fixture logic clears civilian T-3 when confirming T-1 in broken mode; fixed mode clears only T-1.

Controls work in the live simulation: 2D and 3D projection, pointer camera rotation or pan, zoom, recenter, contact selection, terrain and structure layers, flight-path visibility, terrain height and motion pause. Reduced motion starts the aircraft paused. Rendering stops offscreen or when the document is hidden; a paused scene redraws only when its view or controls change. A WebGL-free browser retains the original 2D map and functional contact controls.

The Platform demo defaults to the film. Explore loads the same simulation in an iframe only when requested. It pauses the film, and Watch film returns to the recording. The Three.js renderer does not enter the homepage JavaScript bundle. Locally hosted Three.js module files are covered by the adjacent MIT license.

Rebuild the desktop and portrait films:

```sh
node scripts/mission-demo/capture.cjs 'http://localhost:3100/api/fixtures/strike?mode=broken'
node scripts/mission-demo/capture.cjs 'http://localhost:3100/api/fixtures/strike?mode=broken' --portrait
```

Requires Chromium and FFmpeg. Output is `public/home/spatial-check-terrain*.mp4` and matching `spatial-check-terrain-poster*.jpg`, 1440×900 and 720×960, H.264, 60 fps, silent, faststart. The film switches 2D to 3D, confirms T-1, selects T-3, and resets. A single white pointer follows the real controls. No caption overlays, fake engine messages or status-pill clusters are added.

Capture renders 1,080 distinct frames at exact 1/60-second simulation timestamps for an 18-second film, then pipes those images to FFmpeg. It does not use the wall-clock browser recorder or stretch software-rendered frames. This works without a hardware GPU during capture. The default Platform demo only decodes the video; 3D only loads on Explore. The live view caches static shadows, avoids moving unchanged DOM labels, caps device pixel ratio and reduces render resolution when sustained frame times exceed the 60 FPS budget. Runtime frame rate still depends on the visitor’s hardware and browser.


## App recording, October 4 revision

The homepage and Platform demo now show a review of the saved Larkspur check using the actual `AppTopbar`, `AppSidebar`, `ProductSurface`, `Page` and `PageHeader` components. The browser-style frame is illustrative and says Recorded demo. Plan requirements, date, duration, finding and repair prompt come from the published October 2 record; no new account, plan, approval or verification is created.

The local-only `/dev-preview/recorded-app` capture route returns 404 in production. It contains only already-public record data and does not authenticate anyone. Account API reads and all non-read requests are blocked by the capture script. The film switches Plan, Activity, Finding and Repair prompt tabs with real clicks. The embedded mission fixture is reenacted; the final clipboard action copies the real stored repair prompt. Profile identity and developer tools are omitted from the capture.

Run `node scripts/mission-demo/capture-app.cjs` and the same command with `--portrait` while the local dev server is running. Output is `app-check-replay*.mp4` and `app-check-replay-poster*.jpg`, 20 seconds at 60 FPS. The scene and its controls use neutral black, white and gray, with geometry and fixture behavior unchanged. The previous stand-alone scene capture script remains available for reproducing that earlier recording.
