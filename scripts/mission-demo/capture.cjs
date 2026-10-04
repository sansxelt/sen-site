// Reproduce the browser interaction from vrf_51705517; this is a reenactment,
// not footage of the original session or a new verification-engine run.
// Run: node scripts/mission-demo/capture.cjs [fixture-url]
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const out = path.resolve('public/home');
const portrait = process.argv.includes('--portrait');
const suffix = portrait ? '-vertical' : '';
const width = portrait ? 720 : 1440;
const temp = '/tmp/vraelis-mission-demo';
fs.mkdirSync(temp, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width, height: 960 }, recordVideo: { dir: temp, size: { width, height: 960 } } });
  const page = await context.newPage();
  const url = process.argv[2] || 'http://localhost:3410/fixture.html';
  await page.goto(url);
  await page.getByRole('button', { name: 'Reset simulation', exact: true }).click();
  // A restrained film frame around the real, unchanged fixture interface.
  await page.evaluate(portrait => {
    const style = document.createElement('style');
    style.textContent = `#film-screen{transition:transform 1600ms cubic-bezier(.22,1,.36,1);transform-origin:20% 40%}body{padding:64px 40px 84px;overflow:hidden;background:#05090e} .top{border-radius:12px 12px 0 0}.wrap{height:calc(100vh - 228px);min-height:560px}footer{position:relative}#film-label{position:fixed;top:22px;left:40px;font:14px system-ui;color:#8eabc0;letter-spacing:.08em}#film-copy{position:fixed;bottom:24px;left:40px;right:40px;font:24px system-ui;color:#e8eef5;line-height:1.3}#film-pointer{position:fixed;width:18px;height:18px;border:2px solid #c1e3f7;border-radius:50%;box-shadow:0 0 28px #89b7e990;pointer-events:none;z-index:10;transition:transform 800ms cubic-bezier(.22,1,.36,1);transform:translate(${portrait?360:720}px,480px)}.row{transition:background .4s}.film-focus{outline:2px solid #eaaa68;outline-offset:3px;background:#251c16!important}`;
    if (portrait) style.textContent += `body{padding:64px 24px 104px;font-size:18px}.wrap{grid-template-columns:1fr 1fr;grid-template-rows:460px 210px;min-height:0;height:auto;gap:12px;padding:12px 0}.wrap>.card:nth-child(2){grid-column:1/-1;grid-row:2}.top{padding:0 14px}.meta{display:none}.sim{font-size:12px;max-width:420px;white-space:normal;text-align:right}.hd{font-size:13px;padding:9px 12px}.row{grid-template-columns:24px 1fr;gap:6px;padding:8px 8px}.row .eng{grid-column:2;font-size:17px}.who b{font-size:20px}.who small{font-size:16px}.rule{display:none}.map{min-height:0}.f strong{font-size:18px}.f span{font-size:13px}.fields{gap:6px;padding:10px}.f{padding:6px 8px}.act{font-size:17px!important;padding:10px!important}.actions{gap:6px;padding:0 10px 10px}.toast{font-size:12px}.log,.card>.hd[style]{display:none}.foot{display:none}footer{height:auto;font-size:12px;text-align:center;padding:8px 20px}#film-copy{left:24px;right:24px;bottom:24px;font-size:26px}#film-label{left:24px;font-size:13px}`;
    document.head.append(style);
    const screen = document.createElement('div'); screen.id='film-screen';
    for (const el of [...document.body.children]) screen.append(el);
    document.body.append(screen);
    for (const [id,text] of [['film-label','VRAELIS / LARKSPUR · SIMULATED MISSION CONSOLE'],['film-copy','One rule. Only the confirmed target may be cleared.'],['film-pointer','']]) {
      const el = document.createElement('div'); el.id=id; el.textContent=text; document.body.append(el);
    }
    window.scrollTo(0,0);
  }, portrait);
  const wait = ms => page.waitForTimeout(ms);
  const say = text => page.locator('#film-copy').evaluate((el,text)=>el.textContent=text,text);
  async function point(selector) {
    const box = await page.locator(selector).boundingBox();
    await page.locator('#film-pointer').evaluate((el,p)=>el.style.transform=`translate(${p.x-9}px,${p.y-9}px)`,{x:box.x+box.width/2,y:box.y+box.height/2});
    await wait(850);
  }
  await page.screenshot({path:path.join(out,`mission-demo-poster${suffix}.jpg`),type:'jpeg',quality:90});
  await wait(2400);
  await say('Read the contacts before changing anything.');
  await point('[data-id="T-3"]'); await wait(1100);
  await point('#confirm');
  await say('Confirm T-1. Then check what changed.');
  await wait(700); await page.locator('#confirm').click(); await wait(2100);
  await point('[data-id="T-3"]'); await page.locator('[data-id="T-3"]').click();
  await page.locator('[data-id="T-3"]').evaluate(el=>el.classList.add('film-focus'));
  await page.locator('#film-screen').evaluate((el,portrait)=>el.style.transform=portrait?'scale(1.03)':'scale(1.12)',portrait);
  await say('The civilian bus was cleared too.'); await wait(3400);
  await say('The recorded check caught it at step 8.'); await wait(2900);
  await say('The record keeps the screen, the step and a repair prompt.'); await wait(2700);
  await page.locator('[data-id="T-3"]').evaluate(el=>el.classList.remove('film-focus'));
  await page.locator('#film-screen').evaluate(el=>el.style.transform='none');
  await wait(1700);
  await point('button#reset');
  await page.locator('button#reset').click();
  await say('One rule. Only the confirmed target may be cleared.');
  await page.locator('#film-pointer').evaluate((el,width)=>el.style.transform=`translate(${width/2}px,480px)`,width); await wait(1800);
  const video=page.video(); await context.close(); const raw=await video.path(); await browser.close();
  execFileSync('ffmpeg',['-y','-ss','1','-i',raw,'-vf','fps=30,format=yuv420p','-an','-c:v','libx264','-preset','slow','-crf','24','-movflags','+faststart',path.join(out,`mission-demo${suffix}.mp4`)],{stdio:'inherit'});
})().catch(error=>{console.error(error);process.exit(1)});
