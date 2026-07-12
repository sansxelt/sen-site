import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightOwner } from "@/lib/v-preflight-guard";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { SetupRequired } from "../../setup-required";
import { getApplication } from "@/lib/v-applications";
import { listConnections } from "@/lib/preflight/connections-db";
import { getSetupExtras } from "@/lib/preflight/setup-read";
import { AppTabs } from "../app-tabs";
import { I, EmptyIcon } from "@/app/rank/_components/icons";

export const metadata: Metadata = { title: "Application settings" };

// Friendly labels for the builder the app was created with (raw key falls through).
const BUILDER_LABELS: Record<string, string> = {
  claude_code: "Claude Code", cursor: "Cursor", lovable: "Lovable",
  bolt: "Bolt", replit: "Replit", v0: "v0", other: "Other",
};

const ENV_LABELS: Record<string, string> = { preview: "Preview", staging: "Staging", production: "Production" };

const CONTEXT_KIND_LABELS: Record<string, string> = {
  prompt: "Build prompt", prd: "PRD", requirements: "Requirements",
  readme: "README", risks: "Risks", roles: "Roles",
};

// Stable UTC render (no hydration mismatch): "2026-07-02 14:31 UTC".
function when(iso: string): string {
  try { return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC"; } catch { return ""; }
}

// One key/value row. Missing values read "Not set" (muted), never a blank.
function KV({ k, v }: { k: string; v: string | null }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 13 }}>
      <span style={{ color: "var(--fg-4)", flex: "none" }}>{k}</span>
      <span style={{ color: v ? "var(--fg-1)" : "var(--fg-4)", fontFamily: "var(--font-mono)", fontWeight: v ? 600 : 400, textAlign: "right", wordBreak: "break-all", minWidth: 0 }}>
        {v || "Not set"}
      </span>
    </div>
  );
}

// Uppercase section label + hairline sections, matching the application overview.
const headLbl = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--fg-4)" };
const sectionStyle = { borderTop: "1px solid var(--line-1)", paddingTop: 22, marginTop: 26 } as const;

// One permit row in the boundaries summary: the permit name plus its real On/Off state in text.
function PermitRow({ label, on }: { label: string; on: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 12px", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-1)", fontSize: 12.5 }}>
      <span style={{ color: "var(--fg-2)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 600, color: on ? "var(--acc-deep)" : "var(--fg-4)" }}>{on ? "On" : "Off"}</span>
    </div>
  );
}

