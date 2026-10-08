// HOME_SCROLL_TEST_BASE_URL=http://localhost:3100 node scripts/rapid-home-scroll-verify.mjs
// Browser regression for rapid wheel reversals, keyboard navigation and constrained laptop screens.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.HOME_SCROLL_TEST_BASE_URL || 'http://localhost:3100';
const viewports = [
  { width: 1366, height: 657 },
  { width: 1280, height: 720 },
  { width: 1024, height: 600 },
  { width: 390, height: 844 },
];

async function main() {
  const browser = await chromium.launch({
    executablePath: existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined,
    args: ['--no-sandbox'],
  });
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base, { waitUntil: 'networkidle' });
      const consent = page.getByRole('button', { name: 'Essential only', exact: true });
      if (await consent.isVisible()) await consent.click();
      await page.locator('.v6-h__frame[data-media-ready="ready"]').waitFor();
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

      // Inspect the opening in both directions, including the middle of its handoff.
      // Visible statement letters must have their own opaque surface behind them.
      if (viewport.height >= (viewport.width > 900 ? 620 : 660)) {
        for (const progress of [.36, .42, .48, .56, .48, .42, .36]) {
          await page.evaluate(progress => {
            const root = document.querySelector('.home-sequence');
            const opening = root.querySelector('.v6-opening');
            const stage = root.querySelector('.home-sequence__stage');
            const sequenced = root.hasAttribute('data-sequenced');
            const pin = opening.querySelector('.v6-opening__pin');
            const track = sequenced ? innerHeight * 2.1 - stage.clientHeight : opening.offsetHeight - pin.offsetHeight;
            const start = sequenced ? root.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(stage).top) : opening.getBoundingClientRect().top + scrollY;
            scrollTo(0, start + track * progress);
          }, progress);
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const surface = await page.locator('.v6-opening__statement').evaluate(el => {
            const style = getComputedStyle(el);
            return { opacity: style.opacity, background: style.backgroundColor, clip: style.clipPath };
          });
          assert.equal(surface.opacity, '1', 'The statement must stay opaque throughout the handoff');
          assert.match(surface.background, /^rgb\(\d+, \d+, \d+\)$/, 'Visible text needs an opaque background, not the film');
          assert.notEqual(surface.clip, 'none', 'The statement surface must reveal together with its text');
        }
        await page.keyboard.press('Control+Home');
        await page.waitForFunction(() => scrollY < 2);
      }

      await page.evaluate(() => {
        window.homeScrollAudit = { blankFrames: [], running: true };
        const sample = () => {
          const audit = window.homeScrollAudit;
          if (!audit.running) return;
          const root = document.querySelector('.home-sequence');
          const stage = root.querySelector('.home-sequence__stage');
          const bounds = stage.getBoundingClientRect();
          if (root.hasAttribute('data-sequenced') && bounds.top >= 0 && bounds.top < innerHeight && root.getBoundingClientRect().bottom > innerHeight) {
            const scenes = [...root.querySelectorAll('.home-sequence__scene')];
            const visibleScene = scenes.some(scene => getComputedStyle(scene).visibility === 'visible' && !getComputedStyle(scene).clipPath.startsWith('inset(100%'));
            const opening = root.querySelector('.home-sequence__opening');
            const film = opening.querySelector('.v6-opening__film');
            const statement = opening.querySelector('.v6-opening__statement');
            const visibleOpening = getComputedStyle(opening).visibility === 'visible' && Math.max(Number(getComputedStyle(film).opacity), Number(getComputedStyle(statement).opacity)) > .08;
            if (!visibleScene && !visibleOpening) audit.blankFrames.push(scrollY);
          }
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      await page.mouse.move(Math.min(700, viewport.width / 2), viewport.height / 2);
      for (let i = 0; i < 24; i++) {
        await page.mouse.wheel(0, i % 3 === 2 ? -2100 : 1500);
        await page.waitForTimeout(25);
      }
      // Playwright dispatches wheel input before the compositor has handled it.
      // Let that input reach a frame before sending a different navigation command.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.keyboard.press('Control+Home');
      await page.waitForFunction(() => scrollY < 2);
      await page.waitForTimeout(700);
      assert.ok(await page.evaluate(() => scrollY < 2), 'Wheel easing must not pull the reader down after Home');
      const audit = await page.evaluate(() => {
        window.homeScrollAudit.running = false;
        return window.homeScrollAudit;
      });
      assert.deepEqual(audit.blankFrames, [], 'Rapid reversals must keep a visible chapter in the pinned viewport');

      await page.keyboard.press('Control+End');
      await page.waitForFunction(() => document.documentElement.scrollHeight - innerHeight - scrollY < 3);
      await page.waitForTimeout(500);
      assert.ok(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight - scrollY < 3), 'End must reach and stay at the footer');
      await page.keyboard.press('Control+Home');
      await page.waitForFunction(() => scrollY < 2);

      if (viewport.width === 1366) {
        // Windowed/fullscreen height changes switch the sticky composition in both directions.
        await page.setViewportSize({ width: 1366, height: 600 });
        await page.setViewportSize(viewport);
        await page.waitForTimeout(300);
        await page.mouse.wheel(0, 600);
        await page.waitForFunction(() => scrollY > 2);
        await page.keyboard.press('Control+Home');
        await page.waitForFunction(() => scrollY < 2);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      console.log(`PASS ${viewport.width}×${viewport.height}: rapid reversals, Home/End, visible chapters and responsive sizing at 4× CPU throttle`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
