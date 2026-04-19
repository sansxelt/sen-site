import type { DesktopSession } from "./auth";

type Integration = {
  key: string;
  name: string;
  blurb: string;
  icon: string;
};

const INTEGRATIONS: Integration[] = [
  {
    key: "notion",
    name: "Notion",
    blurb: "Read your docs, draft new pages, sync project notes.",
    icon: "N",
  },
  {
    key: "github",
    name: "GitHub",
    blurb: "Browse repos, review PRs, generate commits and changelogs.",
    icon: "GH",
  },
  {
    key: "linear",
    name: "Linear",
    blurb: "Triage issues, draft tickets, summarize sprint progress.",
    icon: "L",
  },
  {
    key: "slack",
    name: "Slack",
    blurb: "Catch up on threads, draft replies, surface what matters.",
    icon: "S",
  },
  {
    key: "gdrive",
    name: "Google Drive",
    blurb: "Search and reference your docs, sheets, and slides.",
    icon: "GD",
  },
  {
    key: "mcp",
    name: "MCP servers",
    blurb: "Plug in any MCP-compatible tool to extend sansxel-1.",
    icon: "MCP",
  },
];

// Integrations view — surfaces planned connectors. None of the cards are
// wired yet; everything reads "Coming soon" so users see the roadmap.
export function DesktopIntegrationsView({ session: _session }: { session: DesktopSession }) {
  return (
    <div className="view">
      <div className="view-head">
        <h1>Integrations</h1>
        <p>Connect your tools so sansxel-1 can read and act in real time.</p>
      </div>

      <div className="view-body">
        <div className="integrations-grid">
          {INTEGRATIONS.map((it) => (
            <div key={it.key} className="integration-card">
              <div className="integration-card-head">
                <span className="integration-card-icon">{it.icon}</span>
                <span className="integration-card-name">{it.name}</span>
              </div>
              <p className="integration-card-blurb">{it.blurb}</p>
              <button
                type="button"
                className="integration-card-btn"
                disabled
                title="Coming soon"
              >
                Connect
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
