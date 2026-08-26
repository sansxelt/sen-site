import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightAppAccess } from "@/lib/v-preflight-guard";
import { capabilities } from "@/lib/preflight/role-capabilities";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { SetupRequired } from "../../../setup-required";
import { getApplication } from "@/lib/v-applications";
import { listConnections } from "@/lib/preflight/connections-db";
import { listAccountConnections } from "@/lib/preflight/account-connections-db";
import { listAppLinks } from "@/lib/preflight/connection-links-db";
import { recentConnectionEvents } from "@/lib/v-events";
import { AppTabs } from "../../app-tabs";
import { AppConnectionLinks } from "./app-connection-links";
import { I, EmptyIcon } from "@/app/rank/_components/icons";
import { PROVIDER_LABELS, CONNECTION_EVENT_LABELS, whenUtc } from "@/lib/preflight/connection-display";
import { ConnectionsManager } from "./connections-manager";

export const metadata: Metadata = { title: "Connections" };

// Connection management for one application: every connection as a card (state, safe metadata, what
// Vraelis uses it for, what it never accesses), with edit / verify / disconnect / replace actions and
// the last ten audit events. Owner-gated server component; the interactive half re-syncs this page
// with router.refresh() after each action, so the cards always show what the database holds.
export default async function AppConnectionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // VIEWER, not editor — same reasoning as the settings page: every control here is behind canManage and
  // every route it calls re-checks editor for itself, so the page gate was hiding read-only content
  // rather than protecting anything.
  //
  // ONE READ DOES NOT FOLLOW THE GATE DOWN. See below: listAccountConnections is ACCOUNT-scoped.
  const access = await requirePreflightAppAccess(id, "/systems/" + id + "/settings/connections");
  const owner = access?.owner ?? "";
  const caps = capabilities(access?.role);
  if (!(await preflightDbReady())) return <SetupRequired />;

  const app = await getApplication(owner, id);
  if (!app) {
    return (
      <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
        <div className="empty">
          <EmptyIcon d={I.slash} />
          <h3>System not found</h3>
          <p>This system doesn&apos;t exist, or it belongs to another account.</p>
          <Link href="/systems" className="btn">Back to systems</Link>
        </div>
      </div>
    );
  }

  // listConnections / recentConnectionEvents / listAppLinks are all scoped to THIS application, so a
  // viewer of this application is entitled to them — the connections GET route already serves viewers.
  //
  // listAccountConnections is NOT: it is keyed on the owner's ACCOUNT and returns every provider they have
  // authorized, including the account labels, for applications this member may have no access to at all.
  // Lowering the page gate without noticing that would have turned a UX fix into a disclosure — one app's
  // viewer reading the owner's whole integration inventory. It is fetched only for the role that can act
  // on it, so a read-only member never causes the query, let alone sees the result.
  const [connections, events, appLinks] = await Promise.all([
    listConnections(owner, id),
    recentConnectionEvents(owner, id, 10),
    listAppLinks(owner, id),
  ]);
  const accountConns = caps.canManageConnections ? await listAccountConnections(owner) : [];

  return (
    <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, marginBottom: 14 }}>
        <Link href="/systems" style={{ color: "var(--fg-4)", textDecoration: "none" }}>Systems</Link>
        <span aria-hidden style={{ color: "var(--fg-5)" }}>/</span>
        <span style={{ color: "var(--fg-2)", fontWeight: 600, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.name}</span>
      </nav>

      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "6px 0 10px" }}>{app.name}</h1>
      <a href={app.app_url} target="_blank" rel="noopener noreferrer"
        style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-4)", textDecoration: "none", wordBreak: "break-all" }}>
        {app.app_url}
      </a>

      <AppTabs appId={id} active="connections" />

      <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.6, margin: "0 0 22px", maxWidth: 680 }}>
        What Vraelis knows about this system&apos;s source, deployment, data, and services. Providers are
        authorized once on your account&apos;s <Link href="/connections" style={{ color: "var(--acc-deep)" }}>Connections</Link> page,
        then this app selects which repo or project to use. Manual metadata connections are also available below.
      </p>

      {accountConns.length > 0 ? (
        <AppConnectionLinks appId={id} accountConnections={accountConns.map((c) => ({ id: c.id, provider: c.provider, label: (c.meta.account as string) || c.provider }))}
          links={appLinks.map((l) => ({ provider: l.provider, accountConnectionId: l.accountConnectionId, selection: l.selection }))} canManage={caps.canManageConnections} />
      ) : null}

      <ConnectionsManager appId={id} connections={connections} canManage={caps.canManageConnections} />

      {/* ── Audit history: the last 10 connection events for this application ─────────────────────────── */}
      <section aria-label="Connection activity" style={{ borderTop: "1px solid var(--line-1)", paddingTop: 22, marginTop: 26 }}>
        <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 4 }}>
          Connection activity
        </div>
        <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55, margin: "0 0 12px", maxWidth: 640 }}>
          The most recent connection events on this system, up to 10. Events record the action and
          the provider only, never metadata values or credentials.
        </p>
        {events.length ? (
          <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-1)", overflow: "hidden" }}>
            {events.map((e, i) => {
              const provider = typeof e.metadata?.provider === "string" ? e.metadata.provider : "";
              return (
                <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", borderTop: i === 0 ? "none" : "1px solid var(--line-1)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span className="pill" style={{ fontSize: 9.5, flex: "none" }}>{CONNECTION_EVENT_LABELS[e.event_type] ?? e.event_type}</span>
                    <span style={{ fontSize: 13, color: "var(--fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {provider ? (PROVIDER_LABELS[provider] ?? provider) : "Connection"}
                    </span>
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)", flex: "none" }}>{whenUtc(e.created_at)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--fg-4)", margin: 0 }}>
            No connection activity recorded yet. Adding, editing, verifying, or removing a connection will
            appear here.
          </p>
        )}
      </section>
    </div>
  );
}
