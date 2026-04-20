import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { API_BASE, restoreSession, type DesktopSession } from "./auth";
import {
  getPreferences,
  patchPreferences,
  type CopilotEdge,
} from "./api";

// Floating edge copilot for sansxel v0.1.8 — Capsule Rail spec.
// Lives in its own Tauri window (label: "copilot"), borderless +
// transparent + alwaysOnTop.
//
// Two states:
//   1. Collapsed: an always-visible capsule on the chosen edge
//   2. Open:      full panel (vertical for left/right, horizontal
//                 command-bar for top/bottom)
//
// Four positions:
//   - right (default), left  — OVERLAY mode (vertical capsule rail)
//   - top                    — DOCKED LAYER (horizontal command bar)
//   - bottom                 — DOCKED LAYER, hidden behind opt-in
//                              flag (discouraged due to taskbar
//                              conflicts)
//
// Drag-to-snap: pointer-down on the capsule + drag across the screen
// snaps to the nearest edge on release. Orientation morphs via CSS
// transitions on the variant classes.
//
// Underlying data goes through /api/ai/copilot the same way the
// website copilot does — this is the desktop-native shell on top.

type DockEdge = CopilotEdge;
type CopilotMode = "collapsed" | "open";

// v0.1.11: Activity-state engine. Drives the "always alive" feel of
// the rail — every visual cue (pulse, glow, particles) is keyed off
// this single state so visuals can never lie about what sansxel is
// doing. Auto-derived from existing flags (input/streaming/etc.) plus
// a short ready-decay timer that holds the "done" highlight before
// returning to idle.
type LiveState = "idle" | "listening" | "thinking" | "streaming" | "ready";

// v0.1.11: 3 next-action chips appear after every reply finishes —
// the "continuity loop" that keeps the rail from ever being a dead
// end. Generated client-side from the assistant content.
type NextAction = { label: string; prompt: string };

const DOCK_KEY = "sansxel.copilot.dock";
const ALLOW_BOTTOM_KEY = "sansxel.copilot.allowBottom";

// v0.1.11: Live Mode consent. Tri-state stored in localStorage so we
// only ever ask once per machine. Server-side sync deferred to v0.1.12
// (the deep copilot pass) — for v0.1.11 the answer is purely local.
const LIVE_MODE_KEY = "sansxel.copilot.liveMode";
type LiveModeConsent = "unset" | "granted" | "denied";

// v0.1.11: How often the foreground-window watcher polls. 800ms is
// the sweet spot — fast enough to feel reactive when you alt-tab,
// slow enough to add zero perceptible CPU load.
const FOREGROUND_POLL_MS = 800;

// v0.1.11: Hint engine. Maps a foreground-window TITLE (no contents)
// to a contextual suggestion the rail can offer. We match on title
// substrings because Win32 titles include both the document and the
// app name, e.g. "floating-copilot.tsx - sen-site - Visual Studio Code".
type LiveHint = { label: string; prompt: string };

function deriveLiveHint(title: string | null): LiveHint | null {
  if (!title) return null;
  const t = title.toLowerCase();
  if (/visual studio code|cursor|sublime text|atom|webstorm|intellij/.test(t)) {
    return {
      label: "Explain selection",
      prompt:
        "I'm in my code editor — explain what the selected code does and call out anything subtle.",
    };
  }
  if (/roblox studio/.test(t)) {
    return {
      label: "Optimize script",
      prompt:
        "I'm in Roblox Studio — review the open script and suggest the cleanest optimization.",
    };
  }
  if (/figma|adobe xd|sketch|framer/.test(t)) {
    return {
      label: "Critique design",
      prompt:
        "I'm in a design tool — critique the visible design from a UX + visual hierarchy angle.",
    };
  }
  if (/google docs|microsoft word|notion|obsidian|word/.test(t)) {
    return {
      label: "Tighten this",
      prompt:
        "I'm in a doc — tighten the writing in front of me without losing the original meaning.",
    };
  }
  if (/youtube|twitch/.test(t)) {
    return {
      label: "Summarize video",
      prompt:
        "I'm watching a video — summarize the main points so far in 3 bullets.",
    };
  }
  if (/chrome|firefox|edge|safari|brave|arc/.test(t)) {
    return {
      label: "Summarize page",
      prompt: "I'm on a webpage — summarize the main page in front of me.",
    };
  }
  if (/terminal|powershell|cmd|bash|wezterm|alacritty/.test(t)) {
    return {
      label: "Explain command",
      prompt:
        "I'm in a terminal — explain what the last command I ran does and what its output likely means.",
    };
  }
  if (/discord|slack|teams/.test(t)) {
    return {
      label: "Draft a reply",
      prompt:
        "I'm in a chat app — draft a brief, friendly reply that fits the conversation tone.",
    };
  }
  return null;
}

