import { Band, FeatureCard, FeatureGrid, FrameHero } from "../../_system/kit";
import { SectionHead } from "../../_system/ui";
import { Code, CopyScript } from "../../_system/code";
import { ClosingScene } from "../../_system/close";
import { photographHero } from "../../_content/photography";
import { v6meta } from "../../_system/meta";
import { V6_BASE } from "@/lib/v6-routes";

export const metadata = v6meta({ title:"Command line", description:"Start a Vraelis browser check from your terminal or pipeline and wait for a verdict with explicit exit codes.", path:"/developers/cli" });

const command = `vraelis verify \\
  --url "$PREVIEW_URL" \\
  --claim "Only the intended test asset changes when the operator confirms a task." \\
  --wait`;

export default function Page() {
  return <>
    <FrameHero compact eyebrow="Command line" title="A check where you already work."
      sub="Start a browser verification from your terminal or pipeline. Review the proposed plan, wait for the result, and inspect the evidence."
      primary={{label:"Create an API key",href:"https://app.vraelis.com/developers"}}
      secondary={{label:"CLI setup docs",href:`${V6_BASE}/docs/cli`}} {...photographHero("firmware")}/>
    <Band><SectionHead eyebrow="The command" title="Make the intended behavior explicit." lead="Authenticate with vraelis login or a VRAELIS_API_KEY environment variable. The reviewed-plan approval boundary still applies."/><Code lang="bash" src={command}/></Band>
    <Band><SectionHead eyebrow="With --wait" title="Let the next step read the verdict." lead="Without --wait, exit code 0 only means a verification started. Wait for the verdict before using it as a release gate."/>
      <FeatureGrid span={4}>
        <FeatureCard label="Exit 0" title="Verified" body="The requirement held in the live app, with evidence for the checked behavior."/>
        <FeatureCard label="Exit 1" title="Failed" body="The requirement did not hold. Inspect the result and its repair prompt before changing the software."/>
        <FeatureCard label="Exit 2" title="Blocked" body="No verdict was reached, or the command could not run. Treat the check as unresolved."/>
      </FeatureGrid>
    </Band>
    <ClosingScene title="Put the check where you ship from." action={{label:"CI setup docs",href:`${V6_BASE}/docs/ci`}}/>
    <CopyScript/>
  </>;
}
