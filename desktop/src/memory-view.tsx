import type { DesktopSession } from "./auth";

// Memory view — a stub for v0.1.4. Real persistence + auto-pinning lands
// in a later push. For now the view advertises the surface area so users
// understand what sansxel-1 will remember once the backend ships.
export function DesktopMemoryView({ session: _session }: { session: DesktopSession }) {
  return (
    <div className="view">
      <div className="view-head">
        <h1>Memory</h1>
        <p>Saved context sansxel-1 references across every conversation.</p>
      </div>

      <div className="view-body">
        <div className="memory-empty">
          <div className="memory-empty-head">No memories saved yet</div>
          <p>
            As you chat, sansxel-1 will pin facts here automatically — names,
            projects, preferences, anything worth remembering.
          </p>

          <div className="memory-sample-list">
            <div className="memory-sample-row memory-sample-row--placeholder">
              <span className="memory-sample-dot" />
              <span className="memory-sample-text">Working on the sansxel desktop app</span>
              <span className="memory-sample-when">example</span>
            </div>
            <div className="memory-sample-row memory-sample-row--placeholder">
              <span className="memory-sample-dot" />
              <span className="memory-sample-text">Prefers concise, technical replies</span>
              <span className="memory-sample-when">example</span>
            </div>
            <div className="memory-sample-row memory-sample-row--placeholder">
              <span className="memory-sample-dot" />
              <span className="memory-sample-text">Builds in TypeScript + Tauri</span>
              <span className="memory-sample-when">example</span>
            </div>
          </div>
        </div>

        <div className="view-actions">
          <button
            type="button"
            className="memory-clear-btn"
            onClick={() => {
              // TODO: wire to backend memory delete endpoint once it exists
              console.log("clear memory");
            }}
          >
            Clear all memory
          </button>
        </div>
      </div>
    </div>
  );
}
