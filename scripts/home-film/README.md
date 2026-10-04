# Vraelis homepage inspection film

An original 24-second looping film at 30 fps. Desktop is 1600 × 900; phone is 720 × 1280. Silent H.264 MP4 with faststart, paired JPEG posters, pause controls and a static reduced-motion presentation.

The globe, terrain, inspection rings and quadrotor are original Three.js illustrations. They do not depict a Vraelis aircraft, a hardware inspection or a real mission. The screen textures are actual browser captures of Vraelis's own Larkspur simulated mission fixture in its initial and deliberately broken states, captured October 4, 2026. The footage shows the existing software bug after Confirm target; no interface values or results were invented. Simulation labeling remains in the captured UI. No third-party video, logos, music, faces or cloned layouts are used.

Reproduction:
1. Bundle `app/film/encode.ts` as `encode.js` with esbuild and copy `scene.html`, `scene.js` and the installed Three.js `three.module.min.js` and `three.core.min.js` into a temporary rendering directory.
2. Capture `strikeConsoleHtml("broken")` in a browser at 1440 × 900. Save the initial state as `mission-before.png` and the state after clicking Confirm target as `mission-after.png`.
3. Serve the directory at localhost:3410. Run `node scripts/home-film/render.cjs` and `node scripts/home-film/render.cjs --portrait`. `--stills` renders review frames only. Chromium's WebGL renderer and WebCodecs encoder render exact timestamps, independently of wall-clock speed.
4. Compress each output using FFmpeg libx264, CRF 25, yuv420p and `-movflags +faststart`. Extract the time-zero posters.

All scene motion is periodic over 24 seconds, including camera, rotors, inspection scan and particles. The screen is back in its initial state at the boundary. This renderer is not shipped in the visitor's JavaScript bundle.
