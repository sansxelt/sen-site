import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { workspaceActivity, organizationActivity, type AuditEntry } from "@/lib/v-audit";
import { getPrimaryOrganization, canViewOrganizationAudit } from "@/lib/v-organization";
import { AuditExport } from "./audit-export";
import { Page, PageHeader, SECTION_TITLE } from "@/app/rank/_components/page-header";

// THE TAB AND THE HEADING DISAGREED, AND WHICH ONE YOU GOT DEPENDED ON THE URL.
//
// This page renders <h1>Records</h1> and is what the sidebar's "Records" item opens, but its tab said
// "Activity & trust", the name from before the rename. /records re-exports this same component with its own
// metadata reading "Records", so the identical page put two different names in the browser tab depending on
// whether you arrived by the old /activity bookmark or the current /records link. The heading is the name
// the navigation promises, so the tab matches it. The heading itself is untouched.
export const metadata: Metadata = { title: "Records" };

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

// Section titles use the console's one section style. These were 12.5px grey code type, so "Workspace
// activity" read as a caption rather than as the heading of the thing this page exists to show.
const cardHead = { ...SECTION_TITLE, margin: "32px 0 12px" } as const;
// The trail is read newest first and the first screen is what gets read. A hundred rows rendered in one
// column made the page 4,800px tall; the rest stays one click away, with nothing hidden from the export.
const FIRST_ROWS = 20;

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
  const row = (e: AuditEntry, i: number) => (
        <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 18px", borderTop: i === 0 ? "none" : "1px solid var(--line-1)", flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, color: "var(--fg-1)", fontWeight: 500 }}>
              {e.label}
              {e.subject ? <span style={{ color: "var(--fg-3)", fontWeight: 400 }}>, “{e.subject}”</span> : null}
            </div>
            <div style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)", marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span className="pill" style={{ color: e.actor === "System" ? "var(--fg-4)" : "var(--acc-deep)" }}>{e.actor}</span>
              <span className="pill" style={{ color: "var(--fg-4)" }}>{e.category}</span>
              {e.context ? <span>{e.context}</span> : null}
            </div>
          </div>
          <span title={absWhen(e.when)} style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-5)", whiteSpace: "nowrap" }}>{when(e.when)}</span>
        </div>
  );
  const first = events.slice(0, FIRST_ROWS);
  const rest = events.slice(FIRST_ROWS);
  return (
    <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--bg-1)", boxShadow: "var(--shadow-sm)" }}>
      {first.map(row)}
      {rest.length > 0 ? (
        <details className="rec-more">
          <summary style={{ cursor: "pointer", padding: "11px 18px", borderTop: "1px solid var(--line-1)", fontSize: 13, fontWeight: 500, color: "var(--acc-deep)", listStyle: "none" }}>Show {rest.length} more</summary>
          {rest.map((e, i) => row(e, i + 1))}
        </details>
      ) : null}
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
  ["Client viewer access", "Read-only report access", "/team"],
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
    <Page measure="prose">
      <PageHeader
        title="Records"
        lead="A read-only trail of everything that happens in your workspace: verifications, balance, billing, team access, and governance."
        actions={<Link href="/enterprise" className="btn btn--ghost">Trust overview →</Link>}
      />

      {/* <Page> owns the measure and the shell overrides only padding-TOP, so the tail room this page has
          always had is kept here, on the content. Every sibling page carries the same 80px; without it the
          last row sat flush against the bottom of the window on this page alone. */}
      <div style={{ paddingBottom: 80 }}>

        {/* The trail first: it is what this page is named for. It used to sit under an info panel, the export
            and an eight-card index, below the first screen. */}
        <h2 style={{ ...cardHead, marginTop: 0 }}>Workspace activity</h2>
        <EventList events={events}
          empty="System connections, verification launches and completions, credit top-ups, exports, billing actions, invites, and role changes are recorded here as you work."
          action={{ href: "/systems", label: "Go to systems" }} />
        <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "10px 0 0", lineHeight: 1.6 }}>Activity never includes payment details, Stripe identifiers, invite or DNS tokens, token hashes, webhook secrets, OIDC codes, SAML assertions, or raw run evidence.</p>

        {/* Organization activity */}
        {org && canOrgAudit && (
          <>
            <h2 style={cardHead}>Organization activity, {org.name}</h2>
            <EventList events={orgEvents}
              empty="Organization, domain, SSO, and provisioning changes are recorded here. Verify a domain or invite a member and the event shows up immediately."
              action={{ href: "/organization", label: "Manage organization" }} />
          </>
        )}

        <h2 style={cardHead}>Export</h2>
        <AuditExport showOrg={!!(org && canOrgAudit)} />
        <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "10px 0 0", lineHeight: 1.6 }}>Sanitized CSV or JSON for your own records. Scheduled exports and retention controls are planned; if you need them now, <Link href="/contact" style={{ color: "var(--acc-deep)" }}>tell us what you need</Link>.</p>

        <h2 style={cardHead}>Trust controls</h2>
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

        {org && !canOrgAudit && (
          <p style={{ fontSize: 12, color: "var(--fg-5)", margin: "18px 0 0", lineHeight: 1.6 }}>Organization-level activity is visible to organization owners and admins.</p>
        )}
      </div>
    </Page>
  );
}
