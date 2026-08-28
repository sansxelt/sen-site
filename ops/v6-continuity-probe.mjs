// DOES THE PAGE FEEL LIKE ONE PRESENTATION, OR LIKE A LIST OF SECTIONS?
//
// The viewport probe next to this one answers "is anything cut off". It can be entirely green on a page
// that is horrible to scroll, because a phase reaching 0 and 1 says nothing about what happened in between.
// This one measures the in-between, the way a reader produces it: real wheel or touch events, one notch at
// a time, waiting out the engine's easing between notches exactly as a hand would.
//
// After every notch it takes a COMPOSITION SIGNATURE of whatever pinned scene owns the screen -- where each
// visible thing is, how big, how opaque, and what colour the ground under it is. The frame-to-frame delta
// of that signature is how much the scene actually moved for that notch of scrolling.
//
//   a delta near zero inside a pinned chapter   is a STALL: the reader scrolled and the page did not answer
//   a delta far above its neighbours            is a JUMP: the scene lurches instead of travelling
//   a high peak-to-mean across a chapter        means one beat dominates and the rest reads as dead by
//                                               comparison, which is what "uneven progression" actually is
//
// THE GROUND COLOUR IS PART OF THE SIGNATURE AND LEARNING THAT MATTERED. Chapter 3 resolves paper to
// graphite across the back half of its scroll. Measured on geometry alone that resolve is invisible, so the
// probe reported a 500px dead run through the one stretch where the chapter is doing its most deliberate
// work, and re-cutting the phase windows to "fix" it changed nothing because there was nothing wrong.
// A continuity measure that cannot see paint will send you to re-time animations that were already fine.
//
//   node ops/v6-continuity-probe.mjs http://localhost:3200/dev-preview/v6
import { chromium } from "playwright";

// THE TARGET URL IS NOT ALLOWED TO FALL BACK SILENTLY.
//
// This read `process.argv.find(a => /^https?:/.test(a))`, so a file:// argument matched nothing and the
// default localhost URL was used instead -- without a word. Every run of the fixture harness, which
// passes
// file:// pages built to have known behaviour, therefore measured the LIVE HOMEPAGE and compared it against
// the fixtures' expectations. The whole instrument-validation exercise tested nothing, and its failures
// were read as findings about the page.
//
// So: file:// is accepted, and an argument that looks like it was meant to be a target but cannot be
// parsed is a hard error rather than a shrug.
const urlArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (urlArg !== undefined) {
  try { new URL(urlArg); } catch {
    console.error(`  not a usable URL: ${urlArg}`);
    process.exit(2);
  }
  if (!/^(https?|file):/.test(urlArg)) {
    console.error(`  unsupported URL scheme: ${urlArg} (expected http, https or file)`);
    process.exit(2);
  }
}
const URL_UNDER_TEST = urlArg || "http://localhost:3200/dev-preview/v6";
const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7);
// --trace=<chapter> prints every frame's phase and delta for one chapter. It exists so the numbers can be
// put beside rendered frames by hand: a continuity figure nobody has ever compared with a picture is a
// figure nobody has verified, and this instrument has been confidently wrong three times.
const trace = (process.argv.find((a) => a.startsWith("--trace=")) || "").slice(8);
const CH = ["gap", "au", "st", "rg", "dr"];

// A stall is judged in absolute, perceptual terms rather than against the chapter's own average, because
// both averages fail and the fixtures proved it in both directions. See the note at the stall test itself.
const STALL_PER_ELEMENT_PX = 0.35;  // average per-element movement below this cannot be seen on a display
const STALL_GROUND_LUM = 0.0015;    // ...and the ground under it did not change either
// A LURCH IS A HIGH RATIO **AND** AN INSTANTANEOUS PEAK. The ratio alone cannot tell a discontinuity from
// a climax, and the fixtures calibrate the difference exactly: the deliberate 400px jump peaks across ONE
// frame, while every chapter built to travel -- however large its largest gesture -- spreads its peak over
// 18 to 36. A gesture that takes several notches is travel, whatever its size; a jump is by definition
// one frame wide. Requiring both is what stops this check condemning a chapter for having a climax.
const PEAK_RATIO_LIMIT = 4;    // how far the biggest notch may stand above the typical one...
const PEAK_WIDTH_LURCH = 1;    // ...before it matters that it happened all at once
const MAX_DEAD_RUN = 3;        // consecutive unanswered notches before it reads as broken

