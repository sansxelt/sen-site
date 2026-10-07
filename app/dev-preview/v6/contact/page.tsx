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
    <div className="v6-wrap ct__grid">
      <header className="ct__intro">
        <p className="ct__eyebrow">Contact</p>
        <h1><TitleEntrance>Discuss AI security for your systems.</TitleEntrance></h1>
        <p>Tell us what you are building, where AI has access or influence, and the security problem you need to address.</p>
      </header>
      <div className="ct__form"><ContactForm topicParam={typeof topic === "string" ? topic : undefined} /></div>
      <aside className="ct__aside" aria-label="Other contact options">
        <details className="ct__direct"><summary>Direct contact addresses</summary><ul className="ct__list">{ADDRESSES.map(([address, job]) => <li key={address}><a href={`mailto:${address}`} data-no-translate>{address}</a><span>{job}</span></li>)}</ul></details>
        <a className="ct__report" href={`${V6_BASE}/security#report`}>Report a security issue</a>
      </aside>
    </div>
  </section>;
}
