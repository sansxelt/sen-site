import Link from "next/link";
import { Band } from "./kit";
import { SectionHead } from "./ui";
import type { PhotographKey } from "../_content/photography";
import { TitleEntrance } from "./title-entrance";
import { V6_BASE } from "@/lib/v6-routes";
import { SecurityStatus } from "./security-status";
import "./direction-page.css";
export type DirectionContent = {
  eyebrow:string; title:string; intro:string; photo:PhotographKey;
  heading:string; lead:string; items:{title:string; body:string; label:string}[];
  showStatus?: boolean;
  nextTitle:string; nextLead:string; next:{title:string;body:string;label:string}[];
};
export function DirectionHero({eyebrow,title,intro}:{eyebrow:string;title:string;intro:string}) {
  return <header className="direction-hero v6-wrap">
    <p className="direction-hero__eyebrow">{eyebrow}</p>
    <h1><TitleEntrance>{title}</TitleEntrance></h1>
    <p className="direction-hero__intro">{intro}</p>
    <div className="direction-links"><Link href={`${V6_BASE}/contact`}>Contact</Link><Link href={`${V6_BASE}/beta`}>Development status</Link></div>
  </header>;
}
export function DirectionTopics({items}:{items:DirectionContent["items"]}) {
  return <div className="direction-topics">{items.map(i=><article key={i.title}>
    <p className="direction-topics__label">{i.label}</p>
    <div><h3>{i.title}</h3><p>{i.body}</p></div>
  </article>)}</div>;
}
export function DirectionPage({content:c}:{content:DirectionContent}) {
  return <div className="direction-page">
    <DirectionHero eyebrow={c.eyebrow} title={c.title} intro={c.intro}/>
    <Band><SectionHead eyebrow="The work" title={c.heading} lead={c.lead}/>
      <DirectionTopics items={c.items}/>
    </Band>
    {c.showStatus ? <Band><SecurityStatus /></Band> : null}
    <Band><SectionHead eyebrow="What comes next" title={c.nextTitle} lead={c.nextLead}/>
      <DirectionTopics items={c.next}/>
      <div className="direction-links"><Link href={`${V6_BASE}/contact`}>Contact</Link><Link href={`${V6_BASE}/problems`}>Security problems</Link><Link href={`${V6_BASE}/zero-trust`}>Zero trust</Link></div>
    </Band>
  </div>;
}
