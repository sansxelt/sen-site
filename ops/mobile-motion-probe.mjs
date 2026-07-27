// THE FAILURE MODE THAT WOULD BE WORSE THAN NO ANIMATION.
//
// Mobile motion starts every animated part at opacity 0. That is only safe if two things hold, and neither
// is obvious from reading the code:
//
//   1. WITH JAVASCRIPT DISABLED, nothing is hidden. The hidden state is gated on a class JS adds, so a
//      phone that never runs the observer must still see a complete page.
//   2. AFTER A FULL SCROLL, nothing is still hidden. A part that never reaches its trigger is content the
//      customer can never read, which is strictly worse than the stillness this replaced.
import { chromium, devices } from "playwright";

const URL = process.argv[2] || "http://localhost:3311/";
const PARTS = ".v6-gap__t, .v6-st__cond, .v6-rg__row, .v6-rg__foot, .v6-dr__layer, .v6-tm__ex, .v6-cs__m > *";

const browser = await chromium.launch();
let failures = 0;
const ok = (n, c, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  — ${d}` : ""}`); if (!c) failures++; };

// ── 1. No JavaScript at all ───────────────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ ...devices["iPhone 13"], javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const r = await page.evaluate((sel) => {
    const els = [...document.querySelectorAll(sel)];
    const hidden = els.filter((e) => parseFloat(getComputedStyle(e).opacity) < 0.99);
    return { total: els.length, hidden: hidden.length, moClass: document.documentElement.classList.contains("v6-mo") };
  }, PARTS);
  ok(`no-JS: the marker class is absent (found ${r.total} parts)`, !r.moClass);
  ok("no-JS: every animated part is fully visible", r.hidden === 0, `${r.hidden} of ${r.total} at opacity < 1`);
  ok("no-JS: the page still has its content", r.total > 0, "no parts found at all");
  await ctx.close();
}

// ── 2. With JavaScript, after scrolling the whole page ────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);

  const started = await page.evaluate((sel) => {
    const els = [...document.querySelectorAll(sel)];
    return { moClass: document.documentElement.classList.contains("v6-mo"),
             hiddenAtRest: els.filter((e) => parseFloat(getComputedStyle(e).opacity) < 0.99).length, total: els.length };
  }, PARTS);
  ok("the marker class IS added on a phone", started.moClass);
  ok("something actually starts hidden, so the reveal is real", started.hiddenAtRest > 0,
     `${started.hiddenAtRest} of ${started.total} hidden at load`);

  const vh = await page.evaluate(() => innerHeight);
  const docH = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= docH; y += Math.round(vh * 0.5)) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(1500);

  const after = await page.evaluate((sel) => {
    const els = [...document.querySelectorAll(sel)];
    const stuck = els.filter((e) => !e.classList.contains("v6-in"));
    const invisible = els.filter((e) => parseFloat(getComputedStyle(e).opacity) < 0.99);
    return { total: els.length, stuck: stuck.length, invisible: invisible.length,
             stuckClasses: stuck.slice(0, 5).map((e) => e.className.toString().slice(0, 50)) };
  }, PARTS);
  ok("after a full scroll, every part has been revealed", after.stuck === 0,
     `${after.stuck} of ${after.total} never revealed: ${after.stuckClasses.join(" | ")}`);
  ok("after a full scroll, nothing is left invisible", after.invisible === 0,
     `${after.invisible} of ${after.total} still at opacity < 1`);
  await ctx.close();
}

// ── 3. Reduced motion: still, and never hidden ────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ ...devices["iPhone 13"], reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  const r = await page.evaluate((sel) => {
    const els = [...document.querySelectorAll(sel)];
    return { moClass: document.documentElement.classList.contains("v6-mo"),
             hidden: els.filter((e) => parseFloat(getComputedStyle(e).opacity) < 0.99).length, total: els.length };
  }, PARTS);
  ok("reduced motion: the marker class is refused", !r.moClass);
  ok("reduced motion: nothing is hidden", r.hidden === 0, `${r.hidden} of ${r.total} hidden`);
  await ctx.close();
}

console.log(failures === 0 ? "\nALL PASS" : `\nFAILURES: ${failures}`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);
