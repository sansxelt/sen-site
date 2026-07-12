import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightOwner } from "@/lib/v-preflight-guard";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { SetupRequired } from "../../setup-required";
import { getApplication } from "@/lib/v-applications";
import { listConnections, type SafeConnection } from "@/lib/preflight/connections-db";
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

// The connection graph's display vocabulary: what each provider is called and which part of the
// application it covers. Unknown providers fall through to their raw key (honest, never invented).
const PROVIDER_LABELS: Record<string, string> = {
  github: "GitHub", vercel: "Vercel", custom_deploy: "Custom deployment",
  supabase: "Supabase", custom_auth: "Custom auth", stripe_test: "Stripe test mode",
  sentry: "Sentry", openapi: "OpenAPI", webhook: "Webhook", test_account: "Test account",
};
const PROVIDER_GROUP: Record<string, string> = {
  github: "Source", vercel: "Deployment", custom_deploy: "Deployment",
  supabase: "Data", custom_auth: "Auth", stripe_test: "Billing",
  sentry: "Monitoring", openapi: "Services", webhook: "Services", test_account: "Credentials",
};

const CONTEXT_KIND_LABELS: Record<string, string> = {
  prompt: "Build prompt", prd: "PRD", requirements: "Requirements",
  readme: "README", risks: "Risks", roles: "Roles",
};

// Stable UTC render (no hydration mismatch): "2026-07-02 14:31 UTC".
function when(iso: string): string {
  try { return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC"; } catch { return ""; }
}

function hostnameOf(u: string): string {
  try { return new URL(u).hostname; } catch { return u; }
}

// The safe one-line summary of a connection's metadata (metadata is the non-secret half by contract;
// secrets never reach this module, see connections-db). Null when the row carries nothing displayable.
function metaSummary(c: SafeConnection): string | null {
  const m = c.meta;
  const s = (k: string): string => (typeof m[k] === "string" ? (m[k] as string).trim() : "");
  switch (c.provider) {
    case "github": {
      const repo = s("repo");
      return repo ? `${repo}${s("branch") ? ` @ ${s("branch")}` : ""}${s("commit") ? ` (${s("commit").slice(0, 10)})` : ""}` : null;
    }
    case "vercel": {
      const project = s("project");
      return project ? `${project}${s("deployment_url") ? `, ${hostnameOf(s("deployment_url"))}` : ""}` : null;
    }
    case "custom_deploy": {
      const name = s("provider_name");
      return name ? `${name}${s("branch") ? `, ${s("branch")}` : ""}${s("commit") ? ` (${s("commit").slice(0, 10)})` : ""}` : null;
    }
    case "supabase": return s("project_url") || null;
    case "custom_auth": return s("system") || null;
    case "stripe_test": return s("account_label") ? `Test mode, ${s("account_label")}` : "Test mode";
    case "sentry": return s("dsn") ? hostnameOf(s("dsn")) : null;
    case "webhook": return s("url") || null;
    default: return null;
  }
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

// One read-only connection card. Provider + coverage area, the safe metadata summary, and the dates the
// data layer actually has. Test accounts additionally show their mask + scope; credentials stay sealed.
function ConnectionCard({ c }: { c: SafeConnection }) {
  const isTestAccount = c.provider === "test_account";
  const m = c.meta;
  const s = (k: string): string => (typeof m[k] === "string" ? (m[k] as string).trim() : "");
  const summary = isTestAccount ? null : metaSummary(c);
  return (
    <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-1)", padding: "13px 15px", display: "grid", gap: 7, alignContent: "start" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg-1)" }}>
          {isTestAccount ? (s("label") || "Test account") : (PROVIDER_LABELS[c.provider] ?? c.provider)}
        </span>
        <span className="pill" style={{ fontSize: 9.5, flex: "none" }}>{PROVIDER_GROUP[c.provider] ?? "Connection"}</span>
      </div>
      {isTestAccount ? (
        <>
          {s("username_mask") ? (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-2)", wordBreak: "break-all" }}>{s("username_mask")}</div>
          ) : null}
          <div style={{ fontSize: 12, color: "var(--fg-3)", lineHeight: 1.5 }}>
            Scope: {s("scope") || "signed-in flows only"}. Credentials are stored encrypted and are opened only inside a pass.
          </div>
        </>
      ) : summary ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-2)", wordBreak: "break-all" }}>{summary}</div>
      ) : (
        <div style={{ fontSize: 12, color: "var(--fg-4)" }}>No metadata recorded</div>
      )}
      <div style={{ fontSize: 11.5, color: "var(--fg-4)" }}>
        Connected {when(c.created_at)}{c.last_verified_at ? `, verified ${when(c.last_verified_at)}` : ""}
      </div>
    </div>
  );
}

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

      {/* ── Connection graph (read-only) ────────────────────────────────────────────────────────────── */}
      <section style={sectionStyle} aria-label="Connections">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
          <div style={headLbl}>Connections ({connections.length})</div>
          <span style={{ fontSize: 12, color: "var(--fg-4)" }}>Managed at connect time for now</span>
        </div>
        <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55, margin: "0 0 14px", maxWidth: 640 }}>
          What Vraelis knows about this application&apos;s source, deployment, data, and services. Read-only here;
          editing connections after connect is coming.
        </p>
        {otherConnections.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {otherConnections.map((c) => <ConnectionCard key={c.id} c={c} />)}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--fg-4)", margin: 0 }}>
            No connections recorded. This application was connected with only its URL, so passes run without
            source, deployment, or service context.
          </p>
        )}

        {testAccounts.length ? (
          <>
            <div style={{ ...headLbl, margin: "20px 0 10px" }}>Test accounts ({testAccounts.length})</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
              {testAccounts.map((c) => <ConnectionCard key={c.id} c={c} />)}
            </div>
          </>
        ) : null}

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
              Each gap below narrows what a Production Pass can verify. Connections are added at connect time
              for now; contact support to add one to an existing application.
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