// Read-only settings for one application: the details, the real connection graph, the test boundaries a
// pass runs under, and what is still missing. Owner-gated server component. No edit flows exist yet, so
// every section says so honestly instead of faking controls.
export default async function AppSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requirePreflightOwner("/applications/" + id);
  if (!(await preflightDbReady())) return <SetupRequired />;

  const app = await getApplication(owner, id);
  if (!app) {
    return (
      <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
        <div className="empty">
          <EmptyIcon d={I.slash} />
          <h3>Application not found</h3>
          <p>This application doesn&apos;t exist, or it belongs to another account.</p>
          <Link href="/applications" className="btn">Back to applications</Link>
        </div>
      </div>
    );
  }

  // Both reads degrade to empty on a pre-migration schema, so this page renders honest "not recorded"
  // states rather than erroring or inventing data.
  const [connections, extras] = await Promise.all([
    listConnections(owner, id),
    getSetupExtras(owner, id),
  ]);

  const builderLabel = app.builder ? (BUILDER_LABELS[app.builder] ?? app.builder) : null;
  const envLabel = extras.environment ? ENV_LABELS[extras.environment] : null;
  const testAccounts = connections.filter((c) => c.provider === "test_account");
  const otherConnections = connections.filter((c) => c.provider !== "test_account");
  const has = (p: string) => connections.some((c) => c.provider === p);
  const b = extras.boundaries;

  // What is missing, and what each gap actually costs. Real gaps only; when nothing is missing the
  // section says exactly that instead of padding itself.
  const gaps: { what: string; why: string }[] = [];
  if (!envLabel) gaps.push({ what: "Environment not set", why: "Passes and deployments cannot be labeled preview, staging, or production." });
  if (!has("github") && !has("custom_deploy")) gaps.push({ what: "No source connection", why: "Without GitHub or a custom deployment record, passes cannot pin the commit and branch they verified." });
  if (!has("vercel") && !has("custom_deploy")) gaps.push({ what: "No deployment provider", why: "Deployment metadata stays limited to the URL under test." });
  if (testAccounts.length === 0) gaps.push({ what: "No test account", why: "Passes can only exercise signed-out flows. An encrypted test account unlocks signed-in journeys." });
  if (extras.contextSources.length === 0) gaps.push({ what: "No product definition sources", why: "A build prompt, PRD, or requirements doc sharpens the Production Contract Vraelis derives." });

  return (
    <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, marginBottom: 14 }}>
        <Link href="/applications" style={{ color: "var(--fg-4)", textDecoration: "none" }}>Applications</Link>
        <span aria-hidden style={{ color: "var(--fg-5)" }}>/</span>
        <span style={{ color: "var(--fg-2)", fontWeight: 600, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.name}</span>
      </nav>

      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "6px 0 10px" }}>{app.name}</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <a href={app.app_url} target="_blank" rel="noopener noreferrer"
          style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-4)", textDecoration: "none", wordBreak: "break-all" }}>
          {app.app_url}
        </a>
        {envLabel ? <span className="pill" style={{ fontSize: 10.5 }}>{envLabel}</span> : null}
      </div>

      <AppTabs appId={id} active="settings" />

      {/* ── Application details ─────────────────────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: "clamp(18px, 2.4vw, 24px)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16.5, color: "var(--fg-1)", margin: 0 }}>Application details</h2>
        <div style={{ display: "grid", gap: 11, marginTop: 14 }}>
          <KV k="Name" v={app.name} />
          <KV k="URL" v={app.app_url} />
          <KV k="Environment" v={envLabel} />
          <KV k="Builder" v={builderLabel} />
          <KV k="Framework" v={app.framework} />
          <KV k="Connected" v={when(app.created_at)} />
        </div>
      </div>

      {/* ── Connections: compact summary; management lives on the Connections tab ──────────────────── */}
      <section style={sectionStyle} aria-label="Connections">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
          <div style={headLbl}>Connections ({connections.length})</div>
          <Link href={`/applications/${id}/settings/connections`} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--acc-deep)", textDecoration: "none" }}>
            Manage connections
          </Link>
        </div>
        <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55, margin: 0, maxWidth: 640 }}>
          {connections.length
            ? `${otherConnections.length} connection${otherConnections.length === 1 ? "" : "s"} and ${testAccounts.length} test account${testAccounts.length === 1 ? "" : "s"} on file.`
            : "No connections recorded, so passes run with only the application URL."}{" "}
          Editing metadata, health checks, disconnecting, and the audit history live on the Connections tab.
        </p>

        {extras.contextSources.length ? (
          <>
            <div style={{ ...headLbl, margin: "20px 0 10px" }}>Product definition sources ({extras.contextSources.length})</div>
            <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-1)", overflow: "hidden" }}>
              {extras.contextSources.map((src, i) => (
                <div key={`${src.kind}-${i}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", borderTop: i === 0 ? "none" : "1px solid var(--line-1)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span className="pill" style={{ fontSize: 9.5, flex: "none" }}>{CONTEXT_KIND_LABELS[src.kind] ?? src.kind}</span>
                    <span style={{ fontSize: 13, color: "var(--fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{src.name}</span>
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)", flex: "none" }}>{src.chars.toLocaleString("en-US")} chars</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>

      {/* ── Test boundaries ─────────────────────────────────────────────────────────────────────────── */}
      <section style={sectionStyle} aria-label="Test boundaries">
        <div style={{ ...headLbl, marginBottom: 4 }}>Test boundaries</div>
        <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55, margin: "0 0 14px", maxWidth: 640 }}>
          {b
            ? "What passes on this application are permitted to do. Set at connect time; every permit is off unless the owner turned it on."
            : "No boundaries were recorded for this application, so Vraelis treats every permit as off, the most conservative default."}
        </p>
        {b ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 13, marginBottom: 12, maxWidth: 640 }}>
              <span style={{ color: "var(--fg-4)", flex: "none" }}>Allowed domains</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: b.allowed_domains.length ? "var(--fg-1)" : "var(--fg-4)", textAlign: "right", wordBreak: "break-all" }}>
                {b.allowed_domains.length ? b.allowed_domains.join(", ") : "Not set"}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
              <PermitRow label="Account creation" on={b.permit_account_creation} />
              <PermitRow label="Test database writes" on={b.permit_db_writes} />
              <PermitRow label="Test email delivery" on={b.permit_email} />
              <PermitRow label="Test-mode purchases" on={b.permit_test_purchases} />
              <PermitRow label="File upload" on={b.permit_file_upload} />
            </div>
          </>
        ) : null}
        <div style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.6, padding: "12px 14px", borderRadius: "var(--r-sm)", background: "var(--bg-2)", border: "1px solid var(--line-2)", marginTop: 12, maxWidth: 640 }}>
          Always enforced, not configurable: Vraelis never performs destructive actions, never uses live
          payment methods, and never deletes production data.
        </div>
      </section>

      {/* ── What's missing ──────────────────────────────────────────────────────────────────────────── */}
      <section style={sectionStyle} aria-label="Missing context">
        <div style={{ ...headLbl, marginBottom: 4 }}>Missing from this application</div>
        {gaps.length ? (
          <>
            <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55, margin: "0 0 12px", maxWidth: 640 }}>
              Each gap below narrows what a Production Pass can verify. Add connections and test accounts
              any time from the <Link href={`/applications/${id}/settings/connections`} style={{ color: "var(--acc-deep)", fontWeight: 600 }}>Connections tab</Link>.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {gaps.map((g) => (
                <div key={g.what} style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "11px 14px", border: "1px solid var(--line-2)", borderLeft: "3px solid #F3DFB0", borderRadius: "var(--r-sm)", background: "var(--bg-1)" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#B45309", flex: "none" }}>{g.what}</span>
                  <span style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5 }}>{g.why}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p style={{ fontSize: 13, color: "var(--acc-deep)", fontWeight: 600, margin: 0 }}>
            Nothing is missing. Every kind of context Vraelis can use today is on file for this application.
          </p>
        )}
      </section>

      {/* ── Renaming and deletion (honest: not built yet) ───────────────────────────────────────────── */}
      <div className="card" style={{ padding: "clamp(18px, 2.4vw, 24px)", background: "var(--bg-2)", marginTop: 26 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)", margin: 0 }}>Renaming and deletion</h2>
        <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55, margin: "8px 0 0" }}>
          Renaming an application and deleting it from the UI are coming. Until then, contact support and
          we&apos;ll make the change for you.
        </p>
      </div>
    </div>
  );
}
