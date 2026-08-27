// WHAT A PINNED SCENE PROMISES, AND THE FOUR WAYS IT BREAKS WITHOUT SAYING SO.
//
// Every chapter of the v6 homepage is `height: N svh` with a `position: sticky; height: 100svh;
// overflow: hidden` pin inside it, scrubbed from scroll position. Four things can go wrong with that, and
// none of them throws, logs, or looks broken in a screenshot of the top of the page:
//
//   1. THE SCENE IS CUT. Content composed against a tall window does not shrink on a short one, it is
//      clipped by the pin's own overflow rule. The bottom of the argument is simply not there. This was
//      shipping at 1366x768 and 1440x900 -- mainstream laptops -- and went unnoticed for exactly this
//      reason: the earlier measurement sampled each chapter at ONE phase, mid-chapter, and the worst clip
//      in Direction is at phase 0.83 and in Standard at 0.13. Every check here sweeps the whole scrub.
//   2. THE FILM STOPS RUNNING. If the engine's height gate and the stylesheet's disagree, a chapter is
//      pinned with --p frozen, or unpinned with its parts still hidden at opacity 0. Both look like a
//      static page rather than an error.
//   3. THE BAR COMES UNSTUCK FROM THE GROUND. The nav samples the colour beneath it; chapter 3 resolves
//      its ground from paper to graphite over a quarter of a second AFTER the reader stops scrolling. A
//      sampler that only listens to scroll events is left holding the pre-transition colour, which is a
//      hard grey edge across the top of a near-black page, with dark type on it.
//   4. CONTENT NEEDS MOTION IN ORDER TO EXIST. Parts that start at opacity 0 and are revealed by the
//      scrub are unreadable wherever the scrub does not run, unless something else reveals them.
//
// Static analysis cannot see any of it, which is why this is a live-server probe rather than a
// scripts/*-verify.ts. Run it against a dev server:
//
//   node ops/v6-viewport-probe.mjs http://localhost:3200/dev-preview/v6
//
// NOTHING HERE MAY PASS VACUOUSLY. Every check first asserts that it found something to measure, because
// a selector that quietly stopped matching would otherwise turn into a green tick. And every result is
// printed AS IT IS MEASURED rather than buffered to the end: this sweep takes minutes, and a run that
// shows nothing until it finishes cannot be watched, cannot be interrupted usefully, and hides which
// viewport was responsible when it dies partway.
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
const CH = ["gap", "au", "st", "rg", "dr"];

// --only=<substring> narrows the sweep while working on one band. It is a development convenience and
// NOT a way to make a run pass: a filtered run says so in its header and in its final line, so a green
// result from a subset can never be mistaken for a green result from the matrix.
const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7);

