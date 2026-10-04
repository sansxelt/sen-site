// Capture the actual simulated fixture. This is a reenactment, not a verification-engine run.
const {chromium}=require('playwright');
const path=require('node:path');const {spawn}=require('node:child_process');const {once}=require('node:events');
const portrait=process.argv.includes('--portrait');const W=portrait?720:1440,H=portrait?960:900,suffix=portrait?'-vertical':'';
const output=path.resolve('public/home');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:W,height:H}});const page=await context.newPage();
 const url=new URL(process.argv[2]||'http://localhost:3100/api/fixtures/strike?mode=broken');url.searchParams.set('capture','1');await page.goto(url.href);await page.waitForFunction(()=>window.LARKSPUR_SCENE?.renderFrame);
 await page.getByRole('button',{name:'Reset simulation',exact:true}).click();
 // Fit the same controls to the film frame without replacing any data or behavior.
 await page.addStyleTag({content:portrait?`.top{height:48px;padding:0 20px}.wrap{height:912px;grid-template-rows:480px 432px;grid-template-columns:1fr 1fr;min-height:0}.wrap>.card:nth-child(2){grid-column:1/3;grid-row:1}.wrap>.card:first-child{grid-column:1;grid-row:2;border-right:1px solid #343a36}.wrap>.card:nth-child(3){grid-column:2;grid-row:2;border-top:0;overflow:hidden}.map-toolbar{height:54px}.hd{padding:14px 16px 10px}.row{grid-template-columns:1fr;padding:6px 8px;gap:2px}.who b{font-size:20px}.who small{font-size:18px}.eng{font-size:16px}.object-label{font-size:18px}.fields{padding:12px 16px;gap:12px}.f strong{font-size:20px}.f span{font-size:15px}.actions{padding:0 16px 12px;gap:6px}.act{padding:10px 8px;font-size:16px}.rule,.history,.toast{display:none}.f:nth-child(1),.f:nth-child(2){display:none}.f.wide{grid-column:1/3}.fields .f:last-child{grid-column:1/3}.sim{font-size:12px}`:'.wrap{min-height:0}'});
 await page.evaluate(()=>{const cursor=document.createElement('div');cursor.id='film-cursor';cursor.style.cssText='position:fixed;left:0;top:0;z-index:30;pointer-events:none;transform:translate(-50px,-50px)';cursor.innerHTML='<svg width="20" height="26" viewBox="0 0 22 28"><path d="M2 2v21l5-5 4 8 4-2-4-8h8z" fill="#fff" stroke="#162019" stroke-width="1.4"/></svg>';document.body.append(cursor);});
 await page.evaluate(()=>window.scrollTo(0,0));
 const events=[{at:2,selector:'#view-2d'},{at:4.5,selector:'#view-3d'},{at:7,selector:'#confirm'},{at:10,selector:'[data-id="T-3"]'},{at:15,selector:'#reset'}];
 for(const event of events){const box=await page.locator(event.selector).boundingBox();event.x=box.x+box.width*.55;event.y=box.y+box.height*.5;}
 // Capture fixed scene times. Software render speed never stretches the film or duplicates motion frames.
 const encoder=spawn('ffmpeg',['-y','-v','error','-f','image2pipe','-framerate','60','-i','pipe:0','-an','-vf','format=yuv420p','-c:v','libx264','-threads','2','-preset','slow','-crf','23','-movflags','+faststart',path.join(output,`spatial-check-terrain${suffix}.mp4`)],{stdio:['pipe','inherit','inherit']});
 const encoded=once(encoder,'close');let prior={x:-50,y:-50},next=0;
 for(let frame=0;frame<18*60;frame++){
  const t=frame/60,event=events[next];let position=prior;
  if(event){const progress=Math.max(0,Math.min(1,(t-(event.at-.75))/.75)),ease=1-Math.pow(1-progress,3);position={x:prior.x+(event.x-prior.x)*ease,y:prior.y+(event.y-prior.y)*ease};
   if(t>=event.at){await page.locator(event.selector).evaluate(el=>el.click());prior={x:event.x,y:event.y};next++;position=prior;}}
  await page.evaluate(({t,position})=>{document.getElementById('film-cursor').style.transform=`translate(${position.x}px,${position.y}px)`;window.LARKSPUR_SCENE.renderFrame(t);},{t,position});
  if(frame===0)await page.screenshot({path:path.join(output,`spatial-check-terrain-poster${suffix}.jpg`),type:'jpeg',quality:94});
  const buffer=await page.screenshot({type:'jpeg',quality:94});
  if(!encoder.stdin.write(buffer))await once(encoder.stdin,'drain');
  if(frame%180===0)console.log(`${portrait?'Portrait':'Desktop'}: ${frame}/1080 frames`);
 }
 encoder.stdin.end();const [code]=await encoded;if(code!==0)throw new Error(`FFmpeg exited ${code}`);
 await context.close();await browser.close();
 console.log(`${portrait?'Portrait':'Desktop'}: 18 seconds, 1080 individually rendered frames, 60 FPS`);
})().catch(e=>{console.error(e);process.exit(1)});
