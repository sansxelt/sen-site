import { v6meta } from "../_system/meta";
import { EditorialLink } from "../_system/ui";
import { IndexHero } from "../_system/kit";
import { V6_BASE } from "@/lib/v6-routes";
import { ContactForm } from "./contact-form";
import "./contact.css";

export const metadata = v6meta({
  title: "Contact",
  description: "Write to a person at Vraelis: a form that sends your message to the right address, and the three addresses, each with its job.",
  path: "/contact",
  type: "website",
});

const BASE = V6_BASE;

// THE CONTACT PAGE (plan T12, revision 2, 2026-10-02): the form in columns 1 to 7 and the addresses in 9 to 12 from
// 1024px up, no closing scene. The form (contact-form.tsx) posts JSON to /api/contact and routes by topic.
//
// THE ADDRESSES ARE CHECKED BY scripts/prose-link-verify.ts, which reads this file: every address offered here is
// written as a tuple whose first element is the address, each must be in lib/email.ts SUPPORT_INBOXES (the inboxes
// the contact route resolves against, so mail to them reaches a person), and the hero's lead must open with the
// number of addresses listed, as a word. Cloudflare Email Routing for all three was confirmed on 2026-10-02.
// hello@ is the sender on outbound mail and receives nothing, so it is never listed. Keep the routing table out
// of this file (it lives in contact-form.tsx), so the suite counts only the addresses a reader sees.
const ADDRESSES: [string, string][] = [
  ["help@vraelis.com", "Support, and anything that does not fit elsewhere"],
  ["sales@vraelis.com", "Sales, enterprise and invoicing"],
  ["privacy@vraelis.com", "Privacy and data rights"],
];

type Query = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function V6Contact({ searchParams }: { searchParams: Query }) {
  // ?topic=<support|sales|defense|fleets|public-sector|enterprise|partnerships|privacy> preselects the topic. The
  // layout already renders per request (it reads the session), so reading the query here costs nothing, and the
  // server HTML arrives with the right option checked. The form checks the value against its own topic keys.
  const { topic } = await searchParams;
  const param = typeof topic === "string" ? topic : undefined;
  return (
    <>
      <IndexHero
        eyebrow="Contact"
        title="Write to a person."
        lead="Three addresses, each with a job, and a form that sends your message to the right one."
      />
      <section className="v6-sec ct">
        <div className="v6-wrap ct__grid">
          <div className="ct__form">
            <ContactForm topicParam={param} />
          </div>
          <aside className="ct__aside" aria-labelledby="ct-addresses">
            <h2 className="ct__h" id="ct-addresses" data-label="">Addresses</h2>
            <ul className="ct__list" role="list">
              {ADDRESSES.map(([addr, job]) => (
                <li key={addr}>
                  <a href={`mailto:${addr}`} data-no-translate>{addr}</a>
                  <span>{job}</span>
                </li>
              ))}
            </ul>
            <div className="ct__report">
              <EditorialLink href={`${BASE}/security#report`}>Report a security issue</EditorialLink>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
