import Link from "next/link";
import { Wrap, cx } from "../_kit/blocks";
import { v8meta } from "../_kit/meta";
import { href } from "../_kit/site";
import { ContactForm } from "./contact-form";
import "./contact.css";

export const metadata = v8meta({
  title: "Contact",
  description: "Reach the right team at Vraelis: Vraelis Contour, research collaboration, government and institutions, or a privacy request.",
  path: "/contact",
});

// The routed intake from the live /contact, restyled for v8. Behaviour is unchanged (see ./contact-form.tsx): the
// same fields, validation, POST body and messages. ?topic= arrives from Join us and the menus and presets the form.
const ADDRESSES: [string, string][] = [
  ["help@vraelis.com", "General and technical inquiries"],
  ["sales@vraelis.com", "Vraelis Contour, AI security and organizational inquiries"],
  ["privacy@vraelis.com", "Privacy and data rights"],
];
const ROUTES = [
  { topic: "contour", label: "Vraelis Contour" },
  { topic: "research", label: "Research collaboration" },
  { topic: "government", label: "Government or institution" },
  { topic: "privacy", label: "Privacy request" },
] as const;
const EYEBROW: Record<string, string> = { research: "Research collaboration", government: "Government and institutions", privacy: "Privacy" };

type Query = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function Contact({ searchParams }: { searchParams: Query }) {
  const { topic: raw } = await searchParams;
  const topic = typeof raw === "string" ? raw : undefined;
  const contour = topic === "contour" || topic === "ai-security";
  return (
    <div className="cnt">
      <section className="v8-page-hero cnt-sec">
        <Wrap>
          <div className={cx("cnt-grid", contour && "cnt-grid--contour")}>
            <header className="cnt-intro">
              <span className="v8-eyebrow">{contour ? "Vraelis Contour" : EYEBROW[topic ?? ""] ?? "Contact"}</span>
              <h1 className="v8-h1">{contour ? "Tell us how you release models." : "Reach the right team."}</h1>
              <p className="v8-lead">
                {contour
                  ? "How models move from approval to the systems that run them."
                  : "Technical, organizational, research or privacy inquiries."}
              </p>
              <p className="v8-note cnt-closed">Product access is closed: Vraelis Contour is in private development.</p>
              <nav className="cnt-routes" aria-label="Start from">
                {ROUTES.map((r) => {
                  const on = r.topic === topic || (r.topic === "contour" && contour);
                  return <Link key={r.topic} href={href(`/contact?topic=${r.topic}`)} className="cnt-route" aria-current={on ? "page" : undefined}>{r.label}</Link>;
                })}
                {topic ? <Link href={href("/contact")} className="cnt-route">Any other inquiry</Link> : null}
              </nav>
            </header>
            <div className="cnt-formwrap">
              <ContactForm key={topic ?? ""} topicParam={topic} privacyHref={href("/privacy")} />
            </div>
            <aside className="cnt-aside" aria-label="Other contact options">
              <details className="cnt-direct">
                <summary>Direct contact addresses<span className="v8-caret" aria-hidden="true" /></summary>
                <ul className="cnt-list">
                  {ADDRESSES.map(([address, job]) => <li key={address}><a href={`mailto:${address}`} data-no-translate>{address}</a><span>{job}</span></li>)}
                </ul>
              </details>
              <Link className="cnt-report" href={href("/security#report")}>Report a security issue<span className="v8-arrow" aria-hidden="true" /></Link>
            </aside>
          </div>
        </Wrap>
      </section>
    </div>
  );
}
