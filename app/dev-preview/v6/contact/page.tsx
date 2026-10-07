import { v6meta } from "../_system/meta";
import { TitleEntrance } from "../_system/title-entrance";
import { V6_BASE } from "@/lib/v6-routes";
import { ContactForm } from "./contact-form";
import "./contact.css";

export const metadata = v6meta({ title: "Inquiries", description: "Share AI-security requirements with Vraelis: the models, threats, operating environment and review needs.", path: "/contact" });
const ADDRESSES: [string, string][] = [
  ["help@vraelis.com", "General and technical inquiries"],
  ["sales@vraelis.com", "AI security and organizational inquiries"],
  ["privacy@vraelis.com", "Privacy and data rights"],
];
type Query = Promise<{ [key: string]: string | string[] | undefined }>;
export default async function Contact({ searchParams }: { searchParams: Query }) {
  const { topic } = await searchParams;
  const requirements = topic === "ai-security";
  return <section className="v6-sec ct">
    <div className={`v6-wrap ct__grid${requirements ? " ct__grid--requirements" : ""}`}>
      <header className="ct__intro">
        <p className="ct__eyebrow">{requirements ? "AI security requirements" : "Inquiries"}</p>
        <h1><TitleEntrance>{requirements ? "What do you need to secure?" : "Reach the right team."}</TitleEntrance></h1>
        <p>{requirements ? "Tell us about your AI system, the security problem and where it operates. Choose your role so we ask for the details relevant to your inquiry." : "Send a technical, organizational or privacy inquiry. Choose your role and topic so it reaches the right team."}</p>
        {requirements ? <p className="ct__availability">Vraelis is in private development. This form starts an engineering inquiry.</p> : null}
      </header>
      <div className="ct__form"><ContactForm key={typeof topic === "string" ? topic : ""} topicParam={typeof topic === "string" ? topic : undefined} /></div>
      <aside className="ct__aside" aria-label="Other contact options">
        <details className="ct__direct"><summary>Direct contact addresses</summary><ul className="ct__list">{ADDRESSES.map(([address, job]) => <li key={address}><a href={`mailto:${address}`} data-no-translate>{address}</a><span>{job}</span></li>)}</ul></details>
        <a className="ct__report" href={`${V6_BASE}/security#report`}>Report a security issue</a>
      </aside>
    </div>
  </section>;
}
