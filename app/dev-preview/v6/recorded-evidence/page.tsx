import { Band, FeatureCard, FeatureGrid, FrameHero } from "../_system/kit";
import { SectionHead } from "../_system/ui";
import { RecordedEntry } from "../_system/recorded-entry";
import { EvidenceModel } from "../_system/evidence-model";
import { ClosingScene } from "../_system/close";
import { photographHero } from "../_content/photography";
import { v6meta } from "../_system/meta";
import { V6_BASE, v6SignInPath } from "@/lib/v6-routes";

export const metadata = v6meta({ title:"Recorded evidence", description:"Compare supported JSON and MCAP task reports against a defined requirement, with findings linked to source events.", path:"/recorded-evidence" });

export default function Page() {
  return <>
    <FrameHero compact eyebrow="Recorded evidence" title="The task is one story. The reports should agree."
      sub="Review control-panel, service and device reports together. Check the intended asset, completion window and assets that must stay unchanged."
      primary={{label:"Open recorded evidence",href:v6SignInPath("/verifications/recorded")}}
      secondary={{label:"Explore the beta",href:`${V6_BASE}/beta`}} {...photographHero("hardwareInspection")}/>
    <RecordedEntry/>
    <Band><SectionHead eyebrow="The comparison" title="Define the requirement. Inspect the evidence." lead="Captured intervals matter as much as recorded states. A missing report can leave the result inconclusive."/><EvidenceModel/></Band>
    <Band><SectionHead eyebrow="What the beta reviews" title="Look past a successful status."/>
      <FeatureGrid span={4}>
        <FeatureCard label="State" title="Conflicting reports" body="Find when the control panel reports completion while captured device evidence does not support it."/>
        <FeatureCard label="Identity" title="The wrong asset" body="Compare the requested task and intended asset, including assets whose recorded state must remain unchanged."/>
        <FeatureCard label="Coverage" title="Missing evidence" body="Keep absent reports and uncovered intervals visible. An unobserved period cannot establish success."/>
      </FeatureGrid>
    </Band>
    <ClosingScene title="Bring the recording you already have." action={{label:"Recording format docs",href:`${V6_BASE}/docs/recorded-reports`}}/>
  </>;
}
