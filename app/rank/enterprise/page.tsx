import Link from "next/link";
import { ogMeta } from "@/lib/og-meta";
import { PLAN_CATALOG_V1 } from "@/lib/preflight/pass-pricing";
import { usdFromCents } from "@/lib/preflight/pass-pricing-format";

const PLAN_BLURBS: Record<string, string> = {
  builder_v1: "For one product moving steadily toward launch.",
  pro_v1: "For teams launching continuously across applications.",
  scale_v1: "For agencies and platforms verifying at volume.",
};

// Enterprise and security hub. Governs preflight runs across an organization: roles and workspaces, verified
// domains, OIDC single sign-on, audit-ready run records, and sanitized exports. Honest about what is live:
// no SOC 2, SAML in preview, SCIM planned.
export const metadata = ogMeta({
  title: "Enterprise and security",
  description:
    "Govern production readiness across your organization: roles and workspaces, verified domains, OIDC single sign-on, audit-ready run records, and sanitized exports. Honest about what is live: no SOC 2, SAML in preview, SCIM planned.",
  path: "/enterprise",
});

const PROTECTS: [string, string][] = [
  ["Run workflows", "Preflight runs go through a governed pipeline with an audit trail, not an open box anyone can trigger against anything."],
  ["Application ownership", "Every connected app carries an explicit owner and an I own or authorized this confirmation before a run can touch it."],
  ["Organization access", "Organizations sit above workspaces with roles, admins, and membership governance, so access maps to who should have it."],
  ["Client-safe reports", "Share a read-only launch report by token. Private controls, costs, internals, and raw evidence never travel with it."],
  ["SSO and domain-based access", "OIDC single sign-on and verified-domain provisioning bind access to identities your organization already controls."],
  ["Billing and admin boundaries", "Billing admins manage payment without owning data or members. Ownership transfer is a deliberate, guarded action."],
  ["Audit activity", "Member, domain, SSO, billing-admin, ownership, and confirmation-round changes are recorded as a safe, reviewable trail."],
];

const CONTROLS: string[] = [
  "Organizations and workspaces", "Project-level access", "Client-safe report sharing", "Role-based access (admin / editor / viewer / client)",
  "Billing-admin separation", "Ownership-transfer controls", "Tokenized, expiring invites", "Verified organization domains",
  "Domain-based provisioning (governed)", "OIDC single sign-on", "Periodic domain re-verification", "Read-only audit activity", "Sanitized audit export (CSV / JSON)",
];

const ENTERPRISE_PERKS = ["Unlimited runs", "Organization governance and audit export", "OIDC SSO and verified domains", "Client-safe sharing and billing admins"];

const Section = ({ children, bg }: { children: React.ReactNode; bg?: boolean }) => (
  <section className="section" style={bg ? { background: "var(--bg-2)" } : undefined}>
    <div className="wrap" style={{ maxWidth: 920 }}>{children}</div>
  </section>
);

