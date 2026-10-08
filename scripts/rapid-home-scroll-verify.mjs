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
      // No letters may appear before the incoming surface reaches its resting position.
      if (viewport.height >= (viewport.width > 900 ? 620 : 660)) {
        for (const progress of [.36, .42, .49, .54, .58, .60, .72, .92, .72, .54, .49, .36]) {
          await page.evaluate(progress => {
            const root = document.querySelector('.home-sequence');
            const opening = root.querySelector('.v6-opening');
            const stage = root.querySelector('.home-sequence__stage');
            const sequenced = root.hasAttribute('data-sequenced');
            const pin = opening.querySelector('.v6-opening__pin');
            const track = sequenced ? root.offsetHeight - stage.clientHeight * 3.1 : opening.offsetHeight - pin.offsetHeight;
            const readingTravel = sequenced ? (root.offsetHeight - stage.clientHeight * 2.1) / 3.1 : opening.offsetHeight / (innerWidth <= 560 ? 2.9 : 3.1);
            const originalTravel = track - readingTravel;
            const readingStart = originalTravel * .60;
            const distance = progress <= .60 ? progress * originalTravel : readingStart + (progress - .60) / .40 * (track - readingStart);
            const start = sequenced ? root.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(stage).top) : opening.getBoundingClientRect().top + scrollY;
            scrollTo(0, start + distance);
          }, progress);
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const surface = await page.locator('.v6-opening__statement').evaluate(el => {
            const style = getComputedStyle(el);
            const pin = el.parentElement.getBoundingClientRect();
            const text = el.querySelector('.v6-stm__t');
            return { opacity: style.opacity, background: style.backgroundColor, clip: style.clipPath,
              y: el.getBoundingClientRect().top - pin.top, textOpacity: Number(getComputedStyle(text).opacity),
              lit: text.querySelectorAll('[data-on="true"]').length,
              words: text.querySelectorAll('[data-on]').length };
          });
          assert.equal(surface.opacity, '1', 'The statement must stay opaque throughout the handoff');
          assert.match(surface.background, /^rgb\(\d+, \d+, \d+\)$/, 'Visible text needs an opaque background, not the film');
          assert.equal(surface.clip, 'none', 'The handoff must not cut through the paragraph');
          if (progress < .50) {
            assert.ok(surface.y > 0, 'The background must still be entering');
            assert.equal(surface.textOpacity, 0, 'No text may appear while the background is entering');
          }
          if (surface.textOpacity > 0) assert.ok(Math.abs(surface.y) < 1, 'Visible text must be on the settled section');
          if (progress <= .60) assert.equal(surface.lit, 0, 'Word highlighting must wait until the section and paragraph settle');
          if (progress > .90) assert.equal(surface.lit, surface.words, 'The complete sentence must become readable before the next chapter');
        }
        // One ordinary wheel gesture must reveal a few words rather than the whole sentence.
        const reveal = await page.evaluate(() => {
          const root = document.querySelector('.home-sequence'), opening = root.querySelector('.v6-opening');
          const stage = root.querySelector('.home-sequence__stage'), pin = opening.querySelector('.v6-opening__pin');
          const sequenced = root.hasAttribute('data-sequenced');
          const track = sequenced ? root.offsetHeight - stage.clientHeight * 3.1 : opening.offsetHeight - pin.offsetHeight;
          const extra = sequenced ? (root.offsetHeight - stage.clientHeight * 2.1) / 3.1 : opening.offsetHeight / (innerWidth <= 560 ? 2.9 : 3.1);
          const start = sequenced ? root.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(stage).top) : opening.getBoundingClientRect().top + scrollY;
          const readingStart = (track - extra) * .60;
          scrollTo(0, start + readingStart);
          return { revealDistance:(track - readingStart) * .75, viewport:innerHeight };
        });
        assert.ok(reveal.revealDistance >= reveal.viewport * .85, 'The statement needs almost a full viewport of reading travel');
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.mouse.wheel(0, 240);
        await page.waitForTimeout(350);
        const words = await page.locator('.v6-stm__t').evaluate(el => ({lit:el.querySelectorAll('[data-on="true"]').length,total:el.querySelectorAll('[data-on]').length}));
        assert.ok(words.lit > 0 && words.lit <= Math.ceil(words.total * .4), 'A wheel gesture should reveal only part of the statement');
        console.log(`PASS reading pace: ${Math.round(reveal.revealDistance)}px; one gesture reveals ${words.lit}/${words.total} words`);
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
        // One ordinary wheel gesture must reveal a few words rather than the whole sentence.
        const reveal = await page.evaluate(() => {
          const root = document.querySelector('.home-sequence'), opening = root.querySelector('.v6-opening');
          const stage = root.querySelector('.home-sequence__stage'), pin = opening.querySelector('.v6-opening__pin');
          const sequenced = root.hasAttribute('data-sequenced');
          const track = sequenced ? root.offsetHeight - stage.clientHeight * 3.1 : opening.offsetHeight - pin.offsetHeight;
          const extra = sequenced ? (root.offsetHeight - stage.clientHeight * 2.1) / 3.1 : opening.offsetHeight / (innerWidth <= 560 ? 2.9 : 3.1);
          const start = sequenced ? root.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(stage).top) : opening.getBoundingClientRect().top + scrollY;
          const readingStart = (track - extra) * .60;
          scrollTo(0, start + readingStart);
          return { revealDistance:(track - readingStart) * .75, viewport:innerHeight };
        });
        assert.ok(reveal.revealDistance >= reveal.viewport * .85, 'The statement needs almost a full viewport of reading travel');
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.mouse.wheel(0, 240);
        await page.waitForTimeout(350);
        const words = await page.locator('.v6-stm__t').evaluate(el => ({lit:el.querySelectorAll('[data-on="true"]').length,total:el.querySelectorAll('[data-on]').length}));
        assert.ok(words.lit > 0 && words.lit <= Math.ceil(words.total * .4), 'A wheel gesture should reveal only part of the statement');
        console.log(`PASS reading pace: ${Math.round(reveal.revealDistance)}px; one gesture reveals ${words.lit}/${words.total} words`);
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
