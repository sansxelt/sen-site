import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security & trust",
  description: "Enterprise trust for human-evaluation workflows — governed access, verified organization domains, audit-ready decision records, and controlled human signal. OIDC SSO for verified domains; SAML in preview; SCIM planned.",
};

const PROTECTS: [string, string][] = [
  ["Decision workflows", "Every evaluation runs through a governed pipeline — qualified signal, readiness, confirmation rounds, and a Decision Package — not an open comment box."],
  ["Organization access", "Organizations sit above workspaces with roles, admins, and membership governance, so access maps to who should have it."],
  ["Client-safe reports", "Share a read-only decision report by token; private controls, costs, internals, and participant data never travel with it."],
  ["SSO & domain-based access", "OIDC single sign-on and verified-domain provisioning bind access to identities your organization already controls."],
  ["Billing & admin boundaries", "Billing admins manage payment without owning data or members; ownership transfer is a deliberate, guarded action."],
  ["Audit activity", "Member, domain, SSO, billing-admin, ownership, and confirmation-round changes are recorded as a safe, reviewable trail."],
  ["Decision Packages & exports", "Structured outputs and exports carry the decision — not account emails, share tokens, IPs, or raw participant data."],
];

const CONTROLS: string[] = [
  "Organizations & workspaces", "Project-level access", "Client-safe report sharing", "Role-based access (admin / editor / viewer / client)",
  "Billing-admin separation", "Ownership-transfer controls", "Tokenized, expiring invites", "Verified organization domains",
  "Domain-based provisioning (governed)", "OIDC single sign-on", "Periodic domain re-verification", "Read-only audit activity", "Sanitized audit export (CSV / JSON)",
];

const Section = ({ children, bg }: { children: React.ReactNode; bg?: boolean }) => (
  <section className="section" style={bg ? { background: "var(--bg-2)" } : undefined}>
    <div className="wrap" style={{ maxWidth: 920 }}>{children}</div>
  </section>
);

