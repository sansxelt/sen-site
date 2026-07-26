import { v6meta } from "../_system/meta";
import { PageHero, Reveal, SectionHead, Signal, CTA, EditorialLink } from "../_system/ui";
import { V6_BASE } from "@/lib/v6-routes";

export const metadata = v6meta({
  title: "Enterprise",
  description:
    "Single sign-on, team roles, owner-anchored billing, audit export and a signed agreement. What is operational today, what is in preview, and what is planned, each labelled rather than blended together.",
  path: "/enterprise",
  type: "website",
});

const BASE = V6_BASE;
const CARD = { background: "var(--graphite-2)", border: "1px solid var(--g-line)", borderRadius: 14, padding: "clamp(22px,2.4vw,28px)" } as const;
const H3 = { margin: "0 0 8px", fontSize: "1.12rem", fontWeight: 600, letterSpacing: "-0.015em", color: "var(--g-fg)" } as const;
const P = { margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--g-fg-2)" } as const;

// This page absorbed the separate /sso page. SSO was never a product, it was one capability of working as a
// team, and a page per capability is how a site ends up with twenty routes nobody maintains.
const CAPABILITY: [string, "go" | "wait" | "stop", string][] = [
  ["OIDC single sign-on", "go", "Operational"],
  ["Team roles: owner, editor, viewer", "go", "Operational"],
  ["Owner-anchored billing", "go", "Operational"],
  ["Audit activity with sanitized export", "go", "Operational"],
  ["SAML single sign-on", "wait", "Preview"],
  ["SCIM provisioning", "wait", "Planned"],
];

const HOW: [string, string][] = [
  ["Your identity provider, your rules", "Connect any OIDC provider. The client secret is encrypted at rest with AES-256-GCM, never returned to the browser, and never written to a log. Members sign in through your provider and land on the systems their role permits."],
  ["Separation of duties, by construction", "A billing admin manages payment without owning data or members. Ownership transfer is a deliberate, guarded action rather than a settings toggle. The same principle runs through the product: whatever builds a system does not get to approve its own proof."],
  ["Billing that follows the work", "A team shares connected systems and the owner pays, so a reviewer approving a plan never triggers a charge on their own account. Invoicing and a signed agreement are available above the largest listed plan."],
];

export default function V6Enterprise() {
  return (
    <>
      <PageHero
        kicker="Enterprise"
        title="Bring your own identity provider, and your own reviewers."
        lead="Vraelis is built so more than one person can hold a guarantee: your provider authenticates them, roles decide what they may change, and the evidence is readable by everyone who needs it without anyone sharing a login."
      />

      <section className="v6-sec">
        <div className="v6-wrap">
          <SectionHead eyebrow="Where each capability stands" title="Operational, preview, or planned. Labelled." />
          <Reveal>
            <div style={{ display: "grid", gap: 10 }}>
              {CAPABILITY.map(([label, state, note]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 0", borderBottom: "1px solid var(--g-line)" }}>
                  <span style={{ fontSize: 15, color: "var(--g-fg)" }}>{label}</span>
                  <Signal state={state}>{note}</Signal>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="v6-sec" data-nav-dark>
        <div className="v6-wrap">
          <SectionHead eyebrow="How it works" title="Three things that hold at team scale." />
          <Reveal media className="v6-grid3">
            {HOW.map(([t, d]) => (<div key={t} style={CARD}><h3 style={H3}>{t}</h3><p style={P}>{d}</p></div>))}
          </Reveal>
          <Reveal>
            <div style={{ marginTop: 28 }}><CTA href={`${BASE}/contact`} brand>Talk to us</CTA></div>
            <p className="v6-note">
              Controls and data handling are on{" "}
              <EditorialLink href={`${BASE}/security`}>security</EditorialLink>. Listed plans are on{" "}
              <EditorialLink href={`${BASE}/pricing`}>pricing</EditorialLink>.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