let failures = 0;
const ok = (n, c, d = "") => { console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${d ? `  — ${d}` : ""}`); if (!c) failures++; };

const GEOM = [
  // Grouped by the shape of the space, not by who makes the hardware. A class is a set of viewports that
  // pose the composition the same problem; the device names are only there so a reading can be reproduced.
  { cls: "narrow/tall",   name: "360x800", w: 360, h: 800, touch: true },
  { cls: "narrow/tall",   name: "390x844", w: 390, h: 844, touch: true },
  { cls: "narrow/tall",   name: "430x932", w: 430, h: 932, touch: true },
  { cls: "narrow/short",  name: "360x660", w: 360, h: 660, touch: true },
  { cls: "narrow/short",  name: "390x700", w: 390, h: 700, touch: true },
  { cls: "tablet",        name: "768x1024", w: 768, h: 1024, touch: true },
  { cls: "tablet",        name: "834x1112", w: 834, h: 1112, touch: true },
  { cls: "wide/short",    name: "1093x525", w: 1093, h: 525 },
  { cls: "wide/short",    name: "1093x614", w: 1093, h: 614 },
  { cls: "wide/short",    name: "1242x597", w: 1242, h: 597 },
  { cls: "laptop",        name: "1280x720", w: 1280, h: 720 },
  { cls: "laptop",        name: "1366x657", w: 1366, h: 657 },
  { cls: "laptop",        name: "1366x768", w: 1366, h: 768 },
  { cls: "laptop",        name: "1440x900", w: 1440, h: 900 },
  { cls: "desktop/wide",  name: "1680x1050", w: 1680, h: 1050 },
  { cls: "desktop/wide",  name: "2560x1440", w: 2560, h: 1440 },
];

const SELECTED = only ? GEOM.filter((g) => g.name.includes(only)) : GEOM;
if (only && !SELECTED.length) { console.error(`  --only=${only} matched nothing`); process.exit(2); }

const browser = await chromium.launch();
const summary = [];
console.log(`\n  v6 continuity probe  ->  ${URL_UNDER_TEST}`);
console.log(`  ${SELECTED.length} geometry class(es)${only ? `, FILTERED to "${only}" — NOT the full space` : ""}\n`);

for (const g of SELECTED) {
  for (const reduced of [false, true]) {
    const label = g.name + (reduced ? " reduced" : "");
    const cls = g.cls;
    process.stdout.write(`  ${label.padEnd(28)} scrolling…`);
    const ctx = await browser.newContext({
      viewport: { width: g.w, height: g.h },
      reducedMotion: reduced ? "reduce" : "no-preference",
      hasTouch: !!g.touch,
      isMobile: !!g.touch,
    });
    const page = await ctx.newPage();
    // A SYNTHESISED INPUT THAT NAVIGATES AWAY LOOKS EXACTLY LIKE A PAGE WITH NO MOTION IN IT.
    // A touch "prime" tap in this probe once landed in the nav, followed a link on 360-wide viewports, and
    // every continuity check then passed on the empty set that came back. Nothing in the numbers said so.
    // The URL is recorded on every navigation and asserted at the end of the walk.
    const navigations = [];
    page.on("framenavigated", (fr) => { if (fr === page.mainFrame()) navigations.push(fr.url()); });
    // UNREACHABLE IS A RESULT, NOT AN EXCEPTION. Thrown, this printed a stack trace and no verdict at all,
    // and a harness reading the output saw no FAIL line and concluded the run was fine. That is how a
    // mutation test for "the walk navigated away" passed: the probe had crashed, not survived.
    let loadError = null;
    try {
      await page.goto(URL_UNDER_TEST, { waitUntil: "networkidle" });
    } catch (e) { loadError = String(e).split("\n")[0]; }
    await page.waitForTimeout(1400);
    if (loadError) {
      process.stdout.write("\r" + " ".repeat(44) + "\r");
      console.log("\n  " + label);
      ok("the page under test could be loaded", false, loadError);
      await ctx.close();
      continue;
    }

    await page.evaluate(() => {
      window.__sig = () => {
        const items = [];
        let chapter = null;
        let chapterStuck = false;
        for (const key of ["gap", "au", "st", "rg", "dr"]) {
          const wrap = document.querySelector(".v6-" + key);
          const pin = wrap && wrap.querySelector('[class*="__pin"]');
          if (!wrap || !pin) continue;
          const pr = pin.getBoundingClientRect();
          // ONLY WHILE THE SCENE OWNS THE SCREEN. A sticky pin translates at full scroll speed on the way
          // in and on the way out, and those frames move every element by a whole notch at once. Counted,
          // they buried the thing being measured: chapter 2 averaged 22,202 against chapter 3's 674, which
          // says nothing about either chapter and everything about how many entry/exit frames each had.
          // Stuck to the top means the only thing that can move the scene is the scrub.
          const stuck = Math.abs(pr.top) <= 2;
          // THE FALLBACK IS STILL A PRESENTATION AND STILL HAS TO BE MEASURED. Filtering to stuck pins
          // only meant that under reduced motion, or on any window below the gates, NOTHING was sampled --
          // and every continuity check then passed on an empty set. A probe that reports "no chapter
          // stalls" because it looked at no chapters is worse than one that fails.
          // Unpinned, the whole scene translates with the scroll, so the scroll itself is subtracted below
          // and what is left is the reveal: the part a reader experiences as the scene arriving.
          if (!stuck && (pr.bottom < window.innerHeight * 0.35 || pr.top > window.innerHeight * 0.65)) continue;
          if (!chapter) chapter = key;
          if (key !== chapter) continue;                 // one scene per sample; boundaries handled apart
          chapterStuck = stuck;
          // (the ground colour is read once at the return below, not here)
          // KEYED BY POSITION, NOT BY CLASS NAME, and this was silently wrong.
          //
          // The key was the className, so every element sharing one collapsed to a single Map entry and
          // each of the others was compared against a DIFFERENT ELEMENT. Measured in the Direction pin:
          // 69 elements, 23 distinct class keys -- 20 of them stringifying to "[object SVGAnimatedString]"
          // because an SVG node with no class falls through baseVal to the object itself, plus 8 edges,
          // 3 guarantee groups, 3 system groups and 3 layers all sharing a name. The resulting deltas were
          // around 14,000 with 226px of "movement" per element per notch, in a PINNED scene where nothing
          // can move at all, and several came out byte-identical frame after frame.
          //
          // Every continuity number this probe produced for that chapter was noise, including the zero
          // stalls it reported across a stretch a reader described as dead. DOM order is stable between
          // frames; a class name is not unique.
          const nodes = [...pin.querySelectorAll("*")];
          for (let idx = 0; idx < nodes.length; idx++) {
            const e = nodes[idx];
            const cs = getComputedStyle(e);
            if (cs.display === "none" || cs.visibility === "hidden") continue;
            const b = e.getBoundingClientRect();
            if (!b.width || !b.height) continue;
            let op = 1, n = e;
            while (n && n !== pin) { op *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement; }
            const cls = typeof e.className === "string"
              ? e.className
              : (e.className && typeof e.className.baseVal === "string" ? e.className.baseVal : "");
            items.push({
              k: idx + "|" + (cls.trim().slice(0, 30) || e.tagName),
              x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2, w: b.width, h: b.height, o: op,
              // A LINE DRAWING ITSELF IS MOTION A BOUNDING BOX CANNOT SEE. The Direction diagram draws its
              // edges with stroke-dashoffset, which changes neither geometry nor opacity, so the probe read
              // the whole edge beat as a dead frame and would have sent someone to re-time an animation
              // that was running correctly. Same lesson as the oklab ground: if the page can express change
              // in a property the signature does not sample, the signature will report stillness.
              d: parseFloat(cs.strokeDashoffset) || 0,
            });
          }
          break;
        }
        const wrap = chapter && document.querySelector(".v6-" + chapter);
        const stage = chapter && document.querySelector(`.v6-${chapter}__stage, .v6-${chapter}__head`);
        // HOW A SCENE LEAVES. A pin releases at whatever opacity its content happens to be holding, and if
        // that is still 1 the scene does not hand over, it is yanked off the screen at scroll speed while
        // fully lit. Averaged over the scene's own parts, this is how much of it is still burning at the
        // moment the next chapter takes the stage.
        const lit = items.length ? items.reduce((a, b) => a + b.o, 0) / items.length : null;
        return {
          chapter, items, lit, stuck: chapterStuck,
          ground: wrap ? getComputedStyle(wrap).backgroundColor : null,
          p: wrap ? parseFloat(getComputedStyle(wrap).getPropertyValue("--p")) : null,
          stageCentre: stage ? (stage.getBoundingClientRect().left + stage.getBoundingClientRect().right) / 2 : null,
          vpCentre: window.innerWidth / 2,
        };
      };
      // OKLAB FIRST, AND THAT IS NOT A DETAIL. Chapter 3 resolves its ground with color-mix(in oklab, ...),
      // so getComputedStyle hands back `oklab(0.145 ...)` and never an rgb() triple. An rgb-only parser
      // returns null for every sample, the ground term contributes exactly zero to every delta, and the
      // probe reports the back half of the chapter as five dead notches -- while the page is in the middle
      // of its largest single change. Two rounds of "fixing" the phase windows came out of that reading
      // before the parser was the thing at fault. oklab's first component IS lightness, already 0..1.
      window.__lum = (s) => {
        if (!s) return null;
        const ok = /okla?b?\(\s*([\d.]+)/.exec(s);
        if (ok) return +ok[1];
        const rgb = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s);
        return rgb ? (+rgb[1] * 0.2126 + +rgb[2] * 0.7152 + +rgb[3] * 0.0722) / 255 : null;
      };
    });

    const docH = await page.evaluate(() => document.documentElement.scrollHeight);
    const NOTCH = Math.max(60, Math.round(g.h * 0.14));   // a notch scaled to the window, as a hand is
    const steps = Math.ceil((docH - g.h) / NOTCH);
    if (!g.touch) await page.mouse.move(g.w / 2, g.h / 2);

    let prev = null;
    let walkError = null;
    const frames = [];
    let centreDrift = 0;
    for (let i = 0; i <= steps; i++) {
      if (i > 0) {
        if (g.touch) {
          // Touch-style incremental advance. There was a touchscreen.tap(w/2, 10) here to "prime" the
          // surface and it was landing INSIDE THE NAV -- on a 360-wide phone it followed a link and left
          // the page, which is why both 360 runs measured zero chapters and then passed every continuity
          // check on an empty set. Never synthesise an input the measurement does not need.
          await page.evaluate((n) => window.scrollBy({ top: n, behavior: "instant" }), NOTCH);
        } else {
          await page.mouse.wheel(0, NOTCH);
        }
      }
      await page.waitForTimeout(200);
      // IF THE PAGE HAS GONE, SAY SO. When a synthesised input navigated away mid-walk, window.__sig was
      // no longer defined, this threw, and the probe died with a stack trace and no verdict -- so the
      // mutation test for exactly that scenario recorded a PASS, because it found no FAIL line to read.
      // A walk that cannot sample any more stops and lets the navigation guard below report it.
      let s;
      try {
        s = await page.evaluate(() => ({ y: Math.round(window.scrollY), ...window.__sig() }));
      } catch (e) {
        walkError = String(e).split("\n")[0];
        break;
      }
      if (s.chapter && s.stageCentre != null) centreDrift = Math.max(centreDrift, Math.abs(s.stageCentre - s.vpCentre));
      // A frame where the pin CHANGED state is not comparable with the one before it: the scene was
      // travelling with the scroll in one and held still in the other, so the delta is dominated by which
      // arithmetic each got rather than by anything that happened. Comparing across that boundary put a
      // phantom notch of motion into every chapter and produced peak/mean 4.0 and a 4-notch dead run on
      // geometries that had measured 2.4 and zero an hour earlier. The transition is the handoff, and it
      // is reported separately by exit-lit rather than smuggled into the continuity numbers.
      if (prev && s.chapter && s.chapter === prev.chapter && s.stuck === prev.stuck) {
        const map = new Map(prev.items.map((it) => [it.k, it]));
        let geom = 0, compared = 0;
        for (const it of s.items) {
          const q = map.get(it.k);
          if (!q) continue;
          compared++;
          const dy = s.stuck ? it.y - q.y : it.y - q.y + NOTCH;
          geom += Math.abs(it.d - q.d) + Math.abs(it.x - q.x) + Math.abs(dy)
            + Math.abs(it.w - q.w) * 0.5 + Math.abs(it.h - q.h) * 0.5
            + Math.abs(it.o - q.o) * 200;
        }
        // the ground resolving is motion the reader sees, and geometry cannot detect it
        const l1 = await page.evaluate((c) => window.__lum(c), s.ground);
        const l0 = await page.evaluate((c) => window.__lum(c), prev.ground);
        const ground = l1 != null && l0 != null ? Math.abs(l1 - l0) : 0;
        // GEOMETRY AND GROUND ARE KEPT APART, and per-element rather than summed, because the stall test
        // below is a question about perception and the summed figure is not: a chapter with forty parts
        // and one with four cannot share a threshold, and a colour resolve has no per-element meaning at
        // all. delta stays as the single comparable number for peak/median.
        const perEl = compared ? geom / compared : 0;
        frames.push({ y: s.y, ch: s.chapter, p: s.p, delta: geom + ground * 4000,
                      perEl, ground, lit: s.lit, stuck: s.stuck });
      }
      prev = s;
    }

    process.stdout.write("\r" + " ".repeat(44) + "\r");
    console.log(`\n  ${label}   (${g.w}x${g.h}${g.touch ? ", touch" : ", wheel"}${reduced ? ", reduced motion" : ""})`);
    ok("the document was long enough to be a presentation", docH > g.h * 6, `${docH}px in a ${g.h}px window`);
    ok("the stage stays on the viewport centre", centreDrift <= 2, `worst drift ${centreDrift.toFixed(1)}px`);

    // rawDeltas is the per-frame sequence at full precision, kept so the duplicate-reading check can look
    // at what was actually measured rather than at a rounded summary of it.
    const row = { label, cls, touch: !!g.touch, docH, centreDrift: +centreDrift.toFixed(1),
      rawDeltas: frames.map((f) => f.delta), chapters: {} };
    for (const key of CH) {
      const f = frames.filter((x) => x.ch === key);
      if (f.length < 4) continue;
      const d = f.map((x) => x.delta);
      const mean = d.reduce((a, b) => a + b, 0) / d.length;
      const peak = Math.max(...d);
      // A STALL IS MEASURED AGAINST THE MEDIAN, NOT THE MEAN, and the difference is not cosmetic.
      // On a fixture built with steady motion plus one deliberate 25x lurch, a mean-based threshold
      // called 25 of 26 notches stalled: the spike dragged the mean so far up that ordinary travel fell
      // below a tenth of it. That chapter was smooth everywhere except one frame and the instrument
      // reported the exact opposite. The median is what the typical notch actually did, and one outlier
      // cannot move it.
      const sorted = [...d].sort((a, b) => a - b);
      const median = sorted.length % 2
        ? sorted[(sorted.length - 1) / 2]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;

      // A STALL IS AN ABSOLUTE, PERCEPTUAL QUESTION: did anything move enough to be seen?
      //
      // Both relative references fail, in opposite directions, and the fixtures proved each:
      //   against the MEAN, a chapter with one deliberate 25x lurch reported 25 of 26 notches stalled --
      //     the spike dragged the mean above ordinary travel;
      //   against the MEDIAN, a chapter deliberately still across 60% of its length reported ZERO stalls --
      //     the dead majority IS the median, so the floor was 0.0 and nothing could fall below it.
      // A page can be mostly dead or mostly smooth, and a threshold derived from the page cannot tell the
      // difference. A third of a pixel of average per-element movement cannot be seen on any display, and
      // that is true regardless of what the rest of the chapter is doing.
      // AND ONLY WHILE THE SCENE IS PINNED, which the rendered frames are what proved.
      //
      // Traced at 1366x657, chapter 3 reported four stalled notches at its opening. Screenshotting those
      // exact scroll positions showed the chapter ARRIVING: pin top 327.7 -> 235.7 -> 143.7 -> 51.7, the
      // struck word moving 92px per notch, which is exactly one notch of scroll. The compensated delta is
      // correctly 0 -- nothing moves RELATIVE to the scroll -- but calling that a stall is wrong, because
      // the reader is watching the page move. A stall means the reader scrolled and got nothing back, and
      // that can only happen while the scene is held still and the scrub is the only thing that can move
      // it. No number in the output said this; the frames did.
      const isStall = (x) => x.stuck && x.perEl < STALL_PER_ELEMENT_PX && x.ground < STALL_GROUND_LUM;
      const stalls = f.filter(isStall);
      let longest = 0, run = 0;
      for (const x of f) { if (isStall(x)) { run++; longest = Math.max(longest, run); } else run = 0; }
      if (trace && trace === key) {
        console.log("    trace .v6-" + key + ": median " + median.toFixed(1) + ", mean " + mean.toFixed(1)
          + ", stall when perEl < " + STALL_PER_ELEMENT_PX + " and ground < " + STALL_GROUND_LUM);
        for (const x of f) {
          console.log("      y=" + String(x.y).padStart(6) + "  p=" + (x.p == null ? "?" : x.p.toFixed(3))
            + "  delta " + x.delta.toFixed(1) + "  perEl " + x.perEl.toFixed(2) + "  ground " + x.ground.toFixed(4)
            + "  lit " + (x.lit == null ? "?" : x.lit.toFixed(2))
            + (isStall(x) ? "   STALL" : ""));
        }
      }
      // Against the median for the same reason the stall floor is: a ratio to the mean measures a spike
      // against a number the spike itself created.
      const pm = peak / (median || mean || 1);
      // HOW WIDE IS THE PEAK? A ratio alone cannot tell a lurch from a climax. The fixture spike -- an
      // instantaneous 400px jump -- and a chapter deliberately building to its largest gesture both score
      // high, and only one of them is a defect. A lurch is ONE frame: the scene was somewhere, then
      // somewhere else. A climax is several frames of sustained travel. Counting the contiguous frames
      // within half the peak separates them, and the fixtures calibrate where the line sits.
      const half = peak / 2;
      let peakWidth = 0, wrun = 0;
      for (const x of f) { if (x.delta >= half) { wrun++; peakWidth = Math.max(peakWidth, wrun); } else wrun = 0; }
      const tail = f.filter((x) => x.p != null && x.p > 0.93).map((x) => x.lit).filter((v) => v != null);
      const exitLit = tail.length ? tail.reduce((a, b) => a + b, 0) / tail.length : null;
      const wasPinned = f.some((x) => x.stuck);
      row.chapters[key] = { n: f.length, mean: Math.round(mean), pm: +pm.toFixed(1), peakWidth, stalls: stalls.length, longest, exitLit, wasPinned };
      const bad = longest > MAX_DEAD_RUN || (pm > PEAK_RATIO_LIMIT && peakWidth <= PEAK_WIDTH_LURCH);
      console.log(`    .v6-${key.padEnd(3)} ${String(f.length).padStart(3)} notches  mean ${String(Math.round(mean)).padStart(6)}`
        + `  peak/med ${String(pm.toFixed(1)).padStart(5)}  stalled ${String(stalls.length).padStart(2)}/${f.length}`
        + `  longest dead run ${longest}  peakw ${peakWidth}`
        + (exitLit == null ? "" : `  exit-lit ${exitLit.toFixed(2)}`)
        + (bad ? "   <-- uneven" : ""));
    }
    ok("the walk completed without losing the page", walkError === null, walkError || "");
    const strayNav = navigations.filter((u) => u.split("#")[0] !== URL_UNDER_TEST.split("#")[0]);
    ok("never navigated away from the page under test", strayNav.length === 0,
      strayNav.slice(0, 2).join(" , "));
    // A walk that produced far fewer comparable frames than notches did not measure the page, it measured
    // an accident. The floor is deliberately loose -- transitions are skipped by design -- but a run that
    // collapses to a handful of frames can no longer say anything about continuity.
    ok("the walk produced frames for most of the scroll", frames.length >= steps * 0.4,
      `${frames.length} comparable frames from ${steps} notches`);
    ok("chapters were actually measured (this check must never be vacuous)",
      Object.keys(row.chapters).length >= 3, `only ${Object.keys(row.chapters).length} chapter(s) produced frames`);
    const worstRun = Math.max(0, ...Object.values(row.chapters).map((c) => c.longest));
    // SCRUB SHAPE IS ONLY A QUESTION WHERE THERE IS A SCRUB. In the fallback composition nothing is
    // pinned and chapter 3 arrives on a 560ms CSS transition, while this walk samples every 200ms -- so it
    // catches the fade mid-flight and records a one-frame spike that the notch did not cause. That is the
    // clock, not the page. Measured: 360x800 pinned reads a 2-frame peak, the same geometry unpinned reads
    // 1 frame, and only the second trips a lurch.
    // The fallback is NOT thereby unmeasured -- see the arrival check below, which fails if its scenes
    // never arrive at all.
    const lurches = Object.entries(row.chapters).filter(([, c]) => c.wasPinned && c.pm > PEAK_RATIO_LIMIT && c.peakWidth <= PEAK_WIDTH_LURCH);
    const unpinned = Object.entries(row.chapters).filter(([, c]) => !c.wasPinned);
    if (unpinned.length) {
      // A sequenced fallback still has to SEQUENCE: its parts arrive rather than being present from the
      // start. A stacked page that simply scrolls would show motion indistinguishable from the scroll,
      // which the compensation subtracts to nothing.
      const arriving = unpinned.filter(([, c]) => c.mean > 0);
      ok(`the fallback composition still arrives (${unpinned.length} unpinned chapter(s))`,
        arriving.length === unpinned.length,
        unpinned.filter(([, c]) => !(c.mean > 0)).map(([k]) => `.v6-${k} showed no motion beyond the scroll`).join(", "));
    }
    ok(`no chapter stalls for more than ${MAX_DEAD_RUN} notches`, worstRun <= MAX_DEAD_RUN, `longest ${worstRun}`);
    ok(`no chapter lurches (a peak over ${PEAK_RATIO_LIMIT}x the typical notch, in a single frame)`,
      lurches.length === 0,
      lurches.map(([k, c]) => `.v6-${k} ${c.pm}x in ${c.peakWidth} frame(s)`).join(", "));
    summary.push(row);
    await ctx.close();
  }
}
await browser.close();

// IDENTICAL READINGS FROM DIFFERENT GEOMETRIES ARE A SYMPTOM, NOT A COINCIDENCE -- but only when they are
// identical all the way down. Two geometries CAN legitimately land on the same rounded mean: the summary
// is a handful of integers and collisions between them are ordinary arithmetic, not evidence of anything.
// What cannot happen by chance is two clearly different composition/input classes producing the same
// per-frame sequence at full precision, frame for frame, across a whole walk. That is a constant, a
// default, or an empty set being reported instead of the page.
//
// So the raw sequence FAILS and the rounded summary only WARNS. A check that fails on a coincidence gets
// widened until it fails on nothing.
{
  const rawOf = (r) => r.rawDeltas.map((d) => d.toFixed(6)).join(",");
  const sumOf = (r) => CH.map((k) => (r.chapters[k] ? r.chapters[k].mean : "-")).join("|");
  const rawSeen = new Map(), sumSeen = new Map();
  const rawDupes = [], sumDupes = [];
  for (const r of summary) {
    if (!Object.keys(r.chapters).length || !r.rawDeltas.length) continue;
    const raw = rawOf(r), sum = sumOf(r);
    // "clearly different" means a different composition class or a different input device; two wheel
    // geometries inside the same class are genuinely similar pages and are not compared here.
    const prevRaw = rawSeen.get(raw);
    if (prevRaw && (prevRaw.cls !== r.cls || prevRaw.touch !== r.touch)) {
      rawDupes.push(`${prevRaw.label} (${prevRaw.cls}) == ${r.label} (${r.cls}), ${r.rawDeltas.length} frames`);
    } else if (!prevRaw) rawSeen.set(raw, r);
    const prevSum = sumSeen.get(sum);
    if (prevSum && (prevSum.cls !== r.cls || prevSum.touch !== r.touch)) {
      sumDupes.push(`${prevSum.label} == ${r.label}`);
    } else if (!prevSum) sumSeen.set(sum, r);
  }
  ok("no two different classes produced an identical raw motion fingerprint", rawDupes.length === 0,
    rawDupes.slice(0, 3).join(" ; "));
  if (sumDupes.length) {
    console.log(`  WARN  rounded summaries coincide across classes (not a failure): ${sumDupes.slice(0, 3).join(" ; ")}`);
  }
}

console.log("\n── continuity matrix ──");
console.log("  geometry                       drift  worst peak/med   longest dead run  doc");
for (const r of summary) {
  const pm = Math.max(0, ...Object.values(r.chapters).map((c) => c.pm));
  const run = Math.max(0, ...Object.values(r.chapters).map((c) => c.longest));
  console.log(`  ${r.label.padEnd(30)} ${String(r.centreDrift).padStart(5)}  ${String(pm).padStart(14)}  ${String(run).padStart(16)}  ${r.docH}`);
}
console.log(failures === 0 ? `\n${only ? "SUBSET PASS" : "ALL PASS"}  0 failed` : `\nFAILURES  ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
