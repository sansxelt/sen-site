// DOES THE READER KEEP THEIR PLACE WHEN THE WINDOW CHANGES UNDER THEM?
//
// Not "does the page render correctly at size B" -- two fresh loads at two sizes both pass that and say
// nothing about the defect. This resizes ONE LIVE PAGE with the reader partway through a chapter, which is
// what entering fullscreen, rotating a phone, zooming, or dragging a window edge actually is.
//
// ACCEPTANCE IS SEMANTIC. Global document percentage is the wrong measure and passing it would be the wrong
// goal: the document legitimately re-proportions when svh changes, so the same narrative moment IS a
// different percentage afterwards. What must survive is the chapter the reader is in and how far through
// that chapter's own travel they are.
//
//   node ops/v6-transition-probe.mjs                  the whole matrix
//   node ops/v6-transition-probe.mjs --only=<pair>    one geometry pair
//   node ops/v6-transition-probe.mjs --mutate=<kind>  anti-vacuity: these MUST fail
import { chromium } from "playwright";

const URL_ARG = process.argv.find((a) => /^--url=/.test(a));
const URL = URL_ARG ? URL_ARG.slice(6) : "http://localhost:3200/dev-preview/v6";
if (!/^https?:\/\//.test(URL)) { console.error(`  refusing a non-http url: ${URL}`); process.exit(2); }
const ONLY = (process.argv.find((a) => /^--only=/.test(a)) || "").slice(7);
const MUTATE = (process.argv.find((a) => /^--mutate=/.test(a)) || "").slice(9);

// How far the phase may move. A chapter that stays pinned on both sides is a pure coordinate change and
// should land almost exactly; one that crosses pinned <-> stacked is being mapped between two different
// travel models, so it gets room -- but never enough to leave the chapter.
const TOL_SAME_MODE = 0.02;
const TOL_MODE_CHANGE = 0.10;
const TOL_STALE_P = 0.05;

const PAIRS = [
  { key: "desktop-fullscreen", a: [1366, 657], b: [1366, 768], kind: "pinned<->pinned" },
  { key: "chromebook-fullscreen", a: [1093, 525], b: [1093, 614], kind: "pinned<->pinned" },
  { key: "narrow-resize", a: [390, 664], b: [390, 844], kind: "pinned<->pinned" },
  { key: "zoom-step", a: [1366, 768], b: [1093, 614], kind: "pinned<->pinned" },
  { key: "portrait-landscape", a: [390, 844], b: [844, 390], kind: "pinned<->stacked" },
  { key: "tall-short", a: [1366, 768], b: [1366, 500], kind: "pinned<->stacked" },
  { key: "short-short", a: [844, 390], b: [1000, 480], kind: "stacked<->stacked" },
];

const CHAPTERS = ["v6-au", "v6-gap", "v6-st", "v6-rg", "v6-dr"];
const POSITIONS = [["entry", 0], ["25%", 0.25], ["50%", 0.5], ["75%", 0.75], ["exit", 1]];

let fails = 0;
let checks = 0;
let transitions = 0;
const fail = (m) => { console.log(`  FAIL  ${m}`); fails++; checks++; };
const pass = (m) => { console.log(`  pass  ${m}`); checks++; };
const ok = (c, m) => (c ? pass(m) : fail(m));

// ---- in-page measurement -------------------------------------------------------------------------------

const READ = `(() => {
  const y = window.scrollY, vh = window.innerHeight;
  const list = [];
  for (const el of document.querySelectorAll('#v6-main section, #v6-main > div')) {
    const pin = el.querySelector(':scope > [class*="__pin"]');
    if (!pin) continue;
    const r = el.getBoundingClientRect();
    const pinned = getComputedStyle(pin).position === 'sticky';
    const travel = pinned ? Math.max(0, r.height - pin.getBoundingClientRect().height) : 0;
    const cls = (el.className || '').split(/\\s+/).find((c) => /^v6-[a-z]+$/.test(c));
    if (!cls) continue;
    list.push({ cls, top: r.top + y, height: r.height, travel, pinned });
  }
  list.sort((a, b) => a.top - b.top);
  const span = (c) => (c.pinned ? c.travel : Math.max(0, c.height - vh));
  let active = null, phase = 0;
  for (const c of list) {
    const s = span(c);
    // A CHAPTER OWNS ITS WHOLE BOX, not just its pinned travel. Each wrapper carries one viewport-height of
    // tail past the end of the scrub -- measured at 1366x657: every chapter's box ends exactly 657px after
    // its travel does -- which is where the pin releases and the scene scrolls away. Judging ownership by
    // travel alone made phase 1.0 round one pixel into that tail and report NO chapter, while the system
    // being tested uses the box. A probe that defines the question differently from the code is not
    // measuring the code.
    const owns = Math.max(s, c.height - vh);
    // Same one-pixel tolerance the system uses, for the same reason: scrollY is an integer, layout is not.
    if (y >= c.top - 1 && y <= c.top + Math.max(owns, 1) + 1) { active = c; phase = s > 0 ? (y - c.top) / s : 0; break; }
  }
  let ink = 0, pRendered = null, clipped = 0;
  if (active) {
    const el = [...document.querySelectorAll('.' + active.cls)][0];
    pRendered = parseFloat(getComputedStyle(el).getPropertyValue('--p'));
    const pin = el.querySelector(':scope > [class*="__pin"]');
    const pb = pin.getBoundingClientRect();
    for (const e of pin.querySelectorAll('*')) {
      const cs = getComputedStyle(e);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (!(parseFloat(cs.opacity) > 0.05)) continue;
      const r = e.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (r.bottom > 0 && r.top < vh) ink++;
      if (r.left < pb.left - 1.5 || r.right > pb.right + 1.5) {
        let scroller = false;
        for (let n = e.parentElement; n && n !== pin.parentElement; n = n.parentElement) {
          const ov = getComputedStyle(n).overflowX;
          if (ov === 'auto' || ov === 'scroll') { scroller = true; break; }
        }
        if (!scroller) clipped++;
      }
    }
  }
  const probe = [...document.body.children].find((e) => e.style && e.style.height === '100svh');
  return {
    y, vh, vw: window.innerWidth, doc: document.documentElement.scrollHeight,
    n: list.length, active: active ? active.cls : null, phase: active ? Math.max(0, Math.min(1, phase)) : null,
    mode: active ? (active.pinned ? 'pinned' : 'stacked') : null,
    ink, clipped, pRendered,
    probe: probe ? { w: Math.round(probe.getBoundingClientRect().width), h: Math.round(probe.getBoundingClientRect().height) } : null,
    href: location.pathname,
    chapters: list.map((c) => ({ cls: c.cls, top: Math.round(c.top), span: Math.round(span(c)), pinned: c.pinned })),
  };
})()`;

const read = (page) => page.evaluate(READ);

/** Put the reader at a named position inside a named chapter. Returns null when that chapter has no travel. */
async function seek(page, cls, frac) {
  const target = await page.evaluate(([cls, frac]) => {
    const el = document.querySelector('.' + cls);
    if (!el) return null;
    const pin = el.querySelector(':scope > [class*="__pin"]');
    const r = el.getBoundingClientRect();
    const pinned = getComputedStyle(pin).position === 'sticky';
    const span = pinned
      ? Math.max(0, r.height - pin.getBoundingClientRect().height)
      : Math.max(0, r.height - window.innerHeight);
    const top = r.top + window.scrollY;
    return Math.round(top + frac * span);
  }, [cls, frac]);
  if (target === null) return null;
  await page.evaluate((y) => window.scrollTo(0, y), target);
  await page.waitForTimeout(420);
  return target;
}

/** Resize live and let the controller settle. No reload, no navigation -- that is the whole point. */
async function resize(page, [w, h]) {
  // "no-resize" leaves the viewport alone while the suite believes it changed it. Every anti-vacuity guard
  // that keys off the geometry actually moving should trip; if the suite still passes, those guards are
  // decoration.
  if (MUTATE !== "no-resize") await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(700);
  transitions++;
}

// ---- assertions ----------------------------------------------------------------------------------------

function compare(label, before, after) {
  // ANTI-VACUITY, CHECKED ON EVERY SINGLE TRANSITION rather than once at the top.
  if (before.n !== 5 || after.n !== 5) return fail(`${label}: measured ${before.n}->${after.n} chapters, expected 5 (nothing was really measured)`);
  if (before.href !== after.href) return fail(`${label}: navigated away, ${before.href} -> ${after.href}`);
  if (before.doc === after.doc && before.vh !== after.vh) return fail(`${label}: viewport changed but document height did not -- the page did not react at all`);
  if (before.probe && after.probe && before.probe.h === after.probe.h && before.probe.w === after.probe.w) {
    return fail(`${label}: the svh probe never changed size, so no geometry change was delivered`);
  }
  if (before.active === null) return fail(`${label}: no active chapter BEFORE the transition -- the seek failed`);

  if (after.active === null) return fail(`${label}: reader left every chapter (was ${before.active} @ ${before.phase.toFixed(3)})`);
  if (after.active !== before.active) {
    return fail(`${label}: chapter changed ${before.active} @ ${before.phase.toFixed(3)} -> ${after.active} @ ${after.phase.toFixed(3)}`);
  }

  const tol = before.mode === after.mode ? TOL_SAME_MODE : TOL_MODE_CHANGE;
  const d = Math.abs(after.phase - before.phase);
  ok(d <= tol, `${label}: ${before.active} phase ${before.phase.toFixed(3)} -> ${after.phase.toFixed(3)} (d=${d.toFixed(3)}, tol ${tol}, ${before.mode}->${after.mode})`);

  if (after.ink === 0) fail(`${label}: BLANK STAGE after transition (${after.active})`);
  if (after.clipped > 0) fail(`${label}: ${after.clipped} element(s) clipped past the pin after transition`);

  // A stale --p is a stage painted for a position the reader is no longer at.
  if (after.mode === "pinned" && Number.isFinite(after.pRendered)) {
    const sd = Math.abs(after.pRendered - after.phase);
    ok(sd <= TOL_STALE_P, `${label}: --p ${after.pRendered.toFixed(3)} vs geometry phase ${after.phase.toFixed(3)} (d=${sd.toFixed(3)})`);
  }
}

// ---- the matrix ----------------------------------------------------------------------------------------

const browser = await chromium.launch();

async function openAt(size, reduced) {
  const ctx = await browser.newContext({
    viewport: { width: size[0], height: size[1] },
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1300);
  if (MUTATE === "kill-probe") {
    // Removes the one signal the controller reacts to. Every remap should stop happening; a suite that still
    // passes after this is measuring nothing.
    await page.evaluate(() => {
      const p = [...document.body.children].find((e) => e.style && e.style.height === "100svh");
      if (p) p.remove();
    });
  }
  return { ctx, page };
}

for (const pair of PAIRS) {
  if (ONLY && pair.key !== ONLY) continue;
  console.log(`\n=== ${pair.key}  ${pair.a.join("x")} <-> ${pair.b.join("x")}  (${pair.kind}) ===`);

  // FULL SWEEP on the representative pair; a spine of chapters elsewhere so the matrix stays finishable.
  const sweep = pair.key === "desktop-fullscreen" ? CHAPTERS : ["v6-st", "v6-rg", "v6-dr"];
  const positions = pair.key === "desktop-fullscreen" ? POSITIONS : [["50%", 0.5]];

  const { ctx, page } = await openAt(pair.a, false);

  for (const cls of sweep) {
    for (const [pname, frac] of positions) {
      if ((await seek(page, cls, frac)) === null) { fail(`${cls} not found at ${pair.a.join("x")}`); continue; }
      const before = await read(page);

      await resize(page, pair.b);
      const after = await read(page);
      compare(`A->B ${cls}@${pname}`, before, after);

      // AND BACK. A round trip must return the reader to where they started, not merely somewhere valid.
      await resize(page, pair.a);
      const back = await read(page);
      compare(`B->A ${cls}@${pname}`, after, back);
      if (back.active === before.active && before.phase !== null && back.phase !== null) {
        const rt = Math.abs(back.phase - before.phase);
        ok(rt <= TOL_MODE_CHANGE, `round-trip ${cls}@${pname}: ${before.phase.toFixed(3)} -> ${back.phase.toFixed(3)} (d=${rt.toFixed(3)})`);
      }
    }
  }

  // BOUNDARIES. The top must stay the top, and the bottom must stay the bottom.
  for (const [name, place] of [["top", 0], ["bottom", 1]]) {
    await page.evaluate((p) => window.scrollTo(0, p * (document.documentElement.scrollHeight - window.innerHeight)), place);
    await page.waitForTimeout(420);
    const b1 = await page.evaluate(() => ({ y: window.scrollY, max: document.documentElement.scrollHeight - window.innerHeight }));
    await resize(page, pair.b);
    const b2 = await page.evaluate(() => ({ y: window.scrollY, max: document.documentElement.scrollHeight - window.innerHeight }));
    if (name === "top") ok(b2.y <= 2, `boundary top stays pinned to the top (${b1.y} -> ${b2.y})`);
    else ok(Math.abs(b2.y - b2.max) <= 3, `boundary bottom stays at the end (${b1.y}/${b1.max} -> ${b2.y}/${b2.max})`);
    await resize(page, pair.a);
  }

  await ctx.close();
}

// ---- rapid, back-to-back, and reduced motion -----------------------------------------------------------

if (!ONLY) {
  console.log(`\n=== repeated rapid resizing (no settle between) ===`);
  {
    const { ctx, page } = await openAt([1366, 768], false);
    await seek(page, "v6-rg", 0.5);
    const before = await read(page);
    for (const s of [[1366, 700], [1366, 640], [1200, 700], [1366, 768], [1100, 600], [1240, 690]]) {
      await page.setViewportSize({ width: s[0], height: s[1] });
      await page.waitForTimeout(60); // deliberately shorter than the settle window
      transitions++;
    }
    await page.waitForTimeout(1200);
    const after = await read(page);
    compare("rapid burst", before, after);
    await ctx.close();
  }

  console.log(`\n=== back-to-back different geometry changes ===`);
  {
    const { ctx, page } = await openAt([1366, 768], false);
    await seek(page, "v6-dr", 0.5);
    const before = await read(page);
    await resize(page, [844, 390]);   // pinned -> stacked
    const mid = await read(page);
    compare("b2b step 1 (pinned->stacked)", before, mid);
    await resize(page, [390, 844]);   // stacked -> pinned, different width
    const after = await read(page);
    compare("b2b step 2 (stacked->pinned)", mid, after);
    await ctx.close();
  }

  console.log(`\n=== reduced motion, before and after the transition ===`);
  {
    const { ctx, page } = await openAt([1366, 768], true);
    const st = await read(page);
    ok(st.n === 5, `reduced motion still renders all 5 chapters (${st.n})`);
    await seek(page, "v6-rg", 0.5);
    const before = await read(page);
    ok(before.ink > 0, `reduced motion: chapter has content before transition (ink ${before.ink})`);
    await resize(page, [1366, 500]);
    const after = await read(page);
    ok(after.ink > 0, `reduced motion: chapter still has content after transition (ink ${after.ink})`);
    if (before.active && after.active) {
      ok(after.active === before.active, `reduced motion: stayed in ${before.active} (now ${after.active})`);
    }
    await ctx.close();
  }
}

await browser.close();

// ---- verdict -------------------------------------------------------------------------------------------

console.log(`\n  ${checks} checks, ${transitions} live transitions`);
if (transitions < 10) { console.log(`  FAIL  only ${transitions} transitions ran -- the matrix did not execute`); fails++; }

if (MUTATE) {
  console.log(`\n  MUTATION "${MUTATE}": the suite MUST fail. ${fails} failure(s).`);
  if (fails === 0) { console.log(`  VACUOUS -- the suite passes with the system disabled.`); process.exit(1); }
  console.log(`  good: the mutation was caught.`);
  process.exit(0);
}

console.log(fails ? `\nFAILURES: ${fails}` : `\nALL PASS  0 failed`);
process.exit(fails ? 1 : 0);
