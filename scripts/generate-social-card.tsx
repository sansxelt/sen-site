// Deterministic website card from existing licensed photography, not generated product imagery.
// Run: npx tsx scripts/generate-social-card.tsx
// Bump SOCIAL_IMAGE's filename when changing this artwork; shared-link caches retain old URLs.
import React from "react";
import { readFile, writeFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import { SOCIAL_IMAGE, SOCIAL_IMAGE_WIDTH, SOCIAL_IMAGE_HEIGHT } from "../lib/social-card";
import { HEADLINE } from "../app/dev-preview/v6/_system/positioning";

async function main() {
  const [photo,font]=await Promise.all([
    readFile("public/site/photography/robot-arm.jpg"),
    readFile("app/fonts/manrope/Manrope-Social-Regular.ttf"),
  ]);
  const response=new ImageResponse(
    <div style={{display:"flex",width:"100%",height:"100%",background:"#0a0a0b",color:"white",fontFamily:"Manrope",position:"relative"}}>
      {/* The photograph illustrates the application area, never a Vraelis installation. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`data:image/jpeg;base64,${photo.toString("base64")}`} alt="" width={730} height={630} style={{position:"absolute",right:0,top:0,objectFit:"cover"}}/>
      <div style={{display:"flex",position:"absolute",left:0,top:0,width:1200,height:630,background:"linear-gradient(90deg, #0a0a0b 0%, #0a0a0b 30%, rgba(10,10,11,0.92) 43%, rgba(10,10,11,0.12) 74%, rgba(10,10,11,0.04) 100%)"}}/>
      <div style={{display:"flex",position:"absolute",left:64,top:54,fontSize:34,fontWeight:400,letterSpacing:-1}}>Vraelis</div>
      <div style={{display:"flex",position:"absolute",left:64,top:205,width:600,fontSize:68,lineHeight:1.1,fontWeight:400,letterSpacing:-2.5}}>{HEADLINE}</div>
      <div style={{display:"flex",position:"absolute",left:64,bottom:48,fontSize:21,color:"#c4c4c4"}}>vraelis.com</div>
      <div style={{display:"flex",position:"absolute",right:48,bottom:48,fontSize:19,color:"white",background:"rgba(10,10,11,.75)",padding:"10px 16px",borderRadius:6}}>In private development</div>
    </div>,
    {width:SOCIAL_IMAGE_WIDTH,height:SOCIAL_IMAGE_HEIGHT,fonts:[{name:"Manrope",data:font,weight:400,style:"normal"}]},
  );
  const path=`public${new URL(SOCIAL_IMAGE).pathname}`;
  const png=Buffer.from(await response.arrayBuffer());
  await writeFile(path,png);
  console.log(`${path}: ${SOCIAL_IMAGE_WIDTH}×${SOCIAL_IMAGE_HEIGHT}, ${png.length} bytes`);
}
void main();
