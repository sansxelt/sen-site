import Link from "next/link";

// Application-scoped tab bar for the app workspace. Server component: pure links, no client state; the
// active tab is passed in by each page. "Passes" points at /runs because the run routes already live there.
const TABS: { key: string; label: string; path: string }[] = [
  { key: "overview", label: "Overview", path: "" },
  { key: "contract", label: "Contract", path: "/contract" },
  { key: "runs", label: "Passes", path: "/runs" },
  { key: "issues", label: "Issues", path: "/issues" },
  { key: "repairs", label: "Repairs", path: "/repairs" },
  { key: "deployments", label: "Deployments", path: "/deployments" },
  { key: "settings", label: "Settings", path: "/settings" },
];

export function AppTabs({ appId, active }: { appId: string; active: string }) {
  return (
    <nav aria-label="Application sections"
      style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--line-1)", marginTop: 22, marginBottom: 20, overflowX: "auto" }}>
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <Link key={t.key} href={`/applications/${appId}${t.path}`}
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
