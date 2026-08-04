import Link from "next/link";
import { repairsSurfaceEnabled } from "@/lib/v-preflight-flags";

// Application-scoped tab bar for the app workspace. Server component: pure links, no client state; the
// active tab is passed in by each page. The run report pages live at /passes (renamed from /runs in the
// subdomain migration); this tab must point there, or it 404s.
const TABS: { key: string; label: string; path: string }[] = [
  { key: "overview", label: "Overview", path: "" },
  { key: "context", label: "Context", path: "/context" },
  { key: "contract", label: "Contract", path: "/contract" },
  { key: "passes", label: "Verifications", path: "/passes" },
  { key: "issues", label: "Issues", path: "/issues" },
  { key: "deployments", label: "Deployments", path: "/deployments" },
  { key: "connections", label: "Connections", path: "/settings/connections" },
  { key: "team", label: "Team", path: "/team" },
  { key: "settings", label: "Settings", path: "/settings" },
];

// The API tab is appended ONLY when the caller passes showApiTab (computed server-side from the API-beta
// gate). It is never in the DOM for a non-enabled account — hiding is not the security boundary (the routes
// 404), but the tab is genuinely absent so no hint of the beta leaks.
const API_TAB = { key: "api", label: "API", path: "/api-runtime" };

// Repairs follows the same "genuinely absent from the DOM" rule, and is read here rather than passed in as
// a prop like showApiTab: the API gate is per-account and async, so only the page can answer it, while this
// one is a process-wide env read that would otherwise have to be threaded through all eleven callers of
// AppTabs identically. Same posture, cheaper wiring. Inserted back at its original position between Issues
// and Deployments when enabled, so turning the flag on restores the exact tab order it had.
const REPAIRS_TAB = { key: "repairs", label: "Repairs", path: "/repairs" };

function baseTabs(): { key: string; label: string; path: string }[] {
  if (!repairsSurfaceEnabled()) return TABS;
  const at = TABS.findIndex((t) => t.key === "deployments");
  return [...TABS.slice(0, at), REPAIRS_TAB, ...TABS.slice(at)];
}

export function AppTabs({ appId, active, showApiTab }: { appId: string; active: string; showApiTab?: boolean }) {
  const tabs = showApiTab ? [...baseTabs(), API_TAB] : baseTabs();
  return (
    <nav aria-label="System sections"
      style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--line-1)", marginTop: 22, marginBottom: 20, overflowX: "auto" }}>
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <Link key={t.key} href={`/systems/${appId}${t.path}`}
            aria-current={isActive ? "page" : undefined}
            style={{
              padding: "9px 13px", fontSize: 13.5, fontWeight: isActive ? 600 : 500,
              color: isActive ? "var(--fg-1)" : "var(--fg-3)", textDecoration: "none",
              borderBottom: isActive ? "2px solid var(--acc)" : "2px solid transparent",
              whiteSpace: "nowrap", flex: "none",
            }}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