let failures = 0;
const ok = (n, c, d = "") => {
  console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${d ? `  — ${d}` : ""}`);
  if (!c) failures++;
};

const VIEWPORTS = [
  // Grouped by the shape of the space rather than by device. Each class carries at least one geometry on
  // BOTH sides of a gate where one exists, because a gate nobody tests the far side of is a gate nobody
  // knows the behaviour of. `pinned` is what the height gates should decide here:
  //   the film runs at >= 520px tall on the wide composition, >= 660px on the narrow one.
  { cls: "narrow/tall", name: "360x800", w: 360, h: 800, pinned: true },
  { cls: "narrow/tall", name: "390x844", w: 390, h: 844, pinned: true },
  { cls: "narrow/tall", name: "430x932", w: 430, h: 932, pinned: true },
  { cls: "narrow/short", name: "360x660", w: 360, h: 660, pinned: true },
  { cls: "narrow/short", name: "390x700", w: 390, h: 700, pinned: true },
  { cls: "narrow/short", name: "360x568", w: 360, h: 568, pinned: false },
  { cls: "tablet", name: "768x1024", w: 768, h: 1024, pinned: true },
  { cls: "tablet", name: "834x1112", w: 834, h: 1112, pinned: true },
  { cls: "wide/short", name: "1093x525", w: 1093, h: 525, pinned: true },
  { cls: "wide/short", name: "1093x614", w: 1093, h: 614, pinned: true },
  { cls: "wide/short", name: "1242x597", w: 1242, h: 597, pinned: true },
  { cls: "wide/short", name: "1366x500", w: 1366, h: 500, pinned: false },
  { cls: "laptop", name: "1280x720", w: 1280, h: 720, pinned: true },
  { cls: "laptop", name: "1366x657", w: 1366, h: 657, pinned: true },
  { cls: "laptop", name: "1366x768", w: 1366, h: 768, pinned: true },
  { cls: "laptop", name: "1440x900", w: 1440, h: 900, pinned: true },
  { cls: "desktop/wide", name: "1680x1050", w: 1680, h: 1050, pinned: true },
  { cls: "desktop/wide", name: "2560x1440", w: 2560, h: 1440, pinned: true },
];

const started = Date.now();
const browser = await chromium.launch();
const rows = [];

// ── REFUSALS THAT ALREADY SHIP, AND WHY THEY ARE LISTED RATHER THAN EXEMPTED ────────────────────────────
//
// This is NOT a fifth way to pass the classifier. Everything below is still refused by it, still counted,
// and still printed in full every single run. The list decides one thing only: whether a defect that was
// already on main blocks a build that did not cause it.
//
// It is the same shape as scripts/lint-baseline.json and the lint gate in scripts/gates.ts, for the same
// reason: this repository inherits problems it did not introduce, and the honest handling is to name them,
// measure them, and fail on GROWTH -- not to pretend they are fine and not to block every unrelated change
// behind them.
//
// Each entry must record the value measured on the stated commit with scrolling forced deterministic.
// `scroll-behavior: smooth` was still live on main and it corrupts this measurement: main first read 4.82px
// here because the probe's scrollTo was being animated and never reached the phase it asked for. Measured
// properly on both, main@29bfe09f and this branch agree at 5.50px, which is how we know it is inherited.
//
// A listed entry that stops appearing is reported so it can be deleted. A list that only grows is a list
// nobody prunes.
const INHERITED = [
  // EMPTY, AND THAT IS THE POINT. This carried one entry: .v6-st__cond overhanging its pin by 5.5px at
  // 360x800, measured identically on main@29bfe09f and on the branch, listed so an already-shipping defect
  // did not block unrelated work. The narrow density system closed it, the probe reported RESOLVED on the
  // next full run, and the entry came out. A baseline that only ever grows is a baseline nobody prunes.
];
const inheritedSeen = new Set();

const SELECTED = only ? VIEWPORTS.filter((v) => v.name.includes(only)) : VIEWPORTS;
if (only && SELECTED.length === 0) {
  console.error(`  --only=${only} matched none of the ${VIEWPORTS.length} viewports`);
  process.exit(2);
}

console.log(`\n  v6 viewport probe  ->  ${URL_UNDER_TEST}`);
console.log(`  ${SELECTED.length} viewport(s), each at both motion preferences where that can differ`);
if (only) console.log(`  FILTERED to "${only}" — this is NOT the full matrix\n`);
else console.log("");

for (const vp of SELECTED) {
  for (const reduced of [false, true]) {
    if (reduced && !vp.pinned) continue; // already unpinned; the preference adds nothing to learn
    const label = vp.name + (reduced ? " reduced" : "");
    process.stdout.write(`  ${label.padEnd(30)} measuring…`);

    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    const page = await ctx.newPage();
    const jsErrors = [];
    page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 100)));
    await page.goto(URL_UNDER_TEST, { waitUntil: "networkidle" });
    await page.waitForTimeout(1400);

    const r = await page.evaluate(async (CH) => {
      const lightness = (s) => {
        const m = /oklab\(([\d.]+)/.exec(s);
        if (m) return +m[1];
        const g = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s);
        return g ? (+g[1] * 0.2126 + +g[2] * 0.7152 + +g[3] * 0.0722) / 255 : null;
      };

      // ── THE ONE EXCLUSION THIS PROBE GRANTS, AND THE FIVE WAYS IT IS REFUSED ─────────────────────────
      //
      // A part that enters by travelling -- .v6-au__turnt is translateY(14px) -> 0 as it fades in -- is
      // outside the pin for the first frames of its own entrance and inside it for good afterwards. That
      // overhang belongs to the entrance, not to the composition, and no reader ever sees anything
      // missing: the only thing past the edge is the empty half-leading below the last line of type.
      //
      // Measured at 390x844: .v6-au__turnt--2 crosses the pin's bottom edge by 2.44px at phase 0.767,
      // while 36% opaque and still 5px short of where it lands. At full opacity it rests 2.66px INSIDE
      // the pin. Its line box is 19.99px on a 14.08px font, so 2.96px of empty half-leading sits under
      // the glyphs -- more than the overhang. Disabling the pin's clip at that exact frame revealed zero
      // extra ink pixels. The same 2.44px is present on main@29bfe09f, so it predates this work.
      //
      // AN EXCLUSION IS A HOLE IN A TEST, so this one is refused on any of five grounds, and everything
      // it does grant is printed with its measurement so it can never quietly grow into a real clip:
      //
      //   1. VISIBLE INK past the edge, beyond INK_TOLERANCE_PX. Not inferred from the box -- computed
      //      from the font's own metrics for THE LAST LINE'S OWN CHARACTERS. The last line box's bottom,
      //      less its true half-leading, is the content-area bottom; the baseline sits one
      //      fontBoundingBoxDescent above that; real glyph ink reaches actualBoundingBoxDescent below the
      //      baseline. If that lands past the pin, a glyph is cut, whatever the box says.
      //   2. RESTING OVERFLOW. The element's box with its own translation and every ancestor's removed
      //      must be inside the pin, so a part genuinely composed too tall can never claim to be
      //      "arriving". This is what separates the 390x844 case (rests 2.66px INSIDE) from the 360x800
      //      one (rests 38.02px OUTSIDE, at full opacity, permanently) -- see the note below.
      //   3. EXCESSIVE OVERHANG. Beyond MAX_TRANSIENT_PX no travel justifies it, however transient.
      //   4. SCALING. A non-identity scale anywhere in the chain forfeits it, because a scaled box does
      //      not move by a simple offset and this arithmetic would be guessing at it.
      //
      // WHY THE INK TOLERANCE IS ONE PIXEL AND NOT ZERO. Measured on .v6-au__turnt--2 at 390x844, phase
      // 0.767: the last line is "the certificate, and no stake in the answer it gives you.", whose 'g'
      // and 'y' descend 3px into a 4px font descent, under 0.997px of true half-leading, against a
      // 2.502px box overhang. Real glyph ink therefore crosses the pin edge by 0.505px.
      //
      // That is half a CSS pixel of the very bottom of two descenders, at 36% opacity, for a few frames
      // of an entrance. Toggling the pin's own `overflow` at that exact frame and diffing the band
      // revealed ZERO additional ink pixels and a one-unit luminance difference in a single row -- it
      // cannot be resolved on a display. A zero-tolerance gate would fail on it, and a gate that fails on
      // a measured non-event is a gate people widen until it stops catching anything.
      //
      // One device pixel is the smallest thing that can actually be seen, so that is the line. Note this
      // deliberately REPLACES an earlier half-leading test: that proxy computed leading as
      // (line-height - font-size)/2, which read 2.96px here against a true 0.997px, and would have waved
      // this through for the wrong reason. Measuring the ink directly makes the proxy redundant, and
      // measuring it wrongly made it dangerous.
      const MAX_TRANSIENT_PX = 4;
      const INK_TOLERANCE_PX = 1;

      const restingOffset = (el, stop) => {
        let dy = 0, n = el, scaled = false;
        while (n && n !== stop) {
          const t = getComputedStyle(n).transform;
          if (t && t !== "none") {
            const m = new DOMMatrixReadOnly(t);
            dy += m.f;
            if (Math.abs(m.a - 1) > 0.001 || Math.abs(m.d - 1) > 0.001) scaled = true;
          }
          n = n.parentElement;
        }
        return { dy, scaled };
      };

      let inkCanvas = null;

      // THE GLYPHS ON THE LAST LINE, NOT EVERY GLYPH IN THE PARAGRAPH.
      //
      // measureText reports actualBoundingBoxDescent for the string it is given, so measuring the whole
      // paragraph asks "how deep is the deepest descender anywhere in it" and then assumes that descender
      // sits on the final line. For "An agent cannot. It has no licence to lose, no name on the incident
      // report" that charged the last line with the tail of a 'g' several lines above it and reported ink
      // 0.41px past the pin edge, on a frame where toggling the pin's own clip revealed zero extra ink
      // pixels. Over-reporting is the safe direction for a gate to err in, but not when it converts a
      // measured non-event into a failure -- that trains people to widen the exemption, which is the one
      // thing it must never be widened by.
      //
      // So: find the bottom-most line box, collect only the characters whose own rect sits on it, and
      // measure those. Cached per element because the text does not change between phases, and only ever
      // reached by an element already known to overhang.
      const lastLineCache = new WeakMap();
      const lastLineText = (el) => {
        if (lastLineCache.has(el)) return lastLineCache.get(el);
        let result = null;
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const nodes = [];
        let node;
        while ((node = walker.nextNode())) if (node.textContent.trim()) nodes.push(node);
        if (nodes.length) {
          const whole = document.createRange();
          whole.selectNodeContents(el);
          const rects = [...whole.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
          if (rects.length) {
            const lastTop = Math.max(...rects.map((r) => r.top));
            let out = "";
            for (const n of nodes) {
              const t = n.textContent;
              for (let i = 0; i < t.length; i++) {
                const r = document.createRange();
                r.setStart(n, i);
                r.setEnd(n, i + 1);
                const cr = r.getBoundingClientRect();
                if (cr.height && Math.abs(cr.top - lastTop) < 1) out += t[i];
              }
            }
            result = out.trim() || null;
          }
        }
        lastLineCache.set(el, result);
        return result;
      };

      // How far real glyph ink reaches below this element's box bottom edge, in px.
      // Returns null when there is no text to measure, which forfeits the exclusion.
      const inkBottom = (el) => {
        const text = lastLineText(el);
        if (!text) return null;
        const cs = getComputedStyle(el);
        const fs = parseFloat(cs.fontSize), lh = parseFloat(cs.lineHeight);
        if (!Number.isFinite(fs)) return null;
        inkCanvas = inkCanvas || document.createElement("canvas");
        const c = inkCanvas.getContext("2d");
        if (!c) return null;
        c.font = `${cs.fontStyle} ${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
        const m = c.measureText(text.slice(0, 400));
        const fbA = m.fontBoundingBoxAscent, fbD = m.fontBoundingBoxDescent;
        const abD = m.actualBoundingBoxDescent;
        if (![fbA, fbD, abD].every(Number.isFinite)) return null;
        const contentH = fbA + fbD;
        const half = Number.isFinite(lh) && lh > contentH ? (lh - contentH) / 2 : 0;
        // box bottom -> content-area bottom -> baseline -> deepest ink
        return el.getBoundingClientRect().bottom - half - fbD + abD;
      };


      // EVERY REFUSED ELEMENT, NOT JUST THE WORST ONE.
      //
      // This used to keep a single `worstClip`, and that hid a second defect behind a first: at 360x800
      // chapter 2 overran its pin by 43px, and while that was true nothing could see that chapter 4 was
      // overrunning its own by 5.5px as well. Fixing the larger one then looked like it had INTRODUCED the
      // smaller one, because that was the first run in which it was the worst. A probe that reports one
      // failure per viewport cannot tell you what it is still hiding.
      let pinnedCount = 0, scrubbing = 0;
      const excluded = new Map();
      const refusedMap = new Map();

      for (const key of CH) {
        const wrap = document.querySelector(".v6-" + key);
        const pin = wrap && wrap.querySelector('[class*="__pin"]');
        if (!wrap || !pin) continue;
        const isPinned = getComputedStyle(pin).position === "sticky";
        if (isPinned) pinnedCount++;

        const top = wrap.getBoundingClientRect().top + window.scrollY;
        const travel = wrap.offsetHeight - window.innerHeight;
        const seenPhases = new Set();
        // An unpinned chapter has --p held at one value and nothing to clip, so it needs only enough
        // samples to prove the value does not move. A pinned one gets the full sweep.
        const STEPS = isPinned ? 30 : 4;

        for (let i = 0; i <= STEPS; i++) {
          window.scrollTo(0, Math.round(top + travel * (i / STEPS)));
          // DETERMINISTIC BY CONSTRUCTION: wait out progress.ts's rAF easing before reading anything.
          // Sampling a smooth-scrolled or mid-eased frame is how three earlier measurements went wrong.
          for (let k = 0; k < 14; k++) await new Promise((res) => requestAnimationFrame(res));
          seenPhases.add(getComputedStyle(wrap).getPropertyValue("--p").trim());
          if (!isPinned) continue;

          const pr = pin.getBoundingClientRect();
          for (const e of pin.querySelectorAll("*")) {
            const cs = getComputedStyle(e);
            if (cs.display === "none" || cs.visibility === "hidden") continue;
            let op = 1, n = e;
            while (n && n !== pin) { op *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement; }
            if (op < 0.35) continue; // below this it is leaving, or has not yet arrived
            const b = e.getBoundingClientRect();
            if (!b.height || !b.width) continue;

            const over = Math.max(b.bottom - pr.bottom, pr.top - b.top);
            if (over <= 0.05) continue;

            const cls = String((e.className && e.className.baseVal) || e.className || e.tagName).trim();
            const { dy, scaled } = restingOffset(e, pin);
            const ink = inkBottom(e);
            const restOver = b.bottom - dy - pr.bottom;

            const why = [];
            if (scaled) why.push("scaled");
            if (!(b.bottom - dy <= pr.bottom + 0.05 && b.top - dy >= pr.top - 0.05)) {
              why.push(`rests ${restOver.toFixed(2)}px outside`);
            }
            if (over > MAX_TRANSIENT_PX) why.push(`overhang ${over.toFixed(2)}px exceeds ${MAX_TRANSIENT_PX}px`);
            if (ink === null) why.push("no measurable ink");
            else if (ink - pr.bottom > INK_TOLERANCE_PX) why.push(`ink ${(ink - pr.bottom).toFixed(2)}px past edge`);

            if (why.length === 0) {
              const k = `${key}|${cls.slice(0, 30)}`;
              const prev = excluded.get(k);
              if (!prev || over > prev.over) {
                excluded.set(k, {
                  ch: key, cls: cls.slice(0, 30), over,
                  inkPast: ink === null ? null : ink - pr.bottom,
                  rest: -restOver, p: i / STEPS, op,
                });
              }
            } else {
              const k = `${key}|${cls.slice(0, 30)}`;
              const prev = refusedMap.get(k);
              if (!prev || over > prev.over) {
                refusedMap.set(k, {
                  ch: key, cls: cls.slice(0, 30), over, p: i / STEPS, op, why: why.join(", "),
                });
              }
            }
          }
        }
        if (seenPhases.size > 1) scrubbing++;
      }

      // ── the bar against the ground it sits on, through chapter 3's resolve ──
      let worstSeam = 0, themeDisagrees = 0, seamSamples = 0;
      const gapWrap = document.querySelector(".v6-gap");
      const navEl = document.querySelector(".v6-nav");
      if (gapWrap && navEl) {
        for (const ph of [0.5, 0.86, 0.94, 1.0]) {
          const t = gapWrap.getBoundingClientRect().top + window.scrollY;
          window.scrollTo(0, Math.round(t + (gapWrap.offsetHeight - window.innerHeight) * ph));
          for (let k = 0; k < 40; k++) await new Promise((res) => requestAnimationFrame(res));
          await new Promise((res) => setTimeout(res, 240)); // past the sampler's own settle chase
          const gL = lightness(getComputedStyle(gapWrap).backgroundColor);
          const nL = lightness(getComputedStyle(navEl).getPropertyValue("--nav-bg").trim());
          if (gL == null || nL == null) continue;
          seamSamples++;
          worstSeam = Math.max(worstSeam, Math.abs(gL - nL));
          // the other half of the same bug: type styled for a ground the bar no longer sits on
          if ((navEl.getAttribute("data-theme") === "dark") !== gL < 0.5) themeDisagrees++;
        }
      }

      // ── content that only exists while something is moving ──
      const els = [...document.querySelectorAll("body *")].filter((e) =>
        /^(P|H1|H2|H3|H4|LI|SPAN|A|BUTTON)$/.test(e.tagName) &&
        [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join("").length > 2);
      const everSeen = new Set();
      const visible = (e) => {
        let n = e;
        while (n && n !== document.body) {
          const s = getComputedStyle(n);
          if (s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity) < 0.08) return false;
          n = n.parentElement;
        }
        return true;
      };
      const sweep = () => els.forEach((e, i) => { if (visible(e)) everSeen.add(i); });
      sweep();
      for (let y = 0; y < document.documentElement.scrollHeight; y += Math.round(window.innerHeight * 0.24)) {
        window.scrollTo(0, y);
        await new Promise((res) => setTimeout(res, 50));
        sweep();
      }
      sweep();
      // OWN-OPACITY ONLY. The nav behind its drawer, and the Business-area column chapters.css drops at
      // 900px, are hidden by an ANCESTOR: those are layout decisions and are identical with and without
      // the motion preference. Content stranded BY MOTION is what this is looking for.
      const stranded = els.filter((e, i) => !everSeen.has(i) && getComputedStyle(e).opacity === "0");

      window.scrollTo(0, 0);
      return {
        chapters: CH.length, pinnedCount, scrubbing,
        refused: [...refusedMap.values()].sort((a, b) => b.over - a.over),
        worstClip: +Math.max(0, ...[...refusedMap.values()].map((x) => x.over)).toFixed(2),
        excluded: [...excluded.values()],
        worstSeam: +worstSeam.toFixed(3), seamSamples, themeDisagrees,
        textEls: els.length,
        stranded: stranded.length,
        strandedWhat: stranded.slice(0, 3).map((e) => (e.textContent || "").trim().slice(0, 34)),
        scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
        docH: document.documentElement.scrollHeight,
      };
    }, CH);

    r.name = label;
    r.cls = vp.cls;
    r.expectPinned = vp.pinned && !reduced;
    r.jsErrors = jsErrors;
    rows.push(r);
    await ctx.close();

    // ── report this viewport NOW, not at the end ──
    process.stdout.write("\r" + " ".repeat(46) + "\r");
    console.log(`\n  ${label}   (${vp.w}x${vp.h}${reduced ? ", prefers-reduced-motion" : ""})`);
    ok("found all five chapters and text to measure", r.chapters === 5 && r.textEls > 50,
      `${r.chapters} chapters, ${r.textEls} text elements`);
    ok("found a ground/bar pair to compare", r.seamSamples > 0, "the seam check would be vacuous");
    if (r.expectPinned) {
      ok(`all five chapters pin`, r.pinnedCount === 5, `${r.pinnedCount}/5`);
      ok(`all five scrub`, r.scrubbing === 5, `${r.scrubbing}/5 showed more than one phase value`);
    } else {
      ok(`unpinned, as the stacked composition`, r.pinnedCount === 0, `${r.pinnedCount}/5 still pinned`);
    }
    // Split the refusals into "already shipping on main" and "this branch's problem".
    const known = [], fresh = [];
    for (const x of r.refused) {
      const hit = INHERITED.find((k) => k.viewport === label && k.ch === x.ch && x.cls.startsWith(k.cls));
      if (hit && x.over <= hit.over + hit.tolerance) { inheritedSeen.add(hit); known.push({ x, hit }); }
      else fresh.push(x);
    }
    ok(`nothing newly clipped${fresh.length > 1 ? ` (${fresh.length} elements refused)` : ""}`,
      fresh.length === 0,
      fresh.map((x) => `.v6-${x.ch} p=${x.p.toFixed(2)} <${x.cls}> ${x.over.toFixed(2)}px: ${x.why}`).join("  |  "));
    for (const { x, hit } of known) {
      console.log(`  KNOWN  inherited refusal, not introduced here: .v6-${x.ch} <${x.cls}> `
        + `${x.over.toFixed(2)}px at p=${x.p.toFixed(2)} (${hit.measuredAt}: ${hit.over}px, `
        + `fails above ${(hit.over + hit.tolerance).toFixed(2)}px)`);
      console.log(`           ${x.why}`);
    }
    ok("nav within 0.02 lightness of the ground", r.worstSeam <= 0.02, `worst ${r.worstSeam}`);
    ok("data-theme agrees with the ground", r.themeDisagrees === 0, `${r.themeDisagrees}/${r.seamSamples} samples`);
    ok("no content stranded at opacity 0", r.stranded === 0, r.strandedWhat.join(" | "));
    ok("scroll-behavior is auto", r.scrollBehavior === "auto", r.scrollBehavior);
    if (r.jsErrors.length) ok("no page errors", false, r.jsErrors[0]);
    for (const x of r.excluded) {
      console.log(`  NOTE  transient overhang excluded: .v6-${x.ch} <${x.cls}> box +${x.over.toFixed(2)}px `
        + `past the pin at p=${x.p.toFixed(2)}, opacity ${x.op.toFixed(2)}`);
      console.log(`          entrance travel only — rests ${x.rest.toFixed(2)}px INSIDE the pin at full opacity; `
        + `glyph ink ${x.inkPast === null ? "not measurable"
          : x.inkPast <= 0 ? `clears the edge by ${(-x.inkPast).toFixed(2)}px`
          : `crosses by ${x.inkPast.toFixed(2)}px, within the ${1}px sub-device-pixel tolerance`}`);
    }
  }
}
await browser.close();

