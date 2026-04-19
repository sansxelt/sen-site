import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

// Floating edge copilot for sansxel v0.1.4. Lives in its own Tauri
// window (label: "copilot"), borderless + transparent + alwaysOnTop.
//
// Three states (from the spec):
//   1. Collapsed: 8-12px glowing edge bar, always visible
//   2. Hover: bar expands slightly outward, shows helper text + a
//      mini position switcher (\u25c0 \u25b2 \u25b6 for left/top/right docks)
//   3. Click: full panel opens floating over content
//
// Underlying data goes through /api/ai/copilot the same way the
// website copilot does \u2014 this is the desktop-native shell on top.

type DockEdge = "left" | "right" | "top";
type CopilotMode = "collapsed" | "hover" | "open";

const DOCK_KEY = "sansxel.copilot.dock";

export function FloatingCopilot() {
  const [edge, setEdge] = useState<DockEdge>("right");
  const [mode, setMode] = useState<CopilotMode>("collapsed");
  const [streamProof, setStreamProof] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Restore last-chosen edge from localStorage so the bar reappears
  // where the user left it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(DOCK_KEY);
    if (saved === "left" || saved === "right" || saved === "top") {
      setEdge(saved);
    }
  }, []);

  // Tell the Rust side to reposition the OS window whenever edge or
  // open state changes. Rust handles SetWindowPos / size based on
  // the edge + open vs collapsed.
  useEffect(() => {
    void invoke("position_copilot_window", {
      edge,
      open: mode === "open",
    }).catch(() => {
      // Fallback for dev / non-Tauri host
    });
  }, [edge, mode]);

  // Stream-proof toggle (WDA_EXCLUDEFROMCAPTURE on Windows). When
  // enabled, the copilot window won't appear in screen-shares,
  // recordings, or OBS captures \u2014 useful for interview-mode use.
  useEffect(() => {
    void invoke("set_copilot_stream_proof", { enabled: streamProof }).catch(
      () => {},
    );
  }, [streamProof]);

  // Esc closes the copilot back to collapsed
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (mode === "open") setMode("hover");
        else if (mode === "hover") setMode("collapsed");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode]);

  const setEdgePref = useCallback((next: DockEdge) => {
    setEdge(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DOCK_KEY, next);
    }
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    if (abortRef.current) abortRef.current.abort();

    setMessages((current) => [
      ...current,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);
    setInput("");
    setStreaming(true);

    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) throw new Error(`copilot ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistant = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          assistant += decoder.decode(value, { stream: true });
          setMessages((current) => {
            const copy = [...current];
            copy[copy.length - 1] = { role: "assistant", content: assistant };
            return copy;
          });
        }
      }
    } catch (err) {
      if ((err as { name?: string })?.name !== "AbortError") {
        console.warn("copilot send failed:", err);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, streaming]);

  const close = useCallback(() => {
    void getCurrentWindow().hide();
  }, []);

  // ── Rendering ─────────────────────────────────────────────────────
  return (
    <div
      className={`fc fc--edge-${edge} fc--mode-${mode}${streamProof ? " fc--invisible" : ""}`}
      onMouseEnter={() => {
        if (mode === "collapsed") setMode("hover");
      }}
      onMouseLeave={() => {
        if (mode === "hover") setMode("collapsed");
      }}
    >
      {mode === "collapsed" && (
        <div className="fc-edge-glow">
          <div className="fc-edge-halo" />
          <span className="fc-edge-mark">sansxel</span>
        </div>
      )}

      {mode === "hover" && (
        <div
          className="fc-hover"
          onClick={() => setMode("open")}
        >
          <div className="fc-hover-text">Ask anything\u2026</div>
          <div className="fc-position-switch" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`fc-pos-btn${edge === "left" ? " active" : ""}`}
              onClick={() => setEdgePref("left")}
              title="Dock left"
              aria-label="Dock left"
            >
              \u25c0
            </button>
            <button
              type="button"
              className={`fc-pos-btn${edge === "top" ? " active" : ""}`}
              onClick={() => setEdgePref("top")}
              title="Dock top"
              aria-label="Dock top"
            >
              \u25b2
            </button>
            <button
              type="button"
              className={`fc-pos-btn${edge === "right" ? " active" : ""}`}
              onClick={() => setEdgePref("right")}
              title="Dock right"
              aria-label="Dock right"
            >
              \u25b6
            </button>
          </div>
        </div>
      )}

      {mode === "open" && (
        <div className="fc-panel">
          <div className="fc-panel-head">
            <div className="fc-panel-title">
              <span className="fc-panel-dot" />
              sansxel-1 copilot
            </div>
            <div className="fc-panel-actions">
              <button
                type="button"
                className={`fc-stream-toggle${streamProof ? " active" : ""}`}
                onClick={() => setStreamProof((s) => !s)}
                title={streamProof ? "Stream-proof on (invisible to screen recorders)" : "Stream-proof off (visible to screen recorders)"}
              >
                {streamProof ? "\ud83d\udd07 Stealth" : "\ud83d\udc41 Visible"}
              </button>
              <button
                type="button"
                className="fc-close"
                onClick={close}
                aria-label="Close"
                title="Close (Esc)"
              >
                \u00d7
              </button>
            </div>
          </div>

          <div className="fc-scroll">
            {messages.length === 0 ? (
              <div className="fc-empty">
                <p>Quick questions, code snippets, anything live.</p>
                <p className="fc-empty-sub">
                  This copilot floats over every other app. Toggle Stealth
                  mode to make it invisible to screen recorders.
                </p>
              </div>
            ) : (
              messages.map((message, i) => (
                <div key={i} className={`fc-msg fc-msg--${message.role}`}>
                  {message.content || (streaming && i === messages.length - 1 ? "\u2026" : "")}
                </div>
              ))
            )}
          </div>

          <form
            className="fc-input"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything\u2026"
              autoFocus
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming}
              className="fc-send"
            >
              {streaming ? "\u2026" : "Send"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
