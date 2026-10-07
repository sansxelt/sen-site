import Link from "next/link";
import { ApplicationAreaLinks } from "../_system/homepage-sections";
import { IndexHero, Band } from "../_system/kit";
import { SectionHead } from "../_system/ui";
import { ClosingScene } from "../_system/close";
import { V6_BASE } from "@/lib/v6-routes";
import { v6meta } from "../_system/meta";
import "../_system/homepage-sections.css";
import "../_system/direction-page.css";
export const metadata=v6meta({title:"Application areas",description:"Developing AI security for defense, infrastructure and robotics. Workload authority, model integrity and evidence around operational boundaries.",path:"/solutions"});
const organizations = [
 {title:"Government and institutions",body:"Mission systems, public infrastructure and institutional security requirements.",href:"/government"},
 {title:"System integrators",body:"Trust boundaries across software, model and equipment suppliers.",href:"/integrators"},
 {title:"Enterprise",body:"Authority, integrity and evidence for AI-enabled operations.",href:"/enterprise"},
];
export default function Page(){return <div className="direction-page">
 <IndexHero eyebrow="Application areas" title="AI security for operational systems." lead="Defense, infrastructure and robotics share a security question: what may an AI workload access or change, and what evidence supports that authority?"/>
 <Band><ApplicationAreaLinks/></Band>
 <Band><SectionHead eyebrow="Organizations" title="The environment shapes the integration." lead="These are intended audiences, not a customer roster or completed deployments."/>
 <div className="home-areas__list">{organizations.map(o=><Link key={o.title} href={`${V6_BASE}${o.href}`} className="direction-area"><h3>{o.title}</h3><p>{o.body}</p></Link>)}</div>
 </Band><ClosingScene/></div>}
