# Homepage mission-console demo

`public/home/mission-demo.mp4` is a silent looping browser recording of Larkspur in broken mode. It reproduces the confirm-target interaction from production check `vrf_51705517-329b-4dcf-b9ce-4442e53439ed`, recorded October 2, 2026. It is **not** original session footage and does not run or pretend to run the verification engine. The homepage says "Browser reenactment" and retains the original run screenshot, contact crop and explanation underneath.

The fixture's actual code produces the bug: confirming hostile T-1 also clears civilian T-3 in the same grid square. Recording overlays summarize the existing record; they do not change application behavior. All contacts and aircraft are fictional. No hardware, customer data, or third-party brand footage is used.

To rebuild, serve the broken fixture locally (for example, `npm run dev -- --port 3100`) and run:

```sh
npx playwright install ffmpeg
node scripts/mission-demo/capture.cjs 'http://localhost:3100/api/fixtures/strike?mode=broken'
node scripts/mission-demo/capture.cjs 'http://localhost:3100/api/fixtures/strike?mode=broken' --portrait
```

Requires Chromium and system FFmpeg. Override `CHROMIUM_PATH` if needed. The script saves a JPEG poster and H.264 MP4, with video dimensions 1440×960 and 720×960. The portrait capture restyles the same fixture to put larger contact details and controls above the map; it does not alter the fixture behavior. The homepage loads the video near the viewport, pauses when offscreen or the tab is hidden, honors reduced motion, and offers persistent playback and full-screen controls.
