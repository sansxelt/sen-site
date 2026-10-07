import Image from "next/image";
import { v6meta } from "../_system/meta";
import { TitleEntrance } from "../_system/title-entrance";
import { V6_BASE } from "@/lib/v6-routes";
import { ContactForm } from "./contact-form";
import "./contact.css";

export const metadata = v6meta({ title: "Contact", description: "Discuss cybersecurity for your AI-enabled systems with Vraelis. Share the system, security problem and integration environment.", path: "/contact" });
const ADDRESSES: [string, string][] = [
  ["help@vraelis.com", "General and technical inquiries"],
  ["sales@vraelis.com", "AI security and organizational inquiries"],
  ["privacy@vraelis.com", "Privacy and data rights"],
];
type Query = Promise<{ [key: string]: string | string[] | undefined }>;
export default async function Contact({ searchParams }: { searchParams: Query }) {
  const { topic } = await searchParams;
  return <section className="v6-sec ct">
    <div className="v6-wrap">
      <header className="ct__intro">
        <p className="ct__eyebrow">Contact</p>
        <h1><TitleEntrance>Discuss AI security for your systems.</TitleEntrance></h1>
        <p>Tell us what you are building, where AI has access or influence, and the security problem you need to address.</p>
      </header>
      <div className="ct__grid">
        <div className="ct__form"><ContactForm topicParam={typeof topic === "string" ? topic : undefined} /></div>
        <aside className="ct__aside" aria-labelledby="ct-context">
          <div className="ct__photo"><Image src="/site/photography/network-engineer.jpg" alt="An engineer inspecting network equipment. Illustrative photography." width={2400} height={1597} sizes="(max-width:900px) 100vw, 40vw" /></div>
          <h2 className="ct__context-title" id="ct-context">Start with the problem.</h2>
          <dl className="ct__context">
            <div><dt>The system</dt><dd>The AI workload, model, tools and operational resources involved.</dd></div>
            <div><dt>The security boundary</dt><dd>The access, proposed action, untrusted input or model change you need to investigate.</dd></div>
            <div><dt>The environment</dt><dd>Identity, hosting, connectivity and integration requirements.</dd></div>
          </dl>
          <p className="ct__stage">Vraelis is in private development. This is an inquiry, not an application for an available deployment.</p>
          <details className="ct__direct"><summary>Direct contact addresses</summary><ul className="ct__list">{ADDRESSES.map(([address, job]) => <li key={address}><a href={`mailto:${address}`} data-no-translate>{address}</a><span>{job}</span></li>)}</ul></details>
          <a className="ct__report" href={`${V6_BASE}/security#report`}>Report a security issue</a>
        </aside>
      </div>
    </div>
  </section>;
}
