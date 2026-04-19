import { invoke } from "@tauri-apps/api/core";
import type { DesktopPreferences } from "./api";
import { usePreferences } from "./preferences";

// Settings view — app behavior, window, keyboard. This is split from
// PreferencesView, which owns how sansxel-1 *talks* (persona, voice,
// auto-speak). Anything that's about the app itself lives here.
export function DesktopSettingsView() {
  const { prefs, update, loading } = usePreferences();

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
