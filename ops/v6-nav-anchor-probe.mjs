// IS THE BAR ACTUALLY LOCKED TO THE SCREEN?
//
// A phone reported the Vraelis bar sliding during rubber-band overscroll where Scale's stays put, and the
// emulated measurement said the opposite: 0.00px of drift across 47 scroll positions and 0.00px across a
// viewport-height change. Both were true. position: sticky keeps the bar IN FLOW, and the sticky constraint
// stops applying the moment iOS scrolls past scrollTop 0 -- so the bar rides down with the content during a
// bounce. Headless Chromium does not rubber-band, so nothing it can measure would ever show it.
//
// What this probe CAN hold is everything the fix has to preserve, which is where a positioning change
// actually goes wrong: content pulled up under a bar that left the flow, a menu that loses the reader's
// place, a scope that leaks onto other routes or the desktop. The device is still the only witness for the
// bounce itself.
//
//   node ops/v6-nav-anchor-probe.mjs
import { chromium } from 'playwright';

// What changing sticky -> fixed has to preserve, and what it has to fix.
const browser = await chromium.launch();
let fails = 0;
const ok = (n, c, d = '') => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); if (!c) fails++; };

async function suite(label, w, h, expectFixed) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3200/dev-preview/v6', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  console.log(`\n  ${label}  (${w}x${h})`);

  const pos = await page.evaluate(() => getComputedStyle(document.querySelector('.v6-nav')).position);
  ok(`nav position is ${expectFixed ? 'fixed' : 'sticky'}`, pos === (expectFixed ? 'fixed' : 'sticky'), pos);

  // NO CONTENT JUMP: the first chapter must start in the same place as it did with a flowed bar, i.e.
  // exactly the bar's height below the top of the document.
  const layout = await page.evaluate(() => {
    window.scrollTo(0, 0);
    const nav = document.querySelector('.v6-nav').getBoundingClientRect();
    const main = document.querySelector('#v6-main').getBoundingClientRect();
    const firstSection = document.querySelector('#v6-main section');
    return { navH: +nav.height.toFixed(1), navTop: +nav.top.toFixed(1),
             mainTop: +main.top.toFixed(1),
             firstTop: firstSection ? +firstSection.getBoundingClientRect().top.toFixed(1) : null,
             docH: document.documentElement.scrollHeight };
  });
  // The bar leaving flow must not pull content up under it. padding-top sits INSIDE the border box, so
  // main box top stays 0 and it is the FIRST SECTION that has to land at the bar height -- measuring the
  // box top instead reported a failure against a layout that was already correct.
  ok('content starts below the bar, not under it',
    layout.firstTop !== null && Math.abs(layout.firstTop - layout.navH) < 2,
    `first section top ${layout.firstTop} vs bar height ${layout.navH}`);

  // NORMAL SCROLL
  const walk = await page.evaluate(async () => {
    const nav = document.querySelector('.v6-nav');
    const tops = [], hs = [];
    const docH = document.documentElement.scrollHeight;
    for (let y = 0; y < docH - window.innerHeight; y += Math.round(window.innerHeight * 0.5)) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 45));
      const b = nav.getBoundingClientRect();
      tops.push(+b.top.toFixed(2)); hs.push(+b.height.toFixed(2));
    }
    return { n: tops.length, drift: +(Math.max(...tops) - Math.min(...tops)).toFixed(2),
             hChange: +(Math.max(...hs) - Math.min(...hs)).toFixed(2) };
  });
  ok(`bar holds position across ${walk.n} scroll positions`, walk.drift < 0.5, `drift ${walk.drift}px`);
  ok('bar height constant while scrolling', walk.hChange < 0.5, `${walk.hChange}px`);

  // OVERSCROLL. Chromium will not rubber-band, but a negative scroll target and a wheel past the top are
  // the same inputs iOS turns into a bounce. What is checked is that the bar is not laid out relative to
  // a scroll position that can go negative.
  const over = await page.evaluate(async () => {
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 60));
    const before = document.querySelector('.v6-nav').getBoundingClientRect().top;
    window.scrollBy(0, -400);
    await new Promise((r) => setTimeout(r, 60));
    const after = document.querySelector('.v6-nav').getBoundingClientRect().top;
    return { before: +before.toFixed(2), after: +after.toFixed(2), y: window.scrollY };
  });
  ok('bar unmoved when scrolled past the top', Math.abs(over.after - over.before) < 0.5,
    `${over.before} -> ${over.after} (scrollY ${over.y})`);

  // SAFARI TOOLBAR: viewport height changes under the page, mid-scroll.
  await page.evaluate(() => window.scrollTo(0, 4000));
  await page.waitForTimeout(80);
  const t0 = await page.evaluate(() => { const b = document.querySelector('.v6-nav').getBoundingClientRect(); return { top: +b.top.toFixed(2), h: +b.height.toFixed(2) }; });
  await page.setViewportSize({ width: w, height: h + 66 });
  await page.waitForTimeout(220);
  const t1 = await page.evaluate(() => { const b = document.querySelector('.v6-nav').getBoundingClientRect(); return { top: +b.top.toFixed(2), h: +b.height.toFixed(2) }; });
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(220);
  const t2 = await page.evaluate(() => { const b = document.querySelector('.v6-nav').getBoundingClientRect(); return { top: +b.top.toFixed(2), h: +b.height.toFixed(2) }; });
  ok('bar unmoved across toolbar collapse and expand',
    Math.abs(t1.top - t0.top) < 0.5 && Math.abs(t2.top - t0.top) < 0.5,
    `${t0.top} -> ${t1.top} -> ${t2.top}`);

  // MENU at the top and mid-page
  for (const [where, y] of [['at the top', 0], ['mid-page', 6000]]) {
    const r = await page.evaluate(async (y) => {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 90));
      const yBefore = window.scrollY;
      const burger = document.querySelector('.v6-nav__burger');
      if (!burger) return { skipped: true };
      burger.click();
      await new Promise((r) => setTimeout(r, 320));
      const drawer = document.querySelector('.v6-drawer');
      const d = drawer ? drawer.getBoundingClientRect() : null;
      const openState = { covers: d ? (d.top <= 1 && d.height >= window.innerHeight - 2) : false };
      const closer = document.querySelector('.v6-drawer__top button, .v6-drawer button');
      if (closer) closer.click();
      await new Promise((r) => setTimeout(r, 320));
      const navTop = document.querySelector('.v6-nav').getBoundingClientRect().top;
      return { skipped: false, covers: openState.covers, yBefore, yAfter: window.scrollY,
               navTop: +navTop.toFixed(2), stillOpen: !!document.querySelector('.v6-drawer') };
    }, y);
    if (r.skipped) { ok(`menu ${where}`, false, 'no burger found'); continue; }
    ok(`menu ${where}: drawer covers the screen`, r.covers);
    ok(`menu ${where}: scroll position preserved on close`, Math.abs(r.yAfter - r.yBefore) < 2,
      `${r.yBefore} -> ${r.yAfter}`);
    ok(`menu ${where}: bar back at the top after close`, Math.abs(r.navTop) < 0.5, `top ${r.navTop}`);
  }

  await ctx.close();
}

await suite('mobile homepage', 390, 844, true);
await suite('mobile homepage', 360, 800, true);

// Other v6 route on the same phone width must be UNCHANGED (still sticky).
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3200/dev-preview/v6/developers', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const pos = await page.evaluate(() => getComputedStyle(document.querySelector('.v6-nav')).position);
  console.log('\n  other v6 route, same phone width');
  ok('unrelated route keeps sticky (scope held)', pos === 'sticky', pos);
  await ctx.close();
}
// Desktop must be UNCHANGED.
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3200/dev-preview/v6', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const r = await page.evaluate(() => ({
    pos: getComputedStyle(document.querySelector('.v6-nav')).position,
    mainPad: getComputedStyle(document.querySelector('#v6-main')).paddingTop,
  }));
  console.log('\n  desktop homepage');
  ok('desktop keeps sticky', r.pos === 'sticky', r.pos);
  ok('desktop main has no added spacer', parseFloat(r.mainPad) === 0, r.mainPad);
  await ctx.close();
}

await browser.close();
console.log(fails === 0 ? '\nALL PASS  0 failed' : `\nFAILURES  ${fails} failed`);
process.exit(fails === 0 ? 0 : 1);
