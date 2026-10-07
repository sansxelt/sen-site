import Link from "next/link";
import { FrameHero, Band, FeatureGrid, FeatureCard } from "../_system/kit";
import { SectionHead } from "../_system/ui";
import { ClosingScene } from "../_system/close";
import { photographHero } from "../_content/photography";
import { V6_BASE } from "@/lib/v6-routes";
import { v6meta } from "../_system/meta";
export const metadata=v6meta({title:"Pricing",description:"Vraelis is in private development. Pricing for AI-security integrations will follow a defined scope and demonstrated workflow.",path:"/pricing"});
export default function Page(){return <>
 <FrameHero compact eyebrow="Pricing" title="A clear scope before a price." sub="Vraelis is in private development. AI-security plans and deployment pricing have not been published." primary={{label:"Contact",href:`${V6_BASE}/contact?topic=sales`}} secondary={{label:"Development status",href:`${V6_BASE}/beta`}} {...photographHero("networkEngineer")}/>
 <Band><SectionHead eyebrow="Commercial scope" title="Price the work the system needs." lead="A useful scope starts with the security boundary, integration environment and evidence required to evaluate the result."/><FeatureGrid>
 <FeatureCard label="01 / System" title="The AI-enabled workflow" body="Models, workloads, tools and operational resources involved in the security problem."/>
 <FeatureCard label="02 / Integration" title="The enforcement environment" body="Identity, hosting, connectivity, approval and data-retention requirements."/>
 <FeatureCard label="03 / Evaluation" title="The outcome to establish" body="Defined threat cases, authorization decisions and evidence the reviewers need to inspect."/>
 </FeatureGrid></Band>
 <Band><SectionHead eyebrow="Availability" title="Product access remains closed." lead="The earlier browser-verification rates do not describe this AI-security direction. There is no self-service checkout or available deployment offer."/><Link href={`${V6_BASE}/platform`}>Read the product direction</Link></Band>
 <ClosingScene title="Discuss the system and its security boundary." action={{label:"Contact",href:`${V6_BASE}/contact?topic=sales`}}/>
 </>}
