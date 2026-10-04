import { photographHero } from "../_content/photography";
import { Band, CrossLinks, FeatureCard, FeatureGrid, FrameHero } from "../_system/kit";
import { EditorialLink, SectionHead, Signal } from "../_system/ui";
import { ClosingScene } from "../_system/close";
import { v6meta } from "../_system/meta";
import { sectorBySlug } from "../_content/sectors";
import { V6_BASE } from "@/lib/v6-routes";
import "../_system/hero-asides.css";
import "./enterprise.css";

// ENTERPRISE (plan C /enterprise, the sales variant of template T1, revised 2026-10-02).
//
// This page absorbed the separate /sso page. SSO was never a product, it was one capability of working as a
// team, and a page per capability is how a site ends up with twenty routes nobody maintains.
//
// WHAT IS SAID HERE, AND WHERE IT COMES FROM. OIDC single sign-on, roles, owner-anchored billing and audit export
// are Operational; SAML is Preview and SCIM is Planned (plan A8.3, and /security says the same). The client
// secret is stored with AES-256-GCM; a reviewer who approves a plan is never charged. Invoicing, a signed
// agreement and a security review are on /pricing's Enterprise card. The hero is a capture of the console's
// Records page (Export, and the Trust controls with single sign-on, team roles and billing admins), made for this
// site on 2026-10-02 with the QA account and credited in public/site/hero/CREDITS.md: the plan asked for the
// organization's single sign-on settings, which the QA account has no organization to show.
//
// The hero carries id="overview" only so enterprise.css can let its headline's long words wrap on a narrow phone
// (the German "Identitätsanbieter" is wider than the 260px headline column at 320px).
//
// THE CAPABILITY TUPLES KEEP THEIR SHAPE: [label, state, word], the state "go" or "wait". scripts/
// guarantee-cap-verify.ts reads every tuple whose state is "wait" from this file and fails /pricing if it ever
// sells one of them, so a capability in preview can never be presented as shipped on the page that sells plans.

export const metadata = v6meta({
  title: "Enterprise",
  description:
    "Verification for governments, regulated institutions and established organizations, with single sign-on, team roles, audit exports and custom capacity.",
  path: "/enterprise",
  type: "website",
});

const BASE = V6_BASE;
const SALES = `${BASE}/contact?topic=enterprise`;

const CAPABILITY: [string, "go" | "wait" | "stop", string][] = [
  ["OIDC single sign-on", "go", "Operational"],
  ["Team roles: owner, editor, viewer", "go", "Operational"],
  ["Owner-anchored billing", "go", "Operational"],
  ["Audit activity with sanitized export", "go", "Operational"],
  ["SAML single sign-on", "wait", "Preview"],
  ["SCIM provisioning", "wait", "Planned"],
];

/* One plain line per capability, keyed by its label (the tuples above keep their three-part shape). */
const MEANS: Record<string, string> = {
  "OIDC single sign-on": "Any OIDC provider, for a verified domain.",
  "Team roles: owner, editor, viewer": "A viewer reads the evidence without changing anything.",
  "Owner-anchored billing": "Billing stays with the workspace owner.",
  "Audit activity with sanitized export": "CSV or JSON, with secrets, tokens and payment identifiers left out.",
  "SAML single sign-on": "The metadata endpoint exists. Sign-in with SAML is not enabled yet.",
  "SCIM provisioning": "Automated provisioning is planned. It is not built yet.",
};

const defense = sectorBySlug("defense")!;

export default function V6Enterprise() {
  return (
    <>
      <FrameHero
        id="overview"
        eyebrow="Enterprise"
        title="Verification for your organization"
        sub="For governments, regulated institutions and established organizations. Bring your identity provider and reviewers, with access controls, audit exports and capacity agreed for your needs."
        primary={{ label: "Talk to sales", href: SALES }}
        secondary={{ label: "Security", href: `${BASE}/security` }}
        {...photographHero("mission")}

      />

      {/* ── Where each capability stands: words, not chips. ── */}
      <section className="v6-sec" id="capabilities">
        <div className="v6-wrap">
          <SectionHead eyebrow="Where each capability stands" title="Operational, preview or planned, labelled" />
          <table className="en-cap">
            <caption className="en-cap__cap">Enterprise capabilities and where each one stands today</caption>
            <thead>
              <tr>
                <th scope="col">Capability</th>
                <th scope="col">Where it stands</th>
                <th scope="col">What that means</th>
              </tr>
            </thead>
            <tbody>
              {CAPABILITY.map(([label, state, word]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td className="en-cap__state"><Signal state={state}>{word}</Signal></td>
                  <td className="en-cap__means">{MEANS[label]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── How it holds at team scale: the page's one Band. ── */}
      <Band id="team">
        <SectionHead eyebrow="How it works" title="Three things that hold at team scale" />
        <FeatureGrid span={4}>
          <FeatureCard
            title="Your identity provider, your rules"
            body="Connect any OIDC provider. The client secret is encrypted with AES-256-GCM, never returned to the browser and never written to a log."
          />
          <FeatureCard
            title="Separation of duties"
            body="A billing admin manages payment without owning data or members. Ownership moves only through a deliberate, guarded transfer, never a settings toggle."
          />
          <FeatureCard
            title="Billing that follows the work"
            body="The team shares its connected systems and the owner pays, so a reviewer who approves a plan is never charged on their own account."
          />
        </FeatureGrid>
      </Band>

      {/* ── The sales address, then the limits: two quiet lines. The address is the mailto, not another page. ── */}
      <section className="v6-sec ha-limits en-lines">
        <div className="v6-wrap">
          <div className="ha-limits__row">
            <p className="ha-limits__t">Invoicing, a signed agreement and a security review are available, with a written quote.</p>
            <EditorialLink href="mailto:sales@vraelis.com?subject=Vraelis%20Enterprise"><span data-no-translate>sales@vraelis.com</span></EditorialLink>
          </div>
          <div className="ha-limits__row">
            <p className="ha-limits__t">What Vraelis does not do yet is written down.</p>
            <EditorialLink href={`${BASE}/limitations`}>Read the limitations</EditorialLink>
          </div>
        </div>
      </section>

      <section className="v6-sec en-related">
        <div className="v6-wrap">
          {/* Every card has its 16:10 picture, as on /platform, /limitations and the sector pages, and each card is
              the one the site uses for that target, line and picture (Security as on /solutions/defense, Pricing as
              on the sector pages). */}
          <CrossLinks
            links={[
              { title: "Security", body: "What Vraelis stores, and how it is protected.", href: `${BASE}/security`, image: "/site/photography/signup.jpg" },
              { title: "Pricing", body: "Listed plans, and what one verification includes.", href: `${BASE}/pricing`, image: "/site/photography/checkout.jpg" },
              { title: defense.label, body: defense.line, href: defense.href, image: defense.pics.card1610 },
            ]}
          />
        </div>
      </section>

      <ClosingScene action={{ label: "Talk to sales", href: SALES }} />
    </>
  );
}
