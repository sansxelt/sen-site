import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { CopilotEdge, DesktopPreferences } from "./api";
import { usePreferences } from "./preferences";

// Settings view — app behavior, window, keyboard. This is split from
// PreferencesView, which owns how sansxel-1 *talks* (persona, voice,
// auto-speak). Anything that's about the app itself lives here.
export function DesktopSettingsView() {
  const { prefs, update, loading } = usePreferences();
  // v0.1.8 Capsule Rail — local UI state for the "Advanced" expander
  // under the Copilot position control. Closed by default since the
  // bottom-placement opt-in is intentionally discouraged.
  const [advancedOpen, setAdvancedOpen] = useState(false);

  if (loading) {
    return (
      <div className="view">
        <div className="view-head">
          <h1>Settings</h1>
          <p>App behavior, window, and keyboard shortcuts.</p>
        </div>
        <div className="view-body">
          <div className="view-loading">Loading…</div>
        </div>
      </div>
    );
  }

  async function applyWindowMode(mode: DesktopPreferences["window_mode"]) {
    await update({ window_mode: mode });
    try {
      await invoke("set_window_mode", { mode });
    } catch {
      // No-op — native call may fail in dev hot reload, the pref is saved.
    }
  }

  return (
    <div className="view">
      <div className="view-head">
        <h1>Settings</h1>
        <p>
          App behavior, window, and keyboard shortcuts. Separate from
          Preferences (which is about how sansxel-1 talks to you).
        </p>
      </div>

      <div className="view-body">
        <PrefSection
          label="Density"
          help="How much breathing room around messages and panels."
        >
          <SegmentedControl<DesktopPreferences["density"]>
            value={prefs.density}
            onChange={(v) => update({ density: v })}
            options={[
              { value: "compact", label: "Compact" },
              { value: "comfortable", label: "Cozy" },
              { value: "spacious", label: "Spacious" },
            ]}
          />
        </PrefSection>

        <PrefSection
          label="Accent color"
          help="Highlight color across buttons, glows, and active states."
        >
          <div className="accent-row">
            {(["purple", "blue", "green", "amber", "rose"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => update({ accent: a })}
                className={`accent-swatch accent-swatch--${a}${prefs.accent === a ? " active" : ""}`}
                title={a}
                aria-label={`Accent ${a}`}
              />
            ))}
          </div>
        </PrefSection>

        <PrefSection
          label="Window mode"
          help="Pin sansxel to a screen edge for interviews, recordings, study sessions. Toolbar modes float above other apps."
        >
          <SegmentedControl<DesktopPreferences["window_mode"]>
            value={prefs.window_mode}
            onChange={(v) => void applyWindowMode(v)}
            options={[
              { value: "normal", label: "Window" },
              { value: "toolbar-top", label: "Top" },
              { value: "toolbar-left", label: "Left" },
              { value: "toolbar-right", label: "Right" },
            ]}
          />
        </PrefSection>

        {/* v0.1.8 Capsule Rail — where the floating copilot lives.
            Right/Left/Top are the recommended positions; Bottom is
            opt-in via the Advanced expander because it conflicts with
            the OS taskbar/dock and is harder to reach. */}
        <PrefSection
          label="Copilot position"
          help="Where the floating sansxel copilot capsule lives. Vertical edges (Right/Left) overlay your apps; Top docks like a menu bar."
        >
          <div className="copilot-pos-wrap">
            <SegmentedControl<CopilotEdge>
              value={prefs.copilot_edge}
              onChange={(v) => update({ copilot_edge: v })}
              options={
                prefs.copilot_allow_bottom
                  ? [
                      { value: "right", label: "Right" },
                      { value: "left", label: "Left" },
                      { value: "top", label: "Top" },
                      { value: "bottom", label: "Bottom" },
                    ]
                  : [
                      { value: "right", label: "Right" },
                      { value: "left", label: "Left" },
                      { value: "top", label: "Top" },
                    ]
              }
            />
            <button
              type="button"
              className="copilot-advanced-toggle"
              onClick={() => setAdvancedOpen((s) => !s)}
            >
              Advanced {advancedOpen ? "▴" : "▾"}
            </button>
            {advancedOpen && (
              <div className="copilot-advanced">
                <label className="copilot-advanced-row">
                  <input
                    type="checkbox"
                    checked={prefs.copilot_allow_bottom}
                    onChange={(e) => {
                      const next = e.target.checked;
                      // When turning off bottom, also snap the edge
                      // back to "right" if it was currently bottom so
                      // the user isn't left on a now-invalid edge.
                      const patch: Partial<DesktopPreferences> = {
                        copilot_allow_bottom: next,
                      };
                      if (!next && prefs.copilot_edge === "bottom") {
                        patch.copilot_edge = "right";
                      }
                      void update(patch);
                    }}
                  />
                  <span>Enable bottom placement (not recommended)</span>
                </label>
                {prefs.copilot_allow_bottom && (
                  <p className="copilot-advanced-warn">
                    Bottom placement may reduce usability — conflicts with
                    your taskbar/dock and is harder to reach UX.
                  </p>
                )}
              </div>
            )}
          </div>
        </PrefSection>

        <PrefSection
          label="Send on Enter"
          help="On = Enter sends, Shift+Enter is a newline. Off = the other way around (Ctrl/Cmd+Enter sends)."
        >
          <Toggle
            value={prefs.send_on_enter}
            onChange={(v) => update({ send_on_enter: v })}
          />
        </PrefSection>

        <PrefSection
          label="Conversational mode"
          help="When you finish a voice turn, the mic restarts automatically once sansxel-1 stops talking. Hands-free back-and-forth."
        >
          <Toggle
            value={prefs.conversational}
            onChange={(v) => update({ conversational: v })}
          />
        </PrefSection>

        {/* v0.1.8 — controls whether the model can invoke client-side
            tools (navigate, create_api_key, search_threads, …) or is
            limited to text replies. */}
        <PrefSection
          label="Let sansxel-1 take actions"
          help="Allow the assistant to navigate views, manage API keys, search your threads, and run other in-app actions. Turn off for a text-only assistant."
        >
          <Toggle
            value={prefs.tools_enabled}
            onChange={(v) => update({ tools_enabled: v })}
          />
        </PrefSection>
      </div>
    </div>
  );
}

// Local copies of the small primitives PreferencesView uses. Kept local
// so this view doesn't have to import private helpers from workspace.tsx.

function PrefSection({
  label,
  help,
  children,
}: {
  label: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pref-section">
      <div className="pref-section-head">
        <div className="pref-section-label">{label}</div>
        <div className="pref-section-help">{help}</div>
      </div>
      <div className="pref-section-control">{children}</div>
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="seg-ctrl">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`seg-ctrl-btn${opt.value === value ? " active" : ""}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`toggle${value ? " on" : ""}`}
      role="switch"
      aria-checked={value}
    >
      <span className="toggle-thumb" />
    </button>
  );
}
