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
// same fields, validation, POST body and messages. ?topic= arrives from the menus and presets the form.
// ONE PAGE FOR CONTACT AND JOIN US (founder, 2026-10-11, after scale.com, whose Contact and Get Started are the same
// form): /contact with no topic is the Vraelis Contour inquiry, every Contact and Join us link lands here, and the
// chips are the same set on every visit, "Any other inquiry" included (topic=other, the general form).
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
  { topic: "other", label: "Any other inquiry" },
] as const;
const EYEBROW: Record<string, string> = { research: "Research collaboration", government: "Government and institutions", privacy: "Privacy", other: "Contact" };

type Query = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function Contact({ searchParams }: { searchParams: Query }) {
  const { topic: raw } = await searchParams;
  const topic = typeof raw === "string" ? raw : undefined;
  const contour = !topic || topic === "contour" || topic === "ai-security";
  return (
    <div className="cnt">
      <section className="v8-page-hero cnt-sec">
        <Wrap>
          <div className={cx("cnt-grid", contour && "cnt-grid--contour")}>
            <header className="cnt-intro">
              <span className="v8-eyebrow">{contour ? "Vraelis Contour" : EYEBROW[topic ?? ""] ?? "Contact"}</span>
              <h1 className="v8-h1">{contour ? "Join us on Vraelis Contour." : "Reach the right team."}</h1>
              <p className="v8-lead">
                {contour
                  ? "Model release security, from approval to reported runtime state."
                  : "Technical, organizational, research or privacy inquiries."}
              </p>
              <p className="v8-note cnt-closed">Vraelis Contour is not for public use. It is built for release, platform and security engineers at suppliers and system integrators.</p>
              <nav className="cnt-routes" aria-label="Start from">
                {ROUTES.map((r) => {
                  const on = r.topic === topic || (r.topic === "contour" && contour);
                  return <Link key={r.topic} href={href(`/contact?topic=${r.topic}`)} className="cnt-route" aria-current={on ? "page" : undefined}>{r.label}</Link>;
                })}
              </nav>
            </header>
            <div className="cnt-formwrap">
              <ContactForm key={topic ?? ""} topicParam={contour ? "contour" : topic === "other" ? undefined : topic} privacyHref={href("/privacy")} />
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