// Drag-to-snap threshold: only treat pointer-down + move as a drag if
// the cursor moves at least this many pixels. Below this we treat the
// gesture as a click → open the panel.
const DRAG_THRESHOLD_PX = 6;

// v0.1.11: How long the "ready" highlight holds after a reply ends
// before decaying back to idle. Long enough to register, short enough
// not to overstay.
const READY_DECAY_MS = 2400;

// v0.1.11: Heuristics for next-action chips. Reads the assistant
// content and picks 3 actions that match the shape of the reply.
function deriveNextActions(content: string): NextAction[] {
  const text = content.toLowerCase();
  const hasCode = /```|^\s{4}\S|function\s+\w+|const\s+\w+\s*=|class\s+\w+/m.test(content);
  const hasLinks = /\bhttps?:\/\/\S+/.test(content) || /\b(source|reference)s?\b/.test(text);
  if (hasCode) {
    return [
      { label: "Explain", prompt: "Walk me through what this code does, line by line." },
      { label: "Refine", prompt: "Refine and tighten the code above — same behavior, cleaner." },
      { label: "Test it", prompt: "Write tests that verify the code above behaves correctly." },
    ];
  }
  if (hasLinks) {
    return [
      { label: "Go deeper", prompt: "Go deeper on the most important point above." },
      { label: "Sources", prompt: "List the sources or references that back this up." },
      { label: "Summarize", prompt: "Give me a one-paragraph summary of everything above." },
    ];
  }
  return [
    { label: "Refine", prompt: "Refine the answer above — sharper, more specific." },
    { label: "Explain", prompt: "Explain the answer above in simpler terms." },
    { label: "What's next", prompt: "What's the natural next step after this?" },
  ];
}

export function FloatingCopilot() {
  const [edge, setEdge] = useState<DockEdge>("right");
  const [allowBottom, setAllowBottom] = useState(false);
  const [mode, setMode] = useState<CopilotMode>("collapsed");
  const [streamProof, setStreamProof] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [streaming, setStreaming] = useState(false);
  // v0.1.7 fix: floating Copilot lives in its own Tauri webview so it
  // has no shared auth context with the main app. Restore the same
  // saved session token here on mount; without this the API returns
  // an HTML 401 page that then got stream-decoded as raw text.
  const [session, setSession] = useState<DesktopSession | null>(null);
  // v0.1.8: track whether we're mid-drag so the capsule's click
  // handler doesn't fire when the user is just snapping.
  const [dragging, setDragging] = useState(false);
  // v0.1.11: live state engine (see LiveState type comment).
  const [liveState, setLiveState] = useState<LiveState>("idle");
  const readyDecayRef = useRef<number | null>(null);
  // v0.1.11: chips that appear after the assistant finishes a reply.
  const [nextActions, setNextActions] = useState<NextAction[]>([]);
  // v0.1.11: tools currently in flight (MCP / web_search / etc.). Each
  // gets a status dot on the rail so the user can see what's happening
  // even when no text is streaming. Pieces 5 wires real tools in; the
  // shape is here ready to receive them.
  const [activeTools, setActiveTools] = useState<
    Array<{ id: string; name: string; status: "running" | "ok" | "error" }>
  >([]);
  // v0.1.11: Live Mode — does the user consent to us reading the OS
  // foreground-window title? Tri-state. "unset" surfaces the consent
  // dialog the first time the rail opens. "granted" enables polling.
  // "denied" disables it forever (toggle via Settings later).
  const [liveModeConsent, setLiveModeConsent] = useState<LiveModeConsent>("unset");
  const [showLiveConsent, setShowLiveConsent] = useState(false);
  // The current contextual hint derived from the foreground-window
  // title. Null when there's nothing useful to suggest, when the user
  // is focused on us, or when Live Mode is off.
  const [liveHint, setLiveHint] = useState<LiveHint | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const restored = await restoreSession();
        if (!cancelled) setSession(restored);
      } catch {
        if (!cancelled) setSession(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Restore last-chosen edge from localStorage so the bar reappears
  // where the user left it. localStorage is the immediate source so
  // there's zero flicker before the server prefs land.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(DOCK_KEY);
    const savedAllowBottom =
      window.localStorage.getItem(ALLOW_BOTTOM_KEY) === "1";
    setAllowBottom(savedAllowBottom);
    if (
      saved === "left" ||
      saved === "right" ||
      saved === "top" ||
      (saved === "bottom" && savedAllowBottom)
    ) {
      setEdge(saved);
    }
  }, []);

  // v0.1.8 — once the session is available, fetch the server-side
  // copilot_edge / copilot_allow_bottom prefs so the floating window
  // honors what the user picked in Settings (which lives in the
  // main window). localStorage stays in sync so a cold-start picks
  // the right edge even before the server responds.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const prefs = await getPreferences(session.token);
        if (cancelled) return;
        setAllowBottom(prefs.copilot_allow_bottom);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            ALLOW_BOTTOM_KEY,
            prefs.copilot_allow_bottom ? "1" : "0",
          );
          window.localStorage.setItem(DOCK_KEY, prefs.copilot_edge);
        }
        setEdge(prefs.copilot_edge);
      } catch {
        // Server read failed — keep whatever localStorage gave us
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

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
  // recordings, or OBS captures — useful for interview-mode use.
  useEffect(() => {
    void invoke("set_copilot_stream_proof", { enabled: streamProof }).catch(
      () => {},
    );
  }, [streamProof]);

  // Esc closes the copilot back to collapsed
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && mode === "open") {
        setMode("collapsed");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode]);

  // v0.1.11: restore Live Mode consent from localStorage on mount so
  // the polling decision is made before the rail renders the first
  // frame.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(LIVE_MODE_KEY);
    if (saved === "granted" || saved === "denied") {
      setLiveModeConsent(saved);
    } else {
      setLiveModeConsent("unset");
    }
  }, []);

  // v0.1.11: when the user opens the rail for the first time and we
  // still don't have a consent answer, surface the dialog. We don't
  // ask on cold launch — we ask the moment they engage.
  useEffect(() => {
    if (mode === "open" && liveModeConsent === "unset") {
      setShowLiveConsent(true);
    }
  }, [mode, liveModeConsent]);

  const persistLiveConsent = useCallback((next: "granted" | "denied") => {
    setLiveModeConsent(next);
    setShowLiveConsent(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LIVE_MODE_KEY, next);
    }
    if (next === "denied") {
      setLiveHint(null);
    }
  }, []);

  // v0.1.11: foreground-window watcher. Polls the Tauri command at
  // FOREGROUND_POLL_MS while consent is granted; immediately tears
  // down on denial / unset. Updates liveHint based on the title each
  // tick — the hint engine returns null for windows we don't have
  // good suggestions for, so this is naturally quiet.
  useEffect(() => {
    if (liveModeConsent !== "granted") {
      setLiveHint(null);
      return;
    }
    let cancelled = false;
    let lastTitle: string | null = null;
    const tick = async () => {
      try {
        const title = (await invoke<string | null>("get_foreground_window_title")) ?? null;
        if (cancelled) return;
        if (title === lastTitle) return;
        lastTitle = title;
        setLiveHint(deriveLiveHint(title));
      } catch {
        // Non-Windows / command not registered yet — fail quietly
      }
    };
    void tick();
    const handle = window.setInterval(() => void tick(), FOREGROUND_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [liveModeConsent]);

  // v0.1.11: state decay. After "ready" holds for READY_DECAY_MS, the
  // rail returns to idle so it doesn't permanently sit in highlight.
  useEffect(() => {
    if (liveState !== "ready") return;
    if (readyDecayRef.current !== null) {
      window.clearTimeout(readyDecayRef.current);
    }
    readyDecayRef.current = window.setTimeout(() => {
      setLiveState("idle");
      readyDecayRef.current = null;
    }, READY_DECAY_MS);
    return () => {
      if (readyDecayRef.current !== null) {
        window.clearTimeout(readyDecayRef.current);
        readyDecayRef.current = null;
      }
    };
  }, [liveState]);

  // v0.1.11: "listening" = user has started typing but hasn't sent.
  // Promotes idle → listening on first keystroke; falls back to idle
  // when the input clears. Doesn't override thinking / streaming /
  // ready (those are owned by send flow).
  useEffect(() => {
    if (liveState === "thinking" || liveState === "streaming" || liveState === "ready") {
      return;
    }
    if (input.trim().length > 0) {
      if (liveState !== "listening") setLiveState("listening");
    } else if (liveState === "listening") {
      setLiveState("idle");
    }
  }, [input, liveState]);

  // Persist edge choice to localStorage (immediate) + server (async,
  // so the main window's Settings UI stays in sync if the user
  // drag-snapped to a new edge).
  const setEdgePref = useCallback(
    (next: DockEdge) => {
      setEdge(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(DOCK_KEY, next);
      }
      if (session) {
        void patchPreferences(session.token, { copilot_edge: next }).catch(
          () => {
            // Server save failed — local change still applies
          },
        );
      }
    },
    [session],
  );

  // Drag-to-snap handlers. Pointer-down arms a possible drag; if the
  // cursor moves past DRAG_THRESHOLD_PX, we enter drag mode and the
  // release will snap to the nearest edge. If it doesn't move, the
  // pointer-up acts as a click → open the panel.
  const onCapsulePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Ignore right-click + middle-click
      if (e.button !== 0) return;
      dragStateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
      };
      // Capture so we keep getting move/up events even outside the
      // capsule (the user is dragging across the screen).
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // setPointerCapture may not be supported; fine to skip.
      }
    },
    [],
  );

  const onCapsulePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const state = dragStateRef.current;
      if (!state) return;
      const dx = Math.abs(e.clientX - state.startX);
      const dy = Math.abs(e.clientY - state.startY);
      if (!state.moved && (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX)) {
        state.moved = true;
        setDragging(true);
      }
    },
    [],
  );

  const computeNearestEdge = useCallback(
    (clientX: number, clientY: number): DockEdge => {
      // Use the OS-level cursor position relative to the screen by
      // converting through the copilot window's known geometry. The
      // capsule lives inside a window pinned to the edge, so client
      // coordinates inside the window aren't the full screen — we
      // approximate by combining the window position via screen
      // dimensions reported by window.screen.
      const sw =
        typeof window !== "undefined" ? window.screen.width : 1920;
      const sh =
        typeof window !== "undefined" ? window.screen.height : 1080;
      // The webview origin differs per edge. Use screenX/Y of the
      // window plus the local clientX/Y to get the absolute cursor
      // position on the desktop.
      const winX = typeof window !== "undefined" ? window.screenX : 0;
      const winY = typeof window !== "undefined" ? window.screenY : 0;
      const absX = winX + clientX;
      const absY = winY + clientY;

      const distLeft = absX;
      const distRight = sw - absX;
      const distTop = absY;
      const distBottom = sh - absY;

      const candidates: Array<{ edge: DockEdge; dist: number }> = [
        { edge: "left", dist: distLeft },
        { edge: "right", dist: distRight },
        { edge: "top", dist: distTop },
      ];
      if (allowBottom) {
        candidates.push({ edge: "bottom", dist: distBottom });
      }
      candidates.sort((a, b) => a.dist - b.dist);
      return candidates[0]?.edge ?? "right";
    },
    [allowBottom],
  );

  const onCapsulePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const state = dragStateRef.current;
      dragStateRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // not captured — ignore
      }
      if (!state) return;
      if (state.moved) {
        // Snap to the nearest edge based on release position.
        const next = computeNearestEdge(e.clientX, e.clientY);
        setDragging(false);
        if (next !== edge) {
          setEdgePref(next);
        }
      } else {
        // Treat as a click — open the panel.
        setMode("open");
      }
    },
    [computeNearestEdge, edge, setEdgePref],
  );

  const onCapsulePointerCancel = useCallback(() => {
    dragStateRef.current = null;
    setDragging(false);
  }, []);

  // v0.1.11: programmatic send used by both the form submit and the
  // next-action chips. Accepts an optional override so chips can pass
  // their prefilled prompt without going through the input box.
  const sendText = useCallback(
    async (override?: string) => {
      const text = (override ?? input).trim();
      if (!text || streaming) return;
      if (!session) {
        setMessages((current) => [
          ...current,
          { role: "user", content: text },
          {
            role: "assistant",
            content: "Sign in to sansxel in the main window to use the copilot.",
          },
        ]);
        setInput("");
        return;
      }
      if (abortRef.current) abortRef.current.abort();

      // v0.1.11: clear any prior chips + flip state to "thinking" the
      // INSTANT we know we're sending. This is the perceived-
      // responsiveness moment — the rail must visually react before
      // the network does anything.
      setNextActions([]);
      setLiveState("thinking");

      setMessages((current) => [
        ...current,
        { role: "user", content: text },
        { role: "assistant", content: "" },
      ]);
      setInput("");
      setStreaming(true);

      const ac = new AbortController();
      abortRef.current = ac;
      let assistant = "";
      let firstByteSeen = false;
      try {
        // v0.1.7: use absolute API_BASE (sansxel.ai) + tauriFetch so the
        // request bypasses the local Tauri origin. Add Bearer auth from
        // the restored session. Defensive content-type check so we never
        // dump an HTML error page as a "message" again.
        const res = await tauriFetch(`${API_BASE}/api/ai/copilot`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.token}`,
            "x-sansxel-surface": "desktop",
          },
          body: JSON.stringify({ question: text }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(`copilot ${res.status}`);
        }
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("text/plain") && !contentType.includes("text/event-stream")) {
          let body = "";
          try {
            const cloned = await res.text();
            body = cloned.length > 200 ? cloned.slice(0, 200) + "…" : cloned;
          } catch {
            body = "(no body)";
          }
          throw new Error(`Unexpected response (${contentType || "no type"}): ${body}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            // v0.1.11: flip state to "streaming" on first byte. This
            // distinguishes the "thinking" phase (waiting on the model)
            // from active token output, so the rail visuals can shift.
            if (!firstByteSeen) {
              firstByteSeen = true;
              setLiveState("streaming");
            }
            assistant += decoder.decode(value, { stream: true });
            setMessages((current) => {
              const copy = [...current];
              copy[copy.length - 1] = { role: "assistant", content: assistant };
              return copy;
            });
          }
        }
        // v0.1.11: reply finished — generate next-action chips from the
        // content shape and flip to "ready" so the rail glows briefly,
        // then decays to idle.
        setNextActions(deriveNextActions(assistant));
        setLiveState("ready");
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          const detail = err instanceof Error ? err.message : "Copilot failed";
          setMessages((current) => {
            const copy = [...current];
            copy[copy.length - 1] = {
              role: "assistant",
              content: `⚠ ${detail}`,
            };
            return copy;
          });
        }
        setLiveState("idle");
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [input, streaming, session],
  );

  // Backwards-compat wrapper for existing form submit callers.
  const send = useCallback(() => sendText(), [sendText]);

  const close = useCallback(() => {
    void getCurrentWindow().hide();
  }, []);

  // ── Rendering ─────────────────────────────────────────────────────
  // v0.1.8 Capsule Rail: collapsed state is always visible. Click to
  // open the full panel. Drag to snap to a different edge. Top/Bottom
  // render a horizontal command-bar layout when open; Left/Right keep
  // the existing vertical panel layout.
  const isHorizontal = edge === "top" || edge === "bottom";

  // The 3-position switcher inside the capsule: left/top/right by
  // default, plus bottom when the user opts in via Settings.
  const positionOptions: Array<{
    edge: DockEdge;
    glyph: string;
    title: string;
  }> = [
    { edge: "left", glyph: "◀", title: "Dock left" },
    { edge: "top", glyph: "▲", title: "Dock top" },
    { edge: "right", glyph: "▶", title: "Dock right" },
  ];
  if (allowBottom) {
    positionOptions.push({
      edge: "bottom",
      glyph: "▼",
      title: "Dock bottom",
    });
  }

  return (
    <div
      className={`fc fc--edge-${edge} fc--mode-${mode} fc--state-${liveState}${streamProof ? " fc--invisible" : ""}${dragging ? " fc--dragging" : ""}`}
    >
      {showLiveConsent && (
        <div className="fc-consent" role="dialog" aria-label="Enable Live Mode">
          <div className="fc-consent-card">
            <div className="fc-consent-eyebrow">Live Mode</div>
            <h3 className="fc-consent-title">Should sansxel watch what you&rsquo;re working on?</h3>
            <p className="fc-consent-copy">
              When enabled, sansxel reads only the <strong>title</strong> of the
              window you have focused (never its contents) so it can offer
              context-aware actions &mdash; &ldquo;Summarize this page&rdquo;
              when you&rsquo;re in a browser, &ldquo;Explain selection&rdquo;
              in your editor, and so on.
            </p>
            <ul className="fc-consent-bullets">
              <li>Window titles only &mdash; never window contents</li>
              <li>Stays on your machine &mdash; never sent unless you click a hint</li>
              <li>Toggleable any time in Settings</li>
            </ul>
            <div className="fc-consent-actions">
              <button
                type="button"
                className="fc-consent-btn fc-consent-btn--ghost"
                onClick={() => persistLiveConsent("denied")}
              >
                Not now
              </button>
              <button
                type="button"
                className="fc-consent-btn fc-consent-btn--primary"
                onClick={() => persistLiveConsent("granted")}
              >
                Enable Live Mode
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === "collapsed" && (
        <div
          className="fc-bar"
          role="button"
          tabIndex={0}
          onPointerDown={onCapsulePointerDown}
          onPointerMove={onCapsulePointerMove}
          onPointerUp={onCapsulePointerUp}
          onPointerCancel={onCapsulePointerCancel}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setMode("open");
            }
          }}
        >
          <div className="fc-bar-mark">
            <span className="fc-bar-dot" />
            <span className="fc-bar-label">sansxel</span>
          </div>
          <div className="fc-bar-cta">
            {liveState === "thinking"
              ? "Thinking…"
              : liveState === "streaming"
                ? "Replying…"
                : liveState === "ready"
                  ? "Ready"
                  : liveState === "listening"
                    ? "Listening…"
                    : "Ask anything…"}
          </div>
          {activeTools.length > 0 && (
            <div className="fc-bar-tools" aria-label="Active tools">
              {activeTools.map((tool) => (
                <span
                  key={tool.id}
                  className={`fc-tool-dot fc-tool-dot--${tool.status}`}
                  title={`${tool.name} — ${tool.status}`}
                />
              ))}
            </div>
          )}
          <div
            className="fc-position-switch"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
          >
            {positionOptions.map((opt) => (
              <button
                key={opt.edge}
                type="button"
                className={`fc-pos-btn${edge === opt.edge ? " active" : ""}`}
                onClick={() => setEdgePref(opt.edge)}
                title={opt.title}
                aria-label={opt.title}
              >
                {opt.glyph}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "open" && isHorizontal && (
        // ── Horizontal command-bar layout for top/bottom edges ──────
        // Spotlight / Raycast / menu-bar style: large input on the
        // left, action chips in the middle, send on the right, output
        // drops down (or up) beneath in a separate panel.
        <div className="fc-cmdbar">
          {liveHint && (
            <button
              type="button"
              className="fc-live-hint"
              onClick={() => void sendText(liveHint.prompt)}
              title="Live Mode suggestion based on the window you're focused on"
            >
              <span className="fc-live-hint-dot" />
              <span className="fc-live-hint-label">{liveHint.label}</span>
            </button>
          )}
          <div className="fc-cmdbar-row">
            <div className="fc-panel-title fc-cmdbar-title">
              <span className="fc-panel-dot" />
              sansxel-1
            </div>
            <form
              className="fc-cmdbar-form"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything, or type a command…"
                autoFocus
                className="fc-cmdbar-input"
              />
              <div className="fc-cmdbar-chips">
                {[
                  { label: "Explain" },
                  { label: "Summarize" },
                  { label: "Code" },
                  { label: "Plan" },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    className="fc-chip"
                    onClick={() =>
                      setInput((cur) =>
                        cur ? `${chip.label}: ${cur}` : `${chip.label}: `,
                      )
                    }
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={!input.trim() || streaming}
                className="fc-send"
              >
                {streaming ? "…" : "Send"}
              </button>
            </form>
            <div className="fc-panel-actions">
              <button
                type="button"
                className={`fc-stream-toggle${streamProof ? " active" : ""}`}
                onClick={() => setStreamProof((s) => !s)}
                title={streamProof ? "Stream-proof on" : "Stream-proof off"}
              >
                {streamProof ? "🔇" : "👁"}
              </button>
              <button
                type="button"
                className="fc-collapse"
                onClick={() => setMode("collapsed")}
                title="Collapse"
                aria-label="Collapse"
              >
                –
              </button>
              <button
                type="button"
                className="fc-close"
                onClick={close}
                aria-label="Close"
                title="Close (Esc)"
              >
                ×
              </button>
            </div>
          </div>

          {messages.length > 0 && (
            <div className="fc-cmdbar-output">
              {messages.map((message, i) => (
                <div key={i} className={`fc-msg fc-msg--${message.role}`}>
                  {message.content || (streaming && i === messages.length - 1 ? "…" : "")}
                </div>
              ))}
              {!streaming && nextActions.length > 0 && (
                <div className="fc-next-actions" role="group" aria-label="Next actions">
                  {nextActions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      className="fc-next-chip"
                      onClick={() => void sendText(action.prompt)}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {mode === "open" && !isHorizontal && (
        // ── Vertical floating panel for left/right edges (existing) ─
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
                {streamProof ? "🔇 Stealth" : "👁 Visible"}
              </button>
              <button
                type="button"
                className="fc-collapse"
                onClick={() => setMode("collapsed")}
                title="Collapse to bar"
                aria-label="Collapse to bar"
              >
                –
              </button>
              <button
                type="button"
                className="fc-close"
                onClick={close}
                aria-label="Close"
                title="Close (Esc)"
              >
                ×
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
              <>
                {messages.map((message, i) => (
                  <div key={i} className={`fc-msg fc-msg--${message.role}`}>
                    {message.content || (streaming && i === messages.length - 1 ? "…" : "")}
                  </div>
                ))}
                {!streaming && nextActions.length > 0 && (
                  <div className="fc-next-actions" role="group" aria-label="Next actions">
                    {nextActions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        className="fc-next-chip"
                        onClick={() => void sendText(action.prompt)}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {liveHint && (
            <button
              type="button"
              className="fc-live-hint"
              onClick={() => void sendText(liveHint.prompt)}
              title="Live Mode suggestion based on the window you're focused on"
            >
              <span className="fc-live-hint-dot" />
              <span className="fc-live-hint-label">{liveHint.label}</span>
            </button>
          )}

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
              placeholder="Ask anything…"
              autoFocus
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming}
              className="fc-send"
            >
              {streaming ? "…" : "Send"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
