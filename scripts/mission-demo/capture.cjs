// Capture the actual simulated fixture. This is a reenactment, not a verification-engine run.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');const {execFileSync}=require('node:child_process');
const portrait=process.argv.includes('--portrait');const W=portrait?720:1440,H=portrait?960:900,suffix=portrait?'-vertical':'';
const output=path.resolve('public/home'),temp='/tmp/vraelis-spatial-cut';fs.mkdirSync(temp,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:W,height:H},recordVideo:{dir:temp,size:{width:W,height:H}}});const captureStarted=Date.now();const page=await context.newPage();
 await page.goto(process.argv[2]||'http://localhost:3100/api/fixtures/strike?mode=broken');await page.waitForFunction(()=>window.LARKSPUR_SCENE);
 await page.getByRole('button',{name:'Reset simulation',exact:true}).click();
 // Fit the same controls to the film frame without replacing any data or behavior.
 await page.addStyleTag({content:portrait?`.top{height:48px;padding:0 20px}.wrap{height:912px;grid-template-rows:480px 432px;grid-template-columns:1fr 1fr;min-height:0}.wrap>.card:nth-child(2){grid-column:1/3;grid-row:1}.wrap>.card:first-child{grid-column:1;grid-row:2;border-right:1px solid #343a36}.wrap>.card:nth-child(3){grid-column:2;grid-row:2;border-top:0;overflow:hidden}.map-toolbar{height:54px}.hd{padding:14px 16px 10px}.row{grid-template-columns:1fr;padding:6px 8px;gap:2px}.who b{font-size:20px}.who small{font-size:18px}.eng{font-size:16px}.object-label{font-size:18px}.fields{padding:12px 16px;gap:12px}.f strong{font-size:20px}.f span{font-size:15px}.actions{padding:0 16px 12px;gap:6px}.act{padding:10px 8px;font-size:16px}.rule,.history,.toast{display:none}.f:nth-child(1),.f:nth-child(2){display:none}.f.wide{grid-column:1/3}.fields .f:last-child{grid-column:1/3}.sim{font-size:12px}`:'.wrap{min-height:0}'});
 await page.evaluate(()=>{const cursor=document.createElement('div');cursor.id='film-cursor';cursor.style.cssText='position:fixed;left:0;top:0;z-index:30;pointer-events:none;transition:transform 650ms cubic-bezier(.22,1,.36,1);transform:translate(-50px,-50px)';cursor.innerHTML='<svg width="20" height="26" viewBox="0 0 22 28"><path d="M2 2v21l5-5 4 8 4-2-4-8h8z" fill="#fff" stroke="#162019" stroke-width="1.4"/></svg>';document.body.append(cursor);});
 const wait=ms=>page.waitForTimeout(ms);
 async function click(selector){const box=await page.locator(selector).boundingBox();await page.locator('#film-cursor').evaluate((el,p)=>el.style.transform=`translate(${p.x}px,${p.y}px)`,{x:box.x+box.width*.55,y:box.y+box.height*.5});await wait(750);await page.locator(selector).click();}
 await page.evaluate(()=>window.scrollTo(0,0));await wait(150);const editStart=(Date.now()-captureStarted)/1000;await wait(550);await page.screenshot({path:path.join(output,`spatial-check-poster${suffix}.jpg`),type:'jpeg',quality:94});await wait(1500);
 await click('#view-2d');await wait(1700);await click('#view-3d');await wait(1700);
 await click('#confirm');await wait(2000);await click('[data-id="T-3"]');await wait(3500);
 await click('#reset');await wait(1500);
 const video=page.video();await context.close();const raw=await video.path();await browser.close();
 execFileSync('ffmpeg',['-y','-v','error','-ss',String(editStart),'-i',raw,'-an','-vf','fps=30,format=yuv420p','-c:v','libx264','-preset','slow','-crf','23','-movflags','+faststart',path.join(output,`spatial-check${suffix}.mp4`)],{stdio:'inherit'});
})().catch(e=>{console.error(e);process.exit(1)});
