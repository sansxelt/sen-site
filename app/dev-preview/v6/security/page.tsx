import type { CSSProperties } from "react";
import { v6meta } from "../_system/meta";
import { PageHero, Reveal, SectionHead, Signal, CTA, EditorialLink } from "../_system/ui";
import { V6_BASE } from "@/lib/v6-routes";

export const metadata = v6meta({
  title: "Security",
  description:
    "How Vraelis handles access, secrets, and evidence: owner-scoped access, separation of duties, private evidence with short-lived signed URLs, AES-256-GCM secrets at rest, hashed DNS tokens, sanitized audit export, and validated OIDC. Honest about what is not yet in place.",
  path: "/security",
  type: "website",
});

const BASE = V6_BASE;
const ANCHOR: CSSProperties = { scrollMarginTop: 88 };

type SigState = "go" | "wait" | "stop";

/* system status: what is actually operational */
const STATUS: [string, SigState, string][] = [
  ["Verification engine", "go", "Operational"],
  ["Real-browser execution and evidence capture", "go", "Operational"],
  ["Private evidence storage and signed URLs", "go", "Operational"],
  ["OIDC single sign-on", "go", "Operational"],
  ["Audit activity and sanitized export", "go", "Operational"],
  ["SAML single sign-on", "wait", "Preview"],
  ["SCIM provisioning", "wait", "Planned"],
];

/* the model: three principles */
const MODEL: [string, string, string][] = [
  ["01", "Owner-scoped access", "Every connected application carries an explicit owner, and an I own or authorized this confirmation is required before a run can touch it. Access is scoped to the people and identities that should have it, not opened to anyone who can reach the system."],
  ["02", "Separation of duties", "A billing admin manages payment without owning data or members, and ownership transfer is a deliberate, guarded action. In the same spirit, the agent that builds a system does not approve its own proof; completion is judged on independent evidence."],
  ["03", "Least authority over your environment", "You choose what a run can reach. Point Vraelis at a preview or staging deployment and keep external services in test mode. Vraelis drives the app from the outside, so a run touches only what that environment already touches."],
];

/* architecture and data handling: defensible, real */
const CONTROLS: [string, string][] = [
  ["Owner-authorized signed URLs", "Screenshots and traces live in a private bucket. No public URL is ever produced. Reads go through short-lived signed URLs that only an authorized owner can mint."],
  ["Secrets encrypted at rest", "An organization's OIDC client secret is encrypted at rest with AES-256-GCM. It is never returned to the client and never written to logs."],
  ["DNS tokens are hashed", "Domain verification stores only the SHA-256 of the DNS TXT token. The raw token is shown once and never persisted."],
  ["Sanitized audit export", "Governance activity exports as CSV or JSON against a whitelist of safe fields: no secrets, invite or DNS tokens, token hashes, Stripe identifiers, API keys, OIDC codes, SAML assertions, certificate bodies, full URLs, or IP and device data."],
  ["Validated OIDC sign-in", "The id_token is validated on signature, issuer, audience, and nonce, and the email domain must match the verified organization domain before access is granted."],
  ["Governed domain provisioning", "A verified-domain match maps a user into the organization at a safe role. It never grants workspace, project, billing, or API access on its own."],
  ["Payments isolated to Stripe", "Card data is processed by Stripe. Vraelis never sees card numbers. Your billing overview stays in Vraelis."],
  ["The builder does not self-approve", "An agent cannot mark its own work trusted. Proof comes from exercising the running software and computing a decision on the evidence, not from the agent's report."],
];

/* identity and access, described honestly */
const IDENTITY: [string, SigState, string, string][] = [
  ["OIDC single sign-on", "go", "Available", "Organizations can configure OIDC for any verified domain, with full token validation and a domain-match requirement before a user is admitted."],
  ["SAML single sign-on", "wait", "Preview", "The SP metadata endpoint exists, but assertion sign-in is not enabled yet, and we do not present it as if it were."],
  ["SCIM provisioning", "wait", "Planned", "Automated provisioning and deprovisioning is planned for larger organizations. It is not live today."],
  ["Domain provisioning", "go", "Governed", "A domain match maps users into the organization at a safe role and never grants elevated access by itself."],
];

/* honest limits */
const LIMITS: string[] = [
  "No formal compliance certifications. Vraelis is not SOC 2 certified, and we will not display seals we have not earned.",
  "SAML sign-in is in preview and SCIM is planned. Neither is presented as live.",
  "Scheduled audit exports and retention controls are a direction, not a built feature.",
  "Vraelis assesses and oversees. It is not a guarantee, and it does not replace your own security review of the environment you point it at.",
];

