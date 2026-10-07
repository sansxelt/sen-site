import Link from "next/link";
import { v6meta } from "../_system/meta";
import { SectionHead, CTA } from "../_system/ui";
import { Band } from "../_system/kit";
import { DirectionHero, DirectionTopics } from "../_system/direction-page";
import { V6_BASE } from "@/lib/v6-routes";
import "./security.css";

export const metadata = v6meta({
  title: "Security",
  description: "Vraelis security information, current development limits and how to report a security issue.",
  path: "/security",
});
const BASE = V6_BASE;

export default function SecurityPage() {
  return <div className="direction-page">
    <DirectionHero eyebrow="Security" title="Security and responsible disclosure." intro="The public site provides information and a way to contact us. The AI-security product, app and console are in private development."/>
    <Band id="status">
      <SectionHead eyebrow="Current status" title="Development is not an operational deployment." lead="Earlier browser-checking features and implementation references do not establish a deployed AI-security service. There is no publicly available enforcement gateway or certified physical-system protection."/>
      <DirectionTopics items={[
        {label:"Product",title:"Controls are being developed privately",body:"The current foundations cover policy decisions and review of supplied recordings. Trusted identity, artifact verification and live execution boundaries still require integration and testing."},
        {label:"Assurance",title:"Evaluate the system and its limits",body:"Research topics, design intentions and local tests are not certifications. Any future deployment must be evaluated against its actual interfaces, threat model and operating environment."},
        {label:"Access",title:"Public account access is closed",body:"The site does not offer a self-service product account, production API or operational deployment. A contact submission does not grant access."},
      ]}/>
      <div className="direction-links"><Link href={`${BASE}/beta`}>Development status</Link><Link href={`${BASE}/limitations`}>Read the limitations</Link></div>
    </Band>
    <Band id="data-handling">
      <SectionHead eyebrow="Data handling" title="Share only what belongs in an inquiry." lead="Please keep credentials, classified material, restricted technical data and sensitive operational information out of public contact forms."/>
      <DirectionTopics items={[
        {label:"Inquiries",title:"Start with a description",body:"Describe the system and security problem at a level you are authorized to share. Do not attach a live secret or operational dataset to explain the issue."},
        {label:"Privacy",title:"Use the privacy channel",body:"Privacy and data-rights requests have a separate contact path. They do not require organization details or a commercial acknowledgement."},
      ]}/>
      <div className="direction-links"><Link href={`${BASE}/privacy`}>Privacy policy</Link><Link href={`${BASE}/subprocessors`}>Subprocessors</Link><Link href={`${BASE}/contact?topic=privacy`}>Privacy or data-rights request</Link></div>
    </Band>
    <section className="v6-sec" id="report">
      <div className="v6-wrap sec-report">
        <SectionHead eyebrow="Report a security issue" title="Tell us, and a person reads it" lead="Email help@vraelis.com with Security report in the subject. Say what you found, the address where it happens, and how to reproduce it."/>
        <ul className="sec-report__rules" role="list">
          <li>Test only against accounts you own, and stop as soon as you can show the problem.</li>
          <li>Do not open, change or keep anyone else&apos;s data. If you reach some by accident, tell us and delete it.</li>
          <li>Give us a reasonable chance to fix it before you publish anything.</li>
        </ul>
        <div className="v6-actions sec-report__actions">
          <CTA lg ghost href="mailto:help@vraelis.com?subject=Security%20report">Email help@vraelis.com</CTA>
          <a className="v6-elink" href="/.well-known/security.txt" data-no-translate>/.well-known/security.txt</a>
        </div>
      </div>
    </section>
  </div>;
}