console.log("\n── matrix ──");
console.log("  viewport                       pin  scrub  clip   seam   stranded  excl  doc");
for (const r of rows) {
  console.log(`  ${r.name.padEnd(30)} ${r.pinnedCount}/5   ${r.scrubbing}/5   `
    + `${String(r.worstClip).padEnd(6)} ${String(r.worstSeam).padEnd(6)} `
    + `${String(r.stranded).padEnd(9)} ${String(r.excluded.length).padEnd(5)} ${r.docH}`);
}

// A baseline that only ever grows is a baseline nobody prunes, so say when an entry has stopped happening.
// Only meaningful on a full run: a filtered one simply did not visit the other viewports.
if (!only) {
  for (const k of INHERITED) {
    if (!inheritedSeen.has(k)) {
      console.log(`\n  RESOLVED  the inherited refusal ${k.viewport} <${k.cls}> no longer occurs.`);
      console.log("            Delete it from INHERITED in this file so the list keeps meaning something.");
    }
  }
}

const totalExcluded = rows.reduce((a, r) => a + r.excluded.length, 0);
console.log(`\n  ${rows.length} runs, ${Math.round((Date.now() - started) / 1000)}s, `
  + `${totalExcluded} transient overhang(s) excluded (each printed above with its measurement).`);
if (only) console.log(`  FILTERED RUN ("${only}") — ${VIEWPORTS.length - SELECTED.length} viewport(s) were not measured.`);
console.log(failures === 0
  ? `\n${only ? "SUBSET PASS" : "ALL PASS"}  0 failed`
  : `\nFAILURES  ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
