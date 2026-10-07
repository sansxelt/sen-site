import Image from "next/image";
import Link from "next/link";
import { IndexHero, Band, FeatureGrid, FeatureCard } from "../_system/kit";
import { SectionHead } from "../_system/ui";
import { ClosingScene } from "../_system/close";
import { PRIMARY_SECTORS } from "../_content/sectors";
import { V6_BASE } from "@/lib/v6-routes";
import { v6meta } from "../_system/meta";
import "../_system/homepage-sections.css";
export const metadata=v6meta({title:"Application areas",description:"Developing AI security for defense, infrastructure and robotics. Workload authority, model integrity and evidence around operational boundaries.",path:"/solutions"});
export default function Page(){return <>
 <IndexHero eyebrow="Application areas" title="AI security for operational systems." lead="Defense, infrastructure and robotics share a security question: what may an AI workload access or change, and what evidence supports that authority?"/>
 <Band><div className="home-engineering__links">{PRIMARY_SECTORS.map(s=><Link key={s.slug} href={s.href} className="home-resource"><div className="home-resource__image"><Image src={s.pics.card1610} alt={`Illustrative photography for ${s.label}.`} width={2400} height={1800} sizes="(max-width:760px) 100vw,45vw"/></div><div><h2>{s.label}</h2><p>{s.line}</p></div></Link>)}</div></Band>
 <Band><SectionHead eyebrow="Organizations" title="The environment shapes the integration." lead="These are intended audiences, not a customer roster or completed deployments."/><FeatureGrid>
 <FeatureCard title="Government and institutions" body="Mission systems, public infrastructure and institutional security requirements." href={`${V6_BASE}/government`}/>
 <FeatureCard title="System integrators" body="Trust boundaries across software, model and equipment suppliers." href={`${V6_BASE}/integrators`}/>
 <FeatureCard title="Enterprise" body="Authority, integrity and evidence for AI-enabled operations." href={`${V6_BASE}/enterprise`}/>
 </FeatureGrid></Band><ClosingScene/></>}
