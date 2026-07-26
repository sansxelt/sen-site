import { v6meta } from "../_system/meta";
import { PageHero, Reveal, SectionHead, EditorialLink } from "../_system/ui";
import { V6_BASE } from "@/lib/v6-routes";

export const metadata = v6meta({
  title: "Contact",
  description: "Who to write to, and what each address is actually for. Every one reaches a person.",
  path: "/contact",
  type: "website",
});

const BASE = V6_BASE;
const CARD = { background: "var(--graphite-2)", border: "1px solid var(--g-line)", borderRadius: 14, padding: "clamp(22px,2.4vw,28px)" } as const;
const H3 = { margin: "0 0 8px", fontSize: "1.12rem", fontWeight: 600, letterSpacing: "-0.015em", color: "var(--g-fg)" } as const;
const P = { margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--g-fg-2)" } as const;

// Addresses are the ones the product already uses. A contact page inventing a new alias is a contact page
// with a dead address on it.
const WHO: [string, string, string][] = [
  ["help@vraelis.com", "Support", "A run that behaved unexpectedly, a verification you cannot interpret, anything broken. Include the verification id and you will get a specific answer rather than a general one."],
  ["sales@vraelis.com", "Enterprise and invoicing", "Volume above the listed plans, a signed agreement, security review, or single sign-on for your team."],
  ["privacy@vraelis.com", "Privacy and data rights", "Access, export or deletion of your data, and any question about how it is handled."],
  ["hello@vraelis.com", "Everything else", "Including the ones that do not fit a category. It reaches a person."],
];

export default function V6Contact() {
  return (
    <>
      <PageHero
        kicker="Contact"
        title="Write to a person."
        lead="Four addresses, each with a job. There is no ticket maze and no contact form that disappears into one."
      />
      <section className="v6-sec">
        <div className="v6-wrap">
          <SectionHead eyebrow="Who to write to" title="Pick the one that matches the question." />
          <Reveal media className="v6-grid3">
            {WHO.map(([addr, role, d]) => (
              <div key={addr} style={CARD}>
                <h3 style={H3}>{role}</h3>
                <p style={{ ...P, marginBottom: 8 }}>{d}</p>
                <a href={`mailto:${addr}`} style={{ fontSize: 14, color: "var(--g-fg)", textDecoration: "underline", textUnderlineOffset: 3 }}>{addr}</a>
              </div>
            ))}
          </Reveal>
          <Reveal>
            <p className="v6-note">
              Reporting a security issue? Please use the disclosure route on{" "}
              <EditorialLink href={`${BASE}/security`}>security</EditorialLink> rather than a general address.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
