import { Band, FeatureCard, FeatureGrid, FrameHero } from "../../_system/kit";
import { SectionHead } from "../../_system/ui";
import { Code, CopyScript } from "../../_system/code";
import { ClosingScene } from "../../_system/close";
import { photographHero } from "../../_content/photography";
import { v6meta } from "../../_system/meta";
import { V6_BASE } from "@/lib/v6-routes";

export const metadata = v6meta({ title:"Verification API", description:"Submit a browser-verification requirement from your software, review the plan, and read the resulting evidence.", path:"/developers/api" });

const request = `curl -X POST https://vraelis.com/api/v1/verifications \\
  -H "x-api-key: $VRAELIS_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{
    "deployment_url": "https://staging.example.com",
    "claim": "Only the intended test asset changes when the operator confirms a task."
  }'`;
const response = `{
  "state": "review_required",
  "reviewed_plan_id": "rvp_example",
  "approve_url": "https://app.vraelis.com/review/rvp_example",
  "human_reviewed": false
}`;

export default function Page() {
  return <>
    <FrameHero compact eyebrow="Verification API" title="Put the check inside your workflow."
      sub="Submit a deployment address and the behavior you want checked. A person reviews the plan before the browser workflow runs."
      primary={{label:"Create an API key",href:"https://app.vraelis.com/developers"}}
      secondary={{label:"API reference docs",href:`${V6_BASE}/docs/api`}} {...photographHero("networkEngineer")}/>
    <Band><SectionHead eyebrow="From request to evidence" title="A reviewed plan comes first."/>
      <FeatureGrid span={4}>
        <FeatureCard label="01 / Submit" title="Describe the behavior" body="Send the deployment address and requirement. The initial response returns a plan to review; nothing runs or is charged yet."/>
        <FeatureCard label="02 / Review" title="Approve the scope" body="A person follows the approval address to review the plan. API keys cannot approve it on their behalf."/>
        <FeatureCard label="03 / Inspect" title="Read the result" body="Inspect the finished verification and its evidence, or receive the result through a signed webhook."/>
      </FeatureGrid>
    </Band>
    <Band><SectionHead eyebrow="Illustrative request" title="One requirement. An explicit review boundary." lead="This example starts the live browser workflow. The local recording beta is a separate workflow."/><Code lang="bash" src={request}/><Code lang="json" src={response}/></Band>
    <ClosingScene title="Connect your own tools." action={{label:"API reference docs",href:`${V6_BASE}/docs/api`}}/>
    <CopyScript/>
  </>;
}
