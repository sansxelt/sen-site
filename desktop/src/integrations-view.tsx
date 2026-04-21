import { openUrl } from "@tauri-apps/plugin-opener";
import { API_BASE } from "./auth";
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

// Integrations view — surfaces planned connectors. Most cards are
// roadmap placeholders; GitHub gets a real (scaffolded) OAuth button
// in v0.1.4 so we can validate the round-trip end to end. Real
// callback persistence lands in v0.1.5.
export function DesktopIntegrationsView({ session }: { session: DesktopSession }) {
  const handleConnect = async (key: string) => {
    if (key !== "github") return;
    // Open the OAuth-initiate URL in the user's default browser. The
    // server redirects them straight to github.com/login/oauth/authorize.
    // Bearer auth is handled by passing the token in a query param —
    // the desktop app can't set headers on `openUrl` calls, so the
    // initiate route reads the desktop session via NextAuth fallback
    // and the user's already-signed-in browser session.
    const url = `${API_BASE}/api/integrations/github/oauth?token=${encodeURIComponent(session.token)}`;
    try {
      await openUrl(url);
    } catch {
      // openUrl can fail if no default browser is registered; nothing
      // we can do beyond logging.
      console.warn("openUrl failed for GitHub OAuth");
    }
  };

  return (
    <div className="view view--integrations">
      <div className="view-head">
        <h1>Integrations</h1>
        <p>Connect your tools so sansxel-1 can read and act in real time.</p>
      </div>

      <div className="view-body">
        <div className="integrations-grid">
          {INTEGRATIONS.map((it) => {
            const isGithub = it.key === "github";
            return (
              <div key={it.key} className="integration-card">
                <div className="integration-card-head">
                  <span className="integration-card-icon">{it.icon}</span>
                  <span className="integration-card-name">{it.name}</span>
                </div>
                <p className="integration-card-blurb">{it.blurb}</p>
                <button
                  type="button"
                  className="integration-card-btn"
                  disabled={!isGithub}
                  title={isGithub ? "Connect via GitHub OAuth" : "Coming soon"}
                  onClick={isGithub ? () => void handleConnect(it.key) : undefined}
                >
                  {isGithub ? "Connect GitHub" : "Coming soon"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
