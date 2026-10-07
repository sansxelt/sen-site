import Link from "next/link";
import { FrameHero, Band, FeatureCard, FeatureGrid } from "./kit";
import { SectionHead } from "./ui";
import { ClosingScene } from "./close";
import { photographHero, type PhotographKey } from "../_content/photography";
import { V6_BASE } from "@/lib/v6-routes";
import { SecurityStatus } from "./security-status";
import "./direction-page.css";
export type DirectionContent = {
  eyebrow:string; title:string; intro:string; photo:PhotographKey;
  heading:string; lead:string; items:{title:string; body:string; label:string}[];
  showStatus?: boolean;
  nextTitle:string; nextLead:string; next:{title:string;body:string;label:string}[];
};
export function DirectionPage({content:c}:{content:DirectionContent}) {
  return <>
    <FrameHero compact eyebrow={c.eyebrow} title={c.title} sub={c.intro}
      primary={{label:"Contact",href:`${V6_BASE}/contact`}}
      secondary={{label:"Development status",href:`${V6_BASE}/beta`}} {...photographHero(c.photo)} />
    <Band><SectionHead eyebrow="The work" title={c.heading} lead={c.lead}/>
      <FeatureGrid span={4}>{c.items.map(i=><FeatureCard key={i.title} {...i}/>)}</FeatureGrid>
    </Band>
    {c.showStatus ? <Band><SecurityStatus /></Band> : null}
    <Band><SectionHead eyebrow="What comes next" title={c.nextTitle} lead={c.nextLead}/>
      <FeatureGrid span={4}>{c.next.map(i=><FeatureCard key={i.title} {...i}/>)}</FeatureGrid>
      <div className="direction-links"><Link href={`${V6_BASE}/problems`}>Security problems</Link><Link href={`${V6_BASE}/zero-trust`}>Zero trust</Link><Link href={`${V6_BASE}/goals`}>Our goals</Link></div>
    </Band>
    <ClosingScene title="Start with the system and its security problem." action={{label:"Contact",href:`${V6_BASE}/contact`}}/>
  </>;
}
