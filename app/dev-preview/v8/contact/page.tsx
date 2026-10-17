import { GENERAL_INBOX } from "@/lib/contact-routing";
import Link from "next/link";
import { Wrap } from "../_kit/blocks";
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
// form's two selects (who you are, what about) are the only way to choose: a row of topic chips above it asked the
// same thing twice and was removed (founder, 2026-10-12). Links from the menus still preset the topic with ?topic=.
// NOT A VRAELIS CONTOUR PAGE (founder, 2026-10-12: "dont form the entire thing around Vraelis Contour since they can
// reach out over many things"): the heading is the same for every arrival; ?topic= only presets the form, and the
// Vraelis Contour context (its note, the requirements prompt) appears in the form when that topic is chosen.
const ADDRESSES: [string, string][] = [
  [GENERAL_INBOX, "General inquiries, feedback and product support"],
  ["sales@vraelis.com", "Vraelis Contour, AI security and organizational inquiries"],
  ["privacy@vraelis.com", "Privacy and data rights"],
];
const EYEBROW: Record<string, string> = { research: "Research collaboration", government: "Government and institutions", privacy: "Privacy", other: "Contact" };

type Query = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function Contact({ searchParams }: { searchParams: Query }) {
  const { topic: raw } = await searchParams;
  const topic = typeof raw === "string" ? raw : undefined;
  return (
    <div className="cnt">
      <section className="v8-page-hero cnt-sec">
        <Wrap>
          <div className="cnt-grid">
            <header className="cnt-intro">
              <span className="v8-eyebrow">{EYEBROW[topic ?? ""] ?? "Contact"}</span>
              <h1 className="v8-h1">Talk to Vraelis.</h1>
              <p className="v8-lead">Vraelis Contour, research, an application area, a partnership, privacy or anything else. Choose a topic and your message goes to the team that handles it.</p>
            </header>
            <div className="cnt-formwrap">
              <ContactForm key={topic ?? ""} topicParam={topic === "other" ? undefined : topic} privacyHref={href("/privacy")} />
            </div>
            <aside className="cnt-aside" aria-label="Other contact options">
              {/* Always open, on every screen (founder, 2026-10-12: "dont even make this a dropdown"). */}
              <section className="cnt-direct" aria-labelledby="cnt-direct-h">
                <h2 id="cnt-direct-h" className="cnt-direct__h">Direct contact addresses</h2>
                <ul className="cnt-list">
                  {ADDRESSES.map(([address, job]) => <li key={address}><a href={`mailto:${address}`} data-no-translate>{address}</a><span>{job}</span></li>)}
                </ul>
              </section>
              <Link className="cnt-report" href={href("/security#report")}>Report a security issue<span className="v8-arrow" aria-hidden="true" /></Link>
            </aside>
          </div>
        </Wrap>
      </section>
    </div>
  );
}