export default function SecurityPage() {
  return (
    <>
      {/* Hero */}
      <section className="section" style={{ borderBottom: "1px solid var(--line-1)" }}>
        <div className="wrap" style={{ maxWidth: 820, textAlign: "center" }}>
          <p className="eyebrow" style={{ justifyContent: "center" }}>Security &amp; trust</p>
          <h1 className="display" style={{ fontSize: "clamp(2rem, 4.4vw, 3rem)", marginBottom: 16 }}>Enterprise trust for human-evaluation workflows.</h1>
          <p className="lead-copy" style={{ margin: "0 auto 26px", maxWidth: 680 }}>Vraelis helps teams collect qualified human signal, govern access, verify organization domains, and produce audit-ready decision records before shipping creative, AI, or product work. It&apos;s decision infrastructure — not a voting widget.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/app/new" className="btn btn--lg">Start an evaluation</a>
            <a href="/developers" className="btn btn--ghost btn--lg">View developer platform</a>
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
          {PROTECTS.map(([t, d]) => (
            <div key={t} className="acard">
              <h3 style={{ fontSize: "clamp(1.05rem, 1.6vw, 1.25rem)", marginBottom: 6 }}>{t}</h3>
              <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.6, margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Governance controls */}
      <Section bg>
        <div className="sec-head" style={{ marginBottom: 24 }}>
          <p className="eyebrow">Governance controls</p>
          <h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.3rem)" }}>Controls that exist today.</h2>
          <p>The access, identity, and sharing controls a team can use to defend a decision internally.</p>
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
        <p className="lead-copy" style={{ marginBottom: 14 }}>Workspace and organization activity are recorded as a read-only audit trail. Owners and admins review recent governance events in-app at <a href="/app/audit" style={{ color: "var(--acc-deep)" }}>Activity</a>, and can <strong style={{ color: "var(--fg-1)" }}>export sanitized governance activity as CSV or JSON</strong>. Scheduled exports and retention controls are planned.</p>
        <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.8, margin: 0 }}>Vraelis records key governance events — organization changes, domain verification and re-verification, SSO provider changes, billing-admin changes, confirmation rounds, ownership transfers, and team-access updates. Audit events carry only safe fields: <strong style={{ color: "var(--fg-1)" }}>no secrets, no invite or DNS tokens, no token hashes, no Stripe identifiers, no API keys, no OIDC codes or SAML assertions, no certificate bodies, no full URLs, and no IP or device data.</strong></p>
      </Section>

      {/* Data handling */}
      <Section bg>
        <div className="sec-head" style={{ marginBottom: 24 }}>
          <p className="eyebrow">Data handling</p>
          <h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.3rem)" }}>Honest about what we store and how.</h2>
        </div>
        <div className="tile-grid cols-2">
          {[
            ["No raw secrets in audit", "Event metadata is whitelisted to safe fields; emails, tokens, hashes, and Stripe ids are filtered out before anything is recorded or shown."],
            ["OIDC secrets encrypted", "An organization's OIDC client secret is encrypted at rest (AES-256-GCM) and never returned to the client or logged."],
            ["DNS tokens hashed", "Domain verification stores only the SHA-256 of the DNS TXT token; the raw token is shown once and never persisted."],
            ["Client-safe reports", "Reports can be shared so clients see the decision and reasoning — never private controls, costs, or participant identities."],
            ["Payments via Stripe", "Card data is processed securely by Stripe; Vraelis never sees card numbers. Your billing overview — plan, seats, renewal, invoices — stays in Vraelis."],
            ["Participant privacy", "Source and signal quality are captured privacy-safely — channel and hostname only, never full referrers or personal data."],
          ].map(([t, d]) => (
            <div key={t} className="acard">
              <h3 style={{ fontSize: "clamp(1.05rem, 1.6vw, 1.25rem)", marginBottom: 6 }}>{t}</h3>
              <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.6, margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "20px 0 0", lineHeight: 1.7 }}>We describe what Vraelis actually does. We do not claim formal certifications. If your organization needs specific compliance attestations, <a href="mailto:hello@vraelis.com?subject=Vraelis%20security%20%26%20compliance" style={{ color: "var(--acc-deep)" }}>contact us</a> to discuss requirements.</p>
      </Section>

      {/* SSO & provisioning honesty */}
      <Section>
        <div className="sec-head" style={{ marginBottom: 20 }}>
          <p className="eyebrow">SSO &amp; provisioning</p>
          <h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.3rem)" }}>Identity, governed and honest.</h2>
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            ["OIDC SSO is available", "Organizations can configure OIDC single sign-on for any verified domain. The id_token is validated (signature, issuer, audience, nonce) and the email domain must match the verified org domain."],
            ["SAML is in preview", "SAML configuration is a scaffold today — the SP metadata endpoint exists, but assertion sign-in is not enabled yet. We won't pretend it is."],
            ["SCIM is not enabled yet", "Automated provisioning/deprovisioning (SCIM) is planned for larger organizations, not live today."],
            ["Domain provisioning is governed", "A verified-domain match maps a user into the organization at a safe role per your settings — it never grants workspace, project, billing, or API access by itself."],
          ].map(([t, d]) => (
            <li key={t} style={{ borderLeft: "2px solid var(--acc-line-2)", paddingLeft: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>{t}</div>
              <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.6, margin: 0 }}>{d}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* What Vraelis is not */}
      <Section bg>
        <div className="sec-head" style={{ marginBottom: 18 }}>
          <p className="eyebrow">For the avoidance of doubt</p>
          <h2 className="display" style={{ fontSize: "clamp(1.5rem, 2.8vw, 2.1rem)" }}>What Vraelis is <span className="em">not</span>.</h2>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {["Not a voting widget", "Not a poll or survey product", "Not a thumbnail or icon testing app", "Not an ad network or traffic monetization", "Not just analytics over responses"].map((n) => (
            <span key={n} className="chip" style={{ borderColor: "var(--line-2)", color: "var(--fg-3)" }}>{n}</span>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <section className="section">
        <div className="wrap" style={{ maxWidth: 720, textAlign: "center" }}>
          <h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.3rem)", marginBottom: 18 }}>Defensible decisions, before you ship.</h2>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/app/new" className="btn btn--lg">Start an evaluation</a>
            <a href="/developers" className="btn btn--ghost btn--lg">View developer platform</a>
            <a href="mailto:hello@vraelis.com?subject=Vraelis%20enterprise%20SSO" className="btn btn--ghost btn--lg">Contact us about enterprise SSO</a>
          </div>
        </div>
      </section>
    </>
  );
}
