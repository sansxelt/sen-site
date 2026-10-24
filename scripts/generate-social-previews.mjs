// Share cards only: real brand assets and an unchanged capture of the recorded CPU experiment.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
const root = fileURLToPath(new URL('../', import.meta.url));
const asset = (file, type) => `data:${type};base64,${fs.readFileSync(path.join(root, file)).toString('base64')}`;
(async () => {
  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    const mark = asset('public/mark.svg', 'image/svg+xml');
    const base = `<style>*{box-sizing:border-box}body{margin:0;background:#0a0a0b;color:#f6f6f5;font-family:Arial,sans-serif}.card{width:1200px;height:630px;padding:48px 60px;display:flex;flex-direction:column}.brand{display:flex;align-items:center;gap:14px;font-size:30px}.brand img{width:36px;height:36px}h1{font-size:62px;line-height:1.1;letter-spacing:-2px;margin:35px 0 14px}p{font-size:28px;color:#c4c4c9;margin:0}.foot{margin-top:auto;display:flex;justify-content:space-between;font-size:22px;color:#c4c4c9}.capture{display:block;width:1080px;height:auto;margin:28px 0 0;border:1px solid #36363a;border-radius:14px}.topics{display:flex;gap:14px;margin-top:38px}.topics span{border:1px solid #4b4b50;border-radius:8px;padding:16px 22px;font-size:25px;color:#e3e3e8}</style>`;
    const brand = `<div class="brand"><img src="${mark}" alt="">Vraelis</div>`;
    const cards = [
      { name: 'vraelis-contour-v2.png', html: `${brand}<h1>Know which AI each machine runs.</h1><p>Vraelis Contour checks which AI each machine reports running against what was approved.</p><img class="capture" src="${asset('public/v8/contour/crop-pair-pending.webp', 'image/webp')}" alt="Approved cpu-2 beside reported loaded cpu-1"><div class="foot"><span>vraelis.com/contour</span><span>Private development · Recorded CPU experiment</span></div>` },
      { name: 'vraelis-docs-v1.png', html: `${brand}<h1>Vraelis documentation</h1><p>Model releases. Runtime evidence. Current scope.</p><div class="topics"><span>Release identity</span><span>Approval binding</span><span>Reported runtime</span></div><div class="foot"><span>docs.vraelis.com</span><span>Private development · Technical references</span></div>` },
    ];
    for (const card of cards) {
      await page.setContent(`${base}<main class="card">${card.html}</main>`);
      await page.evaluate(() => Promise.all([...document.images].map(i => i.decode())));
      await page.screenshot({ path: path.join(root, 'public/social', card.name) });
      console.log(card.name);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
