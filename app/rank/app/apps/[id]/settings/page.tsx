import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightOwner } from "@/lib/v-preflight-guard";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { SetupRequired } from "../../setup-required";
import { getApplication } from "@/lib/v-applications";
import { AppTabs } from "../app-tabs";

export const metadata: Metadata = { title: "Application settings" };

// Friendly labels for the builder the app was created with (raw key falls through).
const BUILDER_LABELS: Record<string, string> = {
  claude_code: "Claude Code", cursor: "Cursor", lovable: "Lovable",
  bolt: "Bolt", replit: "Replit", v0: "v0", other: "Other",
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

// Read-only settings for one application. Owner-gated server component. No rename or delete controls yet:
// those mutations are not built, so the page says so honestly instead of faking them.
export default async function AppSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requirePreflightOwner("/app/apps/" + id);
  if (!(await preflightDbReady())) return <SetupRequired />;

  const app = await getApplication(owner, id);
  if (!app) {
    return (
      <div className="wrap" style={{ maxWidth: 960, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
        <div className="empty">
          <div className="empty__icon">∅</div>
          <h3>Application not found</h3>
          <p>This application doesn&apos;t exist, or it belongs to another account.</p>
          <Link href="/app/apps" className="btn">Back to applications</Link>
        </div>
      </div>
    );
  }

  const builderLabel = app.builder ? (BUILDER_LABELS[app.builder] ?? app.builder) : null;

  return (
    <div className="wrap" style={{ maxWidth: 960, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, marginBottom: 14 }}>
        <Link href="/app/apps" style={{ color: "var(--fg-4)", textDecoration: "none" }}>Applications</Link>
        <span aria-hidden style={{ color: "var(--fg-5)" }}>/</span>
        <span style={{ color: "var(--fg-2)", fontWeight: 600, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.name}</span>
      </nav>

      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "6px 0 10px" }}>{app.name}</h1>
      <a href={app.app_url} target="_blank" rel="noopener noreferrer"
        style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-4)", textDecoration: "none", wordBreak: "break-all" }}>
        {app.app_url}
      </a>

      <AppTabs appId={id} active="settings" />

      <div style={{ display: "grid", gap: 14 }}>
        <div className="card" style={{ padding: "clamp(18px, 2.4vw, 24px)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16.5, color: "var(--fg-1)", margin: 0 }}>Application details</h2>
          <div style={{ display: "grid", gap: 11, marginTop: 14 }}>
            <KV k="Name" v={app.name} />
            <KV k="URL" v={app.app_url} />
            <KV k="Builder" v={builderLabel} />
            <KV k="Framework" v={app.framework} />
            <KV k="Connected" v={when(app.created_at)} />
          </div>
        </div>

        <div className="card" style={{ padding: "clamp(18px, 2.4vw, 24px)", background: "var(--bg-2)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)", margin: 0 }}>Renaming and deletion</h2>
          <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55, margin: "8px 0 0" }}>
            Renaming an application and deleting it from the UI are coming. Until then, contact support and
            we&apos;ll make the change for you.
          </p>
        </div>
      </div>
    </div>
  );
}
