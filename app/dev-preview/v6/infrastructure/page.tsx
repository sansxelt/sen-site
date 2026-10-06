import { v6meta } from "../_system/meta";
import { FrameHero, Band, FeatureGrid, FeatureCard } from "../_system/kit";
import { SectionHead, EditorialLink } from "../_system/ui";
import { RecordedEntry } from "../_system/recorded-entry";
import { ClosingScene } from "../_system/close";
import { photographHero } from "../_content/photography";
import { V6_BASE } from "@/lib/v6-routes";

export const metadata = v6meta({ title: "Infrastructure", description: "Software verification for utilities, transport and industrial operations. Review recorded task evidence and verify control-panel workflows.", path: "/infrastructure" });

export default function Infrastructure() {
  return <>
    <FrameHero eyebrow="Infrastructure" title="An accepted command is not a completed task."
      sub="For teams responsible for utilities, transport and industrial operations. Compare supplied equipment task reports with control-panel and service reports. Find conflicting states, missing completion evidence and changes to the wrong asset."
      primary={{ label: "Review recorded evidence", href: "/verifications/recorded" }}
      secondary={{ label: "Talk to us", href: `${V6_BASE}/contact?topic=infrastructure` }}
      {...photographHero("windFarm")} />
    <Band>
      <SectionHead eyebrow="Where to start" title="Find the disagreement in the handoff." lead="These are candidate applications, not completed customer deployments. Start with supported recordings or a simulation panel." />
      <FeatureGrid><FeatureCard title="Utilities" body="Compare requested and reported equipment states for the same asset and task." />
      <FeatureCard title="Transport" body="Inspect whether a dispatch request, service response and vehicle report agree." />
      <FeatureCard title="Industrial operations" body="Identify false completion reports, missing task evidence and unexpected changes to another asset." /></FeatureGrid>
    </Band>
    <RecordedEntry />
    <Band>
      <SectionHead eyebrow="Operational scope" title="Access is part of the deployment." />
      <p style={{maxWidth:780,lineHeight:1.7,color:"var(--ink-2)"}}>Infrastructure can serve public agencies, regulated institutions and restricted operations. Today’s local beta reviews supplied recordings; cloud browser verification uses a reachable, approved test target. Private-network deployment, live hardware adapters and classified-environment support are not built. Vraelis does not certify safety or regulatory compliance.</p>
      <EditorialLink href={`${V6_BASE}/enterprise`}>Institutional requirements</EditorialLink>
    </Band>
    <ClosingScene action={{label:"Discuss your system",href:`${V6_BASE}/contact?topic=infrastructure`}} />
  </>;
}
