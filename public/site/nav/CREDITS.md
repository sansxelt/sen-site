# Menu pictures made for the navigation (Batch 2): sources

Two 1400x700 pictures (2:1, shown at most 705x352 in the Product menu), made on 2026-10-02 for the two "Ways in"
links that had only stock photographs of people at computers (plan A1.3 and A7.2: no stock photographs, no staged
screens). Both are our own work and belong to the same set as `public/site/menu`: the FrameHero panel-kind ground
(#0E0E10 with one soft light, plan A5) and a MediaPanel-style shell with a words-only bar, no window dots and no
decorative dots, rendered at 700x350 CSS px, device pixel ratio 2, in IBM Plex Sans and IBM Plex Mono from
`app/fonts`, saved as JPEG quality 82, 4:4:4.

**Licence.** Our own work. Type is IBM Plex Sans and IBM Plex Mono, SIL Open Font License 1.1 (`app/fonts/OFL.txt`).

| File | Kind | What it shows | Source | Checked | Mean luminance |
|---|---|---|---|---|---|
| console.jpg (1400x700, 92 KB) | composition of a console capture | Bar "app.vraelis.com/systems/843270b4/guarantees" and "Captured 2026-10-02". Inside: a guarantee record's approved proof plan in the Vraelis console, "01 Approved proof plan" and the first eleven requirements for the Notewell demo app. | The images batch's composition of `public/site/hero/security-panel.png` (`SP/qa/b0/out/security-menu.png`, rendered by `SP/qa/b0/render-panels.mjs` from `SP/qa/b0/panels.html`); the capture itself is credited in `public/site/hero/CREDITS-console.md`. Written here unchanged, as JPEG. | The approval line, the only place the capture holds personal data (masked there), is outside this crop. No faces, insignia, brand marks, third-party or personal data (Notewell is our own demo app). | luma 18.0 of 255 (7.0%) |
| cli.jpg (1400x700, 80 KB) | the CLI's own output, in a terminal shell | Bar "Terminal". Inside: `$ vraelis --help` and the help screen it prints: the VRAELIS line, Usage (`vraelis verify --url URL --claim "WHAT SHOULD NOW WORK" --wait`) and the start of Commands (verify, recheck, result, init), in the CLI's own colours (bold, dim, cyan). The shell runs off the right and bottom edges, so long lines meet the frame edge. | `FORCE_COLOR=1 node cli/vraelis.mjs --help`, run on 2026-10-02; its output and SGR codes are read from the captured text, never retyped (`SP/qa/b2-nav/pics/cli-data.js`, `cli-panel.html`, `render-cli.mjs`). | No faces, insignia, brand marks, third-party or personal data. | luma 18.1 of 255 (7.1%) |
