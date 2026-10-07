import Link from "next/link";
import { Band } from "../_system/kit";
import { DirectionHero, DirectionTopics } from "../_system/direction-page";
import { SectionHead } from "../_system/ui";
import { ClosingScene } from "../_system/close";
import { V6_BASE } from "@/lib/v6-routes";
import { SYSTEM_INQUIRY_LABEL, SYSTEM_INQUIRY_PATH } from "@/lib/app-availability";
import { v6meta } from "../_system/meta";
export const metadata=v6meta({title:"Pricing",description:"Vraelis is in private development. Pricing for AI-security integrations will follow a defined scope and demonstrated workflow.",path:"/pricing"});
export default function Page(){return <div className="direction-page">
 <DirectionHero photo="networkEngineer" eyebrow="Pricing" title="A clear scope before a price." intro="Vraelis is in private development. AI-security plans and deployment pricing have not been published."/>
 <Band><SectionHead eyebrow="Commercial scope" title="Price the work the system needs." lead="A useful scope starts with the security boundary, integration environment and evidence required to evaluate the result."/><DirectionTopics items={[
 {label:"System",title:"The AI-enabled workflow",body:"Models, workloads, tools and operational resources involved in the security problem."},
 {label:"Integration",title:"The enforcement environment",body:"Identity, hosting, connectivity, approval and data-retention requirements."},
 {label:"Evaluation",title:"The outcome to establish",body:"Defined threat cases, authorization decisions and evidence the reviewers need to inspect."},
 ]}/></Band>
 <Band><SectionHead eyebrow="Availability" title="Product access remains closed." lead="The earlier browser-verification rates do not describe this AI-security direction. There is no self-service checkout or available deployment offer."/><Link href={`${V6_BASE}/platform`}>Read the product direction</Link></Band>
 <ClosingScene title="Discuss the system and its security boundary." action={{label:SYSTEM_INQUIRY_LABEL,href:`${V6_BASE}${SYSTEM_INQUIRY_PATH}`}}/>
 </div>}