export default function SecurityPage() {
  return (
    <>
      <PageHero
        kicker="Security"
        title="Security built around independent oversight."
        lead="Vraelis judges work that agents produce, so the party doing the work is never the party that approves it. This is how access, secrets, and evidence are handled today, and an honest account of what is not yet in place."
        cta={<><CTA brand>Open Vraelis</CTA><EditorialLink href="#status">See system status</EditorialLink></>}
      />

      {/* The model */}
      <section className="v6-sec">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="The model"
              title="Access maps to who should have it, and the judge is separate from the builder."
              lead="Three principles sit under everything below: scope access to the right people, keep sensitive duties apart, and give a run the least authority it needs."
            />
          </Reveal>
          <div className="v6-rows">
            {MODEL.map(([n, t, d], i) => (
              <Reveal key={t} i={i}>
                <div className="v6-row">
                  <span className="v6-row__n">{n}</span>
                  <div>
                    <h3 className="v6-row__t">{t}</h3>
                    <p className="v6-row__d">{d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* System status (graphite) */}
      <section className="v6-sec v6-dark" data-nav-dark id="status" style={ANCHOR}>
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="System status"
              title="What is operational."
              lead="An honest read of what you can use today, what is in preview, and what is committed but not yet live."
            />
          </Reveal>
          <Reveal media>
            <div style={{ marginTop: "clamp(28px,3vw,40px)", maxWidth: 760, border: "1px solid var(--g-line)", borderRadius: 14, overflow: "hidden" }}>
              {STATUS.map(([name, state, label], i) => (
                <div key={name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 20px", borderTop: i ? "1px solid var(--g-line)" : "none" }}>
                  <span style={{ color: "var(--g-fg)", fontSize: 15, fontWeight: 500, minWidth: 0 }}>{name}</span>
                  <Signal state={state}>{label}</Signal>
                </div>
              ))}
            </div>
            <p style={{ margin: "16px 0 0", fontSize: 13, lineHeight: 1.6, color: "var(--g-fg-3)", maxWidth: 760 }}>
              Operational means available to use today. Preview means present but not enabled for sign-in. Planned means committed direction, not a live feature.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Architecture and data handling (graphite) */}
      <section className="v6-sec v6-dark" data-nav-dark>
        <div className="v6-wrap v6-wrap--wide">
          <Reveal>
            <SectionHead
              eyebrow="Architecture and data handling"
              title="What we store, and how it is protected."
              lead="These are the controls in place now. Each one is a specific decision about where data lives and who can reach it."
            />
          </Reveal>
          <Reveal media className="v6-grid3">
            {CONTROLS.map(([t, d]) => (
              <div key={t} style={{ background: "var(--graphite-2)", border: "1px solid var(--g-line)", borderRadius: 14, padding: "clamp(22px,2.4vw,28px)" }}>
                <h3 style={{ margin: "0 0 8px", fontSize: "1.12rem", fontWeight: 600, letterSpacing: "-0.015em", color: "var(--g-fg)" }}>{t}</h3>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--g-fg-2)" }}>{d}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Identity and access */}
      <section className="v6-sec v6-sec--sunk">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Identity"
              title="Single sign-on, described honestly."
              lead="What is live today, and what is still a direction. We separate the two rather than blur them."
            />
          </Reveal>
          <ul style={{ listStyle: "none", margin: "clamp(28px,3vw,40px) 0 0", padding: 0 }}>
            {IDENTITY.map(([t, state, label, d], i) => (
              <Reveal key={t} i={i}>
                <li style={{ padding: "clamp(20px,2.4vw,28px) 0", borderTop: i ? "1px solid var(--line)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    <span style={{ fontSize: "clamp(1.05rem,1.4vw,1.25rem)", fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.015em" }}>{t}</span>
                    <Signal state={state}>{label}</Signal>
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.6, color: "var(--ink-3)", maxWidth: "64ch" }}>{d}</p>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* Honest limits */}
      <section className="v6-sec">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Honest limits"
              title="What we do not claim."
              lead="We describe what Vraelis actually does. We do not claim formal certifications, and we do not display compliance seals."
            />
          </Reveal>
          <ul style={{ listStyle: "none", margin: "clamp(28px,3vw,40px) 0 0", padding: 0, maxWidth: 820 }}>
            {LIMITS.map((t, i) => (
              <Reveal key={t} i={i}>
                <li style={{ display: "flex", gap: 14, padding: "16px 0", borderTop: i ? "1px solid var(--line)" : "none" }}>
                  <span aria-hidden style={{ flex: "none", width: 7, height: 7, borderRadius: 999, border: "1px solid var(--ink-4)", marginTop: 9 }} />
                  <span style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--ink-2)" }}>{t}</span>
                </li>
              </Reveal>
            ))}
          </ul>
          <Reveal>
            <p style={{ margin: "clamp(24px,2.6vw,32px) 0 0", fontSize: 14, lineHeight: 1.7, color: "var(--ink-3)", maxWidth: 720 }}>
              If your organization needs specific compliance attestations, talk to the team about requirements before you rely on Vraelis for them.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Close */}
      <hr className="v6-rule" />
      <section className="v6-sec v6-sec--tight">
        <div className="v6-wrap" style={{ textAlign: "center", maxWidth: 720 }}>
          <Reveal>
            <h2 className="v6-dl" style={{ marginInline: "auto" }}>Oversight you can inspect, not take on faith.</h2>
            <p className="v6-lead" style={{ margin: "18px auto 28px", textAlign: "center" }}>The same standard we hold agent work to is the one we hold ourselves to: describe what is real, and show the seams.</p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <CTA brand lg>Open Vraelis</CTA>
              <EditorialLink href={`${BASE}/company#contact`}>Contact the team</EditorialLink>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
