import type { DesktopSession } from "./auth";

type ReleaseNote = {
  version: string;
  date: string;
  highlight?: boolean;
  changes: string[];
};

// Hardcoded changelog. New entries go on top. The newest entry is
// rendered with the `highlight` flag so it gets the prominent card.
const RELEASES: ReleaseNote[] = [
  {
    version: "0.1.4",
    date: "Apr 18, 2026",
    highlight: true,
    changes: [
      "Borderless title bar with logo on top-left",
      "Nav rail expand-on-hover with labels and account card (name/email/plan/version)",
      "Chat history sidebar collapses to 14px strip, slides out on hover",
      "Sidebar search bar with \u2318F shortcut",
      "Esc returns to Chat from any non-chat view",
      "PC copilot toggle resets to normal mode each launch",
      "\u201CListening\u201D instead of \u201CTap to talk\u201D (orb is purely visual)",
      "Streamed text fades in word-by-word (ChatGPT-style)",
      "Voice rebrand: Sage / Vesper / Quill / Glow / Halo / Drift / Ember / Lyric / Cove / Wise / Lilt",
      "Splash hardened: aggressive minimize-all (EnumWindows), force-focus, Space works without click",
      "Splash boot 1.2s instead of 10s",
      "\u201CComped\u201D pill on plan card when Pro tier has no Stripe sub",
      "Custom thin purple scrollbars across desktop + website",
      "Memory + Integrations + Updates views added",
      "Window mode shortcuts: Ctrl+Shift+N/T/L/R",
      "Surface tagging fix (desktop usage logs as \u201Cdesktop\u201D not \u201Cweb\u201D)",
    ],
  },
  {
    version: "0.1.3",
    date: "Apr 2026",
    changes: [
      "Streaming chat with smooth word-by-word reveal",
      "Conversational voice mode with auto-restart between turns",
      "Persona presets (warm / direct / playful) wired into the system prompt",
      "Pro throttle indicator on the Usage view",
    ],
  },
  {
    version: "0.1.2",
    date: "Mar 2026",
    changes: [
      "Account view with editable display name, focus area, and work style",
      "Plan + Usage views with weekly limits and recent activity",
      "Window-mode toolbar pinning (top / left / right)",
      "Density and accent color preferences",
    ],
  },
  {
    version: "0.1.1",
    date: "Mar 2026",
    changes: [
      "Voice transcription via the desktop mic",
      "Text-to-speech replies with multiple voice options",
      "API key viewer (creation still happens on sansxel.ai)",
    ],
  },
  {
    version: "0.1.0",
    date: "Feb 2026",
    changes: [
      "First sansxel desktop release \u2014 Tauri 2 + React",
      "Sign-in flow against sansxel.ai",
      "Chat against sansxel-1 (fast / balanced / smart tiers)",
    ],
  },
];

// Updates view \u2014 the in-app changelog. Static for now; eventually this
// pulls from a hosted feed so we can ship release notes without a build.
export function DesktopUpdatesView({ session: _session }: { session: DesktopSession }) {
  return (
    <div className="view">
      <div className="view-head">
        <h1>Updates</h1>
        <p>What\u2019s new in sansxel.</p>
      </div>

      <div className="view-body">
        <div className="updates-list">
          {RELEASES.map((rel) => (
            <div
              key={rel.version}
              className={`update-card${rel.highlight ? " update-card--highlight" : ""}`}
            >
              <div className="update-card-head">
                <span className="update-card-version">v{rel.version}</span>
                <span className="update-card-date">{rel.date}</span>
                {rel.highlight && (
                  <span className="update-card-tag">Latest</span>
                )}
              </div>
              <ul className="update-card-changes">
                {rel.changes.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
