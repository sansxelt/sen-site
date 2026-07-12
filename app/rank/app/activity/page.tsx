import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { workspaceActivity, organizationActivity, type AuditEntry } from "@/lib/v-audit";
import { getPrimaryOrganization, canViewOrganizationAudit } from "@/lib/v-organization";
import { AuditExport } from "./audit-export";

export const metadata: Metadata = { title: "Activity & trust" };

const when = (iso: string) => {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// Absolute UTC render for the hover title, so a humanized time is always verifiable: "2026-07-02 14:31 UTC".
const absWhen = (iso: string) => {
  try { return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC"; } catch { return ""; }
};

const cardHead = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", margin: "28px 0 12px" } as const;

// Event trail with a purposeful empty state: what will appear here, plus the one action that starts
// filling it (never a bare card).
function EventList({ events, empty, action }: { events: AuditEntry[]; empty: string; action: { href: string; label: string } }) {
  if (events.length === 0) {
    return (
      <div className="empty" style={{ padding: "clamp(22px, 3vw, 34px)" }}>
        <h3 style={{ fontSize: 16 }}>No activity recorded yet</h3>
        <p style={{ fontSize: 13 }}>{empty}</p>
        <Link href={action.href} className="btn btn--ghost">{action.label}</Link>
      </div>
    );
  }
  return (
    <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--bg-1)", boxShadow: "var(--shadow-sm)" }}>
      {events.map((e, i) => (
        <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 18px", borderTop: i === 0 ? "none" : "1px solid var(--line-1)", flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, color: "var(--fg-1)", fontWeight: 500 }}>
              {e.label}
              {e.subject ? <span style={{ color: "var(--fg-3)", fontWeight: 400 }}>, “{e.subject}”</span> : null}
            </div>
            <div style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)", marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span className="pill" style={{ fontSize: 9.5, color: e.actor === "System" ? "var(--fg-4)" : "var(--acc-deep)" }}>{e.actor}</span>
              <span className="pill" style={{ fontSize: 9.5, color: "var(--fg-4)" }}>{e.category}</span>
              {e.context ? <span>{e.context}</span> : null}
            </div>
          </div>
          <span title={absWhen(e.when)} style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-5)", whiteSpace: "nowrap" }}>{when(e.when)}</span>
        </div>
      ))}
    </div>
  );
}

const TRUST_CONTROLS: [string, string, string][] = [
  ["Organization", "Members, roles & domains", "/organization"],
  ["Verified domains", "DNS ownership & health", "/organization"],
  ["Single sign-on", "OIDC for verified domains", "/organization"],
  ["Domain provisioning", "Governed join / approval", "/organization"],
  ["Team roles", "Access per member", "/team"],
  ["Billing admins", "Billing without ownership", "/billing"],
  ["Client-safe sharing", "Read-only report access", "/team"],
  ["API & webhooks", "Keys & signed deliveries", "/api"],
];

export default async function AuditPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Fapp%2Faudit");
  const events = await workspaceActivity(email, 100);
  const org = await getPrimaryOrganization(email);
  const canOrgAudit = org ? await canViewOrganizationAudit(email, org.id) : false;
  const orgEvents = org && canOrgAudit ? await organizationActivity(email, org.id, 60) : [];

  return (
    <div className="wrap" style={{ maxWidth: 880, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Trust &amp; governance</p>
          <h1 className="display">Activity</h1>
          <p>A read-only trail of everything that happens in your workspace, evaluations, credits, billing, team access, and governance.</p>
        </div>
        <Link href="/enterprise" className="btn btn--ghost">Trust overview →</Link>
      </div>

      <div className="card" style={{ background: "var(--bg-2)", marginBottom: 18 }}>
        <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: 0, lineHeight: 1.6 }}>Vraelis records your evaluation runs, credit top-ups, exports, billing changes, team access, and governance events, organization changes, domain verification, SSO, ownership transfers. Activity never includes participant identities, payment details, Stripe identifiers, invite or DNS tokens, token hashes, webhook secrets, OIDC codes, SAML assertions, or raw evaluation data.</p>
      </div>

      {/* Export */}
      <div style={cardHead}>Audit export</div>
      <AuditExport showOrg={!!(org && canOrgAudit)} />
      <p style={{ fontSize: 11.5, color: "var(--fg-5)", margin: "10px 0 0", lineHeight: 1.6 }}>Export the governance trail as sanitized CSV or JSON for your own records. Organization-wide governance, verified domains, OIDC SSO, and scheduled exports with retention controls are part of the enterprise trust layer, <Link href="/contact" style={{ color: "var(--acc-deep)" }}>talk to us about enterprise requirements →</Link></p>

      {/* Trust controls */}
      <div style={cardHead}>Trust controls</div>
      <div className="tile-grid cols-2" style={{ gap: 10 }}>
        {TRUST_CONTROLS.map(([t, d, href]) => (
          <Link key={t + d} href={href} className="card" style={{ textDecoration: "none", color: "inherit", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "13px 16px" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{t}</div>
              <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 1 }}>{d}</div>
            </div>
            <span style={{ color: "var(--acc-deep)", fontSize: 13 }}>→</span>
          </Link>
        ))}
      </div>

      {/* Workspace activity */}
      <div style={cardHead}>Workspace activity</div>
      <EventList events={events}
        empty="Application connections, Production Pass launches and completions, credit top-ups, exports, billing actions, invites, and role changes are recorded here as you work."
        action={{ href: "/applications", label: "Go to applications" }} />

      {/* Organization activity */}
      {org && canOrgAudit && (
        <>
          <div style={cardHead}>Organization activity, {org.name}</div>
          <EventList events={orgEvents}
            empty="Organization, domain, SSO, and provisioning changes are recorded here. Verify a domain or invite a member and the event shows up immediately."
            action={{ href: "/organization", label: "Manage organization" }} />
          <p style={{ fontSize: 11, color: "var(--fg-5)", margin: "10px 0 0", lineHeight: 1.6 }}>Account-level governance events. Organization and workspace activity can be exported as sanitized CSV or JSON above. Scheduled exports and retention controls are planned.</p>
        </>
      )}
      {org && !canOrgAudit && (
        <p style={{ fontSize: 12, color: "var(--fg-5)", margin: "18px 0 0", lineHeight: 1.6 }}>Organization-level activity is visible to organization owners and admins.</p>
      )}
    </div>
  );
}