export default function EnterprisePage() {
  return (
    <>
      {/* Hero */}
      <section className="section" style={{ borderBottom: "1px solid var(--line-1)" }}>
        <div className="wrap" style={{ maxWidth: 820, textAlign: "center" }}>
          <p className="eyebrow" style={{ justifyContent: "center" }}>Enterprise and security</p>
          <h1 className="display" style={{ fontSize: "clamp(2rem, 4.4vw, 3rem)", marginBottom: 16 }}>Govern production readiness across your organization.</h1>
          <p className="lead-copy" style={{ margin: "0 auto 26px", maxWidth: 680 }}>Vraelis runs your AI-built apps like production before they ship. Enterprise teams govern who can connect apps and launch runs, verify organization domains, and keep audit-ready records of every run and decision. It is production infrastructure, not a dashboard.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signin?callbackUrl=%2Fapp" className="btn btn--lg">Validate a system</Link>
            <Link href="/developers" className="btn btn--ghost btn--lg">View developer platform</Link>
          </div>
        </div>
      </section>

      {/* What Vraelis protects */}
      <Section>
        <div className="sec-head" style={{ marginBottom: 28 }}>
          <p className="eyebrow">What Vraelis protects</p>
          <h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.3rem)" }}>The decision, and everything around it.</h2>
        </div>
        <div className="tile-grid cols-2">
          {PROTECTS.map(([t, d], i, arr) => {
            const lastOdd = i === arr.length - 1 && arr.length % 2 === 1;
            return (
              <div key={t} className="acard" style={lastOdd ? { gridColumn: "1 / -1", maxWidth: 460, marginInline: "auto", width: "100%" } : undefined}>
                <h3 style={{ fontSize: "clamp(1.05rem, 1.6vw, 1.25rem)", marginBottom: 6 }}>{t}</h3>
                <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.6, margin: 0 }}>{d}</p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Governance controls */}
      <Section bg>
        <div className="sec-head" style={{ marginBottom: 24 }}>
          <p className="eyebrow">Governance controls</p>
          <h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.3rem)" }}>Controls that exist today.</h2>
          <p>The access, identity, and sharing controls a team can use to run preflight responsibly across an organization.</p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {CONTROLS.map((c) => <span key={c} className="chip">{c}</span>)}
        </div>
      </Section>

      {/* Auditability */}
      <Section>
        <div className="sec-head" style={{ marginBottom: 20 }}>
          <p className="eyebrow">Auditability</p>
          <h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.3rem)" }}>A reviewable trail, without the secrets.</h2>
        </div>
        <p className="lead-copy" style={{ marginBottom: 14 }}>Workspace and organization activity are recorded as a read-only audit trail. Owners and admins review recent governance events in-app at <Link href="/activity" style={{ color: "var(--acc-deep)" }}>Activity</Link>, and can <strong style={{ color: "var(--fg-1)" }}>export sanitized governance activity as CSV or JSON</strong>. Scheduled exports and retention controls are planned.</p>
        <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.8, margin: 0 }}>Vraelis records key governance events: organization changes, domain verification and re-verification, SSO provider changes, billing-admin changes, confirmation rounds, ownership transfers, and team-access updates. Audit events carry only safe fields: <strong style={{ color: "var(--fg-1)" }}>no secrets, no invite or DNS tokens, no token hashes, no Stripe identifiers, no API keys, no OIDC codes or SAML assertions, no certificate bodies, no full URLs, and no IP or device data.</strong></p>
      </Section>

      {/* Data handling */}
      <Section bg>
        <div className="sec-head" style={{ marginBottom: 24 }}>
          <p className="eyebrow">Data handling</p>
          <h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.3rem)" }}>Honest about what we store and how.</h2>
        </div>
        <div className="tile-grid cols-2">
          {[
            ["No raw secrets in audit", "Event metadata is whitelisted to safe fields. Emails, tokens, hashes, and Stripe ids are filtered out before anything is recorded or shown."],
            ["OIDC secrets encrypted", "An organization's OIDC client secret is encrypted at rest (AES-256-GCM) and never returned to the client or logged."],
            ["DNS tokens hashed", "Domain verification stores only the SHA-256 of the DNS TXT token. The raw token is shown once and never persisted."],
            ["Private run evidence", "Screenshots and traces live in a private bucket. No public URL is ever produced, and reads go through short-lived, owner-authorized signed URLs."],
            ["You choose what a run can reach", "Point runs at a preview or staging deployment and keep Stripe in test mode. Vraelis drives the app from the outside, so a run can touch whatever that environment touches."],
            ["Payments via Stripe", "Card data is processed securely by Stripe. Vraelis never sees card numbers. Your billing overview stays in Vraelis."],
          ].map(([t, d]) => (
            <div key={t} className="acard">
              <h3 style={{ fontSize: "clamp(1.05rem, 1.6vw, 1.25rem)", marginBottom: 6 }}>{t}</h3>
              <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.6, margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "20px 0 0", lineHeight: 1.7 }}>We describe what Vraelis actually does. We do not claim formal certifications. If your organization needs specific compliance attestations, <Link href="/contact" style={{ color: "var(--acc-deep)" }}>contact us</Link> to discuss requirements.</p>
      </Section>

      {/* SSO and provisioning honesty */}
      <Section>
        <div className="sec-head" style={{ marginBottom: 20 }}>
          <p className="eyebrow">SSO and provisioning</p>
          <h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.3rem)" }}>Identity, governed and honest.</h2>
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            ["OIDC SSO is available", "Organizations can configure OIDC single sign-on for any verified domain. The id_token is validated (signature, issuer, audience, nonce) and the email domain must match the verified org domain."],
            ["SAML is in preview", "SAML configuration is a scaffold today. The SP metadata endpoint exists, but assertion sign-in is not enabled yet, and we will not pretend it is."],
            ["SCIM is not enabled yet", "Automated provisioning and deprovisioning (SCIM) is planned for larger organizations, not live today."],
            ["Domain provisioning is governed", "A verified-domain match maps a user into the organization at a safe role per your settings. It never grants workspace, project, billing, or API access by itself."],
          ].map(([t, d]) => (
            <li key={t} style={{ borderLeft: "2px solid var(--acc-line)", paddingLeft: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>{t}</div>
              <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.6, margin: 0 }}>{d}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* Plans */}
      <Section bg>
        <div className="sec-head" style={{ marginBottom: 24 }}>
          <p className="eyebrow">Plans</p>
          <h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.3rem)" }}>Recurring plans for standing access.</h2>
          <p>The front door is a free run. These recurring plans are for teams that verify continuously, priced by the run in Production Passes. Some tiers are still rolling out, so talk to us and we will set you up.</p>
        </div>
        <div className="tile-grid cols-3">
          {PLAN_CATALOG_V1.map((p) => (
            <div key={p.key} className="price">
              <div className="price__name">{p.name}</div>
              <div className="price__amt">{usdFromCents(p.monthlyCents)}<small>/mo</small></div>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600, marginTop: 6 }}>Validate {p.passesPerMonth} launches / mo</div>
              <div style={{ fontSize: 13, color: "var(--fg-3)" }}>{PLAN_BLURBS[p.key]}</div>
              <Link className="btn btn--ghost" style={{ marginTop: "auto", justifyContent: "center" }} href="/contact">Talk to us</Link>
            </div>
          ))}
        </div>
        <div className="card" style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap", background: "var(--bg-1)", borderRadius: "var(--r-xl)" }}>
          <div style={{ maxWidth: 640 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, marginBottom: 4 }}>Enterprise: governed preflight at org scale</div>
            <p style={{ fontSize: 14, color: "var(--fg-3)", margin: 0, lineHeight: 1.6 }}>For organizations that need governance, SSO, and audit across many teams. {ENTERPRISE_PERKS.join(", ")}.</p>
          </div>
          <Link className="btn btn--lg" style={{ flex: "none" }} href="/contact">Contact sales</Link>
        </div>
      </Section>

      {/* What Vraelis is not */}
      <Section>
        <div className="sec-head" style={{ marginBottom: 18 }}>
          <p className="eyebrow">For the avoidance of doubt</p>
          <h2 className="display" style={{ fontSize: "clamp(1.5rem, 2.8vw, 2.1rem)" }}>What Vraelis is <span className="em">not</span>.</h2>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {["Not a testing dashboard", "Not a bug list you still have to triage", "Not a numeric quality score", "Not a code writer or auto-deploy", "Not a guarantee, it is a readiness assessment"].map((n) => (
            <span key={n} className="chip" style={{ borderColor: "var(--line-2)", color: "var(--fg-3)" }}>{n}</span>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <section className="section">
        <div className="wrap" style={{ maxWidth: 720, textAlign: "center" }}>
          <h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.3rem)", marginBottom: 18 }}>A launch decision you can defend, before you ship.</h2>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signin?callbackUrl=%2Fapp" className="btn btn--lg">Validate a system</Link>
            <Link href="/developers" className="btn btn--ghost btn--lg">View developer platform</Link>
            <Link href="/contact" className="btn btn--ghost btn--lg">Contact us about enterprise SSO</Link>
          </div>
        </div>
      </section>
    </>
  );
}
