// Film a browser reenactment of vrf_51705517 against the actual fixture code.
// This never calls or impersonates the verification engine.
const { chromium } = require('playwright');
const fs = require('node:fs'); const path = require('node:path'); const { execFileSync } = require('node:child_process');
const portrait = process.argv.includes('--portrait');
const W=portrait?720:1440,H=portrait?960:900;
const suffix=portrait?'-vertical':'';
const output=path.resolve('public/home');const temp='/tmp/vraelis-mission-cut';fs.mkdirSync(temp,{recursive:true});
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await b.newContext({viewport:{width:W,height:H},recordVideo:{dir:temp,size:{width:W,height:H}}});
 const page=await context.newPage();
 await page.goto(process.argv[2]||'http://localhost:3410/fixture.html');
 await page.getByRole('button',{name:'Reset simulation',exact:true}).click();
 await page.evaluate(({portrait,W,H})=>{
  const css=document.createElement('style');
  css.textContent=`body{padding:52px 28px 80px;background:#111518;overflow:hidden}.top{height:50px;padding:0 20px}.wrap{height:${H-226}px;min-height:0;grid-template-rows:280px minmax(0,1fr);grid-template-columns:minmax(0,1fr) 340px}.rule{display:none}.row{padding:6px 8px}.hd{padding:12px 20px}footer{height:30px;font-size:10px}.film-frame{transition:transform 1400ms cubic-bezier(.22,1,.36,1);transform-origin:85% 40%}#film-copy{position:fixed;bottom:22px;left:28px;right:28px;font:26px/1.2 system-ui;color:#f2f1ed}#film-label{position:fixed;top:19px;left:28px;font:12px system-ui;letter-spacing:.03em;color:#9da6aa}#film-cursor{position:fixed;top:0;left:0;z-index:5;pointer-events:none;transform:translate(${W/2}px,${H/2}px);transition:transform 850ms cubic-bezier(.22,1,.36,1)}.film-focus{background:#30302a!important;box-shadow:inset 3px 0 #e8e4c7!important}.card,.map,.top{border-radius:0}`;
  if(portrait)css.textContent+=`.wrap{grid-template-columns:1fr;grid-template-rows:248px 280px 190px;height:718px;gap:0}.wrap>.card:nth-child(2){grid-column:1;grid-row:1}.wrap>.card:first-child{grid-column:1;grid-row:2;border:0;border-top:1px solid #343b40}.wrap>.card:nth-child(3){grid-column:1;grid-row:3;border:0;border-top:1px solid #343b40;overflow:hidden}.top{padding:0 14px}.hd{padding:10px 14px}.row{padding:6px 8px;grid-template-columns:24px 1fr 190px}.who b{font-size:17px}.who small{font-size:15px}.eng{font-size:15px}.meta,.foot,.log,.card>.hd[style],.toast{display:none}.fields{grid-template-columns:1fr 1fr;padding:10px 14px;gap:10px}.f.wide{grid-column:auto}.f:nth-child(1),.f:nth-child(2),.f:nth-child(4){display:none}.f strong{font-size:20px}.f span{font-size:13px}.actions{display:flex;padding:8px 14px;gap:8px}.actions button{flex:1;padding:12px 8px;font-size:15px}#film-copy{font-size:26px;bottom:20px}.sim{max-width:65%;font-size:11px}.film-frame{transform-origin:50% 50%}footer{padding:8px 12px;font-size:11px;height:36px}`;
  document.head.append(css);
  const frame=document.createElement('div');frame.className='film-frame';for(const el of [...document.body.children])frame.append(el);document.body.append(frame);
  for(const [id,text] of [['film-label','LARKSPUR / BROWSER REENACTMENT'],['film-copy','Only T-1 may be cleared.'],['film-cursor','']]){const el=document.createElement('div');el.id=id;el.textContent=text;document.body.append(el);}
  document.querySelector('#film-cursor').innerHTML='<svg width="22" height="28" viewBox="0 0 22 28"><path d="M2 2v21l5-5 4 8 4-2-4-8h8z" fill="#fff" stroke="#111" stroke-width="1.4"/></svg>';
  window.scrollTo(0,0);
 },{portrait,W,H});
 const wait=ms=>page.waitForTimeout(ms);const say=text=>page.locator('#film-copy').evaluate((el,text)=>{el.textContent=text;el.animate([{transform:'translateY(12px)'},{transform:'translateY(0)'}],{duration:450,easing:'cubic-bezier(.22,1,.36,1)'});},text);
 async function point(selector){const box=await page.locator(selector).boundingBox();await page.locator('#film-cursor').evaluate((el,p)=>el.style.transform=`translate(${p.x}px,${p.y}px)`,{x:box.x+box.width*.6,y:box.y+box.height*.5});await wait(900);}
 await page.screenshot({path:path.join(output,`check-film-poster${suffix}.jpg`),type:'jpeg',quality:94});await wait(1800);
 await point('#confirm');await say('Confirm the target.');await wait(800);await page.locator('#confirm').click();await wait(1800);
 await point('[data-id="T-3"]');await page.locator('[data-id="T-3"]').click();await page.locator('[data-id="T-3"]').evaluate(el=>el.classList.add('film-focus'));
 if(!portrait)await page.locator('.film-frame').evaluate(el=>el.style.transform='scale(1.13)');
 await say('The civilian contact changed too.');await wait(3400);
 await say('Vraelis caught this at step 8.');await wait(3000);
 await page.locator('.film-frame').evaluate(el=>el.style.transform='none');await wait(1500);
 await page.locator('[data-id="T-3"]').evaluate(el=>el.classList.remove('film-focus'));await point('#reset');await page.locator('#reset').click();await say('Only T-1 may be cleared.');
 await page.locator('#film-cursor').evaluate((el,p)=>el.style.transform=`translate(${p.W/2}px,${p.H/2}px)`,{W,H});await wait(1600);
 const video=page.video();await context.close();const raw=await video.path();await b.close();
 execFileSync('ffmpeg',['-y','-v','error','-ss','1','-i',raw,'-an','-vf','fps=30,format=yuv420p','-c:v','libx264','-preset','slow','-crf','21','-movflags','+faststart',path.join(output,`check-film${suffix}.mp4`)],{stdio:'inherit'});
})().catch(e=>{console.error(e);process.exit(1)});
