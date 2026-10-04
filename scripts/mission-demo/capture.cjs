// Reproduce the browser interaction from vrf_51705517; this is a reenactment,
// not footage of the original session or a new verification-engine run.
// Run: node scripts/mission-demo/capture.cjs [fixture-url]
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const out = path.resolve('public/home');
const temp = '/tmp/vraelis-mission-demo';
fs.mkdirSync(temp, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, recordVideo: { dir: temp, size: { width: 1440, height: 960 } } });
  const page = await context.newPage();
  const url = process.argv[2] || 'http://localhost:3410/fixture.html';
  await page.goto(url);
  await page.getByRole('button', { name: 'Reset simulation', exact: true }).click();
  // A restrained film frame around the real, unchanged fixture interface.
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = `#film-screen{transition:transform 1600ms cubic-bezier(.22,1,.36,1);transform-origin:20% 40%}body{padding:64px 40px 84px;overflow:hidden;background:#05090e} .top{border-radius:12px 12px 0 0}.wrap{height:calc(100vh - 228px);min-height:560px}footer{position:relative}#film-label{position:fixed;top:22px;left:40px;font:14px system-ui;color:#8eabc0;letter-spacing:.08em}#film-copy{position:fixed;bottom:24px;left:40px;right:40px;font:24px system-ui;color:#e8eef5;line-height:1.3}#film-pointer{position:fixed;width:18px;height:18px;border:2px solid #c1e3f7;border-radius:50%;box-shadow:0 0 28px #89b7e990;pointer-events:none;z-index:10;transition:transform 800ms cubic-bezier(.22,1,.36,1);transform:translate(720px,480px)}.row{transition:background .4s}.film-focus{outline:2px solid #eaaa68;outline-offset:3px;background:#251c16!important}`;
    document.head.append(style);
    const screen = document.createElement('div'); screen.id='film-screen';
    for (const el of [...document.body.children]) screen.append(el);
    document.body.append(screen);
    for (const [id,text] of [['film-label','VRAELIS / LARKSPUR · SIMULATED MISSION CONSOLE'],['film-copy','One rule. Only the confirmed target may be cleared.'],['film-pointer','']]) {
      const el = document.createElement('div'); el.id=id; el.textContent=text; document.body.append(el);
    }
  });
  const wait = ms => page.waitForTimeout(ms);
  const say = text => page.locator('#film-copy').evaluate((el,text)=>el.textContent=text,text);
  async function point(selector) {
    const box = await page.locator(selector).boundingBox();
    await page.locator('#film-pointer').evaluate((el,p)=>el.style.transform=`translate(${p.x-9}px,${p.y-9}px)`,{x:box.x+box.width/2,y:box.y+box.height/2});
    await wait(850);
  }
  await page.screenshot({path:path.join(out,'mission-demo-poster.jpg'),type:'jpeg',quality:90});
  await wait(2400);
  await say('Read the contacts before changing anything.');
  await point('[data-id="T-3"]'); await wait(1100);
  await point('#confirm');
  await say('Confirm T-1. Then check what changed.');
  await wait(700); await page.locator('#confirm').click(); await wait(2100);
  await point('[data-id="T-3"]'); await page.locator('[data-id="T-3"]').click();
  await page.locator('[data-id="T-3"]').evaluate(el=>el.classList.add('film-focus'));
  await page.locator('#film-screen').evaluate(el=>el.style.transform='scale(1.12)');
  await say('The civilian bus was cleared too.'); await wait(3400);
  await say('The recorded check caught it at step 8.'); await wait(2900);
  await say('The record keeps the screen, the step and a repair prompt.'); await wait(2700);
  await page.locator('[data-id="T-3"]').evaluate(el=>el.classList.remove('film-focus'));
  await page.locator('#film-screen').evaluate(el=>el.style.transform='none');
  await wait(1700);
  await point('button#reset');
  await page.locator('button#reset').click();
  await say('One rule. Only the confirmed target may be cleared.');
  await page.locator('#film-pointer').evaluate(el=>el.style.transform='translate(720px,480px)'); await wait(1800);
  const video=page.video(); await context.close(); const raw=await video.path(); await browser.close();
  execFileSync('ffmpeg',['-y','-ss','1','-i',raw,'-vf','fps=30,format=yuv420p','-an','-c:v','libx264','-preset','slow','-crf','24','-movflags','+faststart',path.join(out,'mission-demo.mp4')],{stdio:'inherit'});
})().catch(error=>{console.error(error);process.exit(1)});
