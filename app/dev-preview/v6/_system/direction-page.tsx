import Link from "next/link";
import { FrameHero, Band, FeatureCard, FeatureGrid } from "./kit";
import { SectionHead } from "./ui";
import { ClosingScene } from "./close";
import { photographHero, type PhotographKey } from "../_content/photography";
import { V6_BASE } from "@/lib/v6-routes";
import { EvidenceModel } from "./evidence-model";
import type { Requirement } from "@/lib/recorded-verification/evaluate";
import "./direction-page.css";
export type DirectionContent = {
  eyebrow:string; title:string; intro:string; photo:PhotographKey;
  heading:string; lead:string; items:{title:string; body:string; label:string}[];
  recordingExample?: Requirement;
  references?:{title:string;body:string;href:string}[];
  nextTitle:string; nextLead:string; next:{title:string;body:string;label:string}[];
};
export function DirectionPage({content:c}:{content:DirectionContent}) {
  return <>
    <FrameHero compact eyebrow={c.eyebrow} title={c.title} sub={c.intro}
      primary={{label:"Talk to the team",href:`${V6_BASE}/contact`}}
      secondary={c.eyebrow === "The beta" ? {label:"Recording format docs",href:`${V6_BASE}/docs/recorded-reports`} : {label:"Explore the beta",href:`${V6_BASE}/beta`}} {...photographHero(c.photo)} />
    <Band><SectionHead eyebrow="The work" title={c.heading} lead={c.lead}/>
      <FeatureGrid span={4}>{c.items.map(i=><FeatureCard key={i.title} {...i}/>)}</FeatureGrid>
    </Band>
    <section className="direction-flow v6-wrap" aria-labelledby="direction-flow-title">
      <div><p className="direction-flow__eyebrow">Current recorded-report workflow</p><h2 id="direction-flow-title">One task. Every available report.</h2><p>Define the intended asset, completion window and assets that must stay unchanged. Compare the captured reports against that requirement, then inspect the source events.</p></div>
      <EvidenceModel requirement={c.recordingExample}/>
      <p className="direction-flow__boundary">Reports describe recorded state. They do not establish physical ground truth. Live device connections are not available.</p>
    </section>
    <Band><SectionHead eyebrow="What comes next" title={c.nextTitle} lead={c.nextLead}/>
      <FeatureGrid span={4}>{c.next.map(i=><FeatureCard key={i.title} {...i}/>)}</FeatureGrid>
      <div className="direction-links"><Link href={`${V6_BASE}/problems`}>The problems →</Link><Link href={`${V6_BASE}/goals`}>Our goals →</Link><Link href={`${V6_BASE}/docs/recorded-reports`}>Recording format docs →</Link></div>
    </Band>
    {c.references ? <Band><SectionHead eyebrow="Market context" title="The surrounding market already exists." lead="These companies cover adjacent work. Vraelis must prove that cross-source task review adds useful findings to an existing engineering process."/><div className="direction-references">{c.references.map(ref=><a key={ref.title} href={ref.href} target="_blank" rel="noopener noreferrer"><h3>{ref.title} ↗</h3><p>{ref.body}</p><span>Read the official product page</span></a>)}</div></Band> : null}
    <ClosingScene title="Bring a problem worth solving." action={{label:"Talk to the team",href:`${V6_BASE}/contact`}}/>
  </>;
}
