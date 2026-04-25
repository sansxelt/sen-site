import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { API_BASE, restoreSession, type DesktopSession } from "./auth";
import {
  getPreferences,
  getSubscription,
  patchPreferences,
  transcribeAudio,
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

// v0.1.14 \u2014 Capsule Rail icon stack. Each icon opens the panel into
// a specific intent so the panel knows which mode to render. Step 2
// will wire intents to actual panel sub-views; Step 1 just gets all
// icons clicking through to the existing panel.
type RailIntent = "main" | "commands" | "attach" | "context" | "voice";

type RailIconDef = {
  intent: RailIntent;
  glyph: string;
  label: string;
  hint: string;
  // v0.1.14 \u2014 Plan-gating. Plan keys ranked: free=0, apprentice=1,
  // studio=1, pro=2. minPlan="free" means everyone can use it; higher
  // tiers gate the icon behind a paid plan and clicking opens /pricing.
  minPlan: "free" | "apprentice" | "pro";
};

const RAIL_ICONS: RailIconDef[] = [
  { intent: "main",     glyph: "\u26a1", label: "Ask",      hint: "Open the copilot \u2014 ask anything", minPlan: "free" },
  { intent: "commands", glyph: "\u2318", label: "Commands", hint: "Quick actions and command palette", minPlan: "free" },
  { intent: "attach",   glyph: "\ud83d\udcce", label: "Attach", hint: "Drag, paste, or pick a file / image / screenshot", minPlan: "apprentice" },
  { intent: "context",  glyph: "\ud83e\udde0", label: "Context", hint: "What sansxel is using as context (MCP)", minPlan: "free" },
  { intent: "voice",    glyph: "\ud83c\udf99\ufe0f", label: "Voice", hint: "Tap to talk \u2014 live transcription", minPlan: "apprentice" },
];

// Plan rank lookup. Used to decide whether the user can access a
// given rail icon. Higher = more access. Anything >= minPlan rank
// is unlocked.
const PLAN_RANK: Record<string, number> = {
  free: 0,
  apprentice: 1,
  studio: 1,
  pro: 2,
  teams: 3,
  enterprise: 3,
};

function planAllows(userPlan: string | null, minPlan: "free" | "apprentice" | "pro"): boolean {
  if (!userPlan) return false;
  const userRank = PLAN_RANK[userPlan.toLowerCase()] ?? 0;
  const minRank = PLAN_RANK[minPlan] ?? 0;
  return userRank >= minRank;
}

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

// v0.1.13: persistent thread history. Each open conversation is one
// CopilotThread. Stored in localStorage so the rail can restore past
// chats on demand without a server round-trip. Capped at 8 threads;
// oldest pruned on overflow.
type CopilotMessage = { role: "user" | "assistant"; content: string };
type CopilotThread = {
  id: string;
  title: string;
  messages: CopilotMessage[];
  createdAt: number;
  updatedAt: number;
};
const COPILOT_THREADS_KEY = "sansxel.copilot.threads.v1";
const COPILOT_THREADS_LIMIT = 8;

function loadCopilotThreads(): CopilotThread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COPILOT_THREADS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (t): t is CopilotThread =>
          !!t &&
          typeof (t as CopilotThread).id === "string" &&
          Array.isArray((t as CopilotThread).messages),
      )
      .slice(0, COPILOT_THREADS_LIMIT);
  } catch {
    return [];
  }
}

function persistCopilotThreads(threads: CopilotThread[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      COPILOT_THREADS_KEY,
      JSON.stringify(threads.slice(0, COPILOT_THREADS_LIMIT)),
    );
  } catch {
    // Quota exceeded or storage disabled \u2014 not fatal.
  }
}

function deriveThreadTitle(messages: CopilotMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New conversation";
  const trimmed = firstUser.content.trim().replace(/\s+/g, " ");
  return trimmed.length > 48 ? trimmed.slice(0, 48) + "\u2026" : trimmed;
}

// v0.1.14 STEP 3 \u2014 Output Block parser. Walks the assistant text and
// splits it into structured blocks the rail can render with actions.
// Code fences (```lang\n...\n```) become CodeBlock; bullet lists
// become SummaryBlock; everything else is a TextBlock. The rendered
// blocks all support per-block actions: Copy / Refine / Rerun.
type OutputBlock =
  | { kind: "text"; text: string }
  | { kind: "code"; language: string; code: string }
  | { kind: "summary"; bullets: string[] };

function parseOutputBlocks(content: string): OutputBlock[] {
  if (!content) return [];
  const blocks: OutputBlock[] = [];
  const fence = /```([\w+-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const segment = content.slice(lastIndex, match.index).trim();
      if (segment) blocks.push(...parseTextSegment(segment));
    }
    blocks.push({
      kind: "code",
      language: (match[1] || "text").trim(),
      code: match[2],
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    const tail = content.slice(lastIndex).trim();
    if (tail) blocks.push(...parseTextSegment(tail));
  }
  return blocks;
}

function parseTextSegment(segment: string): OutputBlock[] {
  // Bullet-list detection: 2+ lines starting with -, *, or 1./2./3.
  const lines = segment.split(/\n/);
  const bulletPattern = /^\s*(?:[-*\u2022]|\d+\.)\s+(.+)/;
  const allBullets = lines.every((l) => l.trim() === "" || bulletPattern.test(l));
  const bulletCount = lines.filter((l) => bulletPattern.test(l)).length;
  if (allBullets && bulletCount >= 2) {
    const bullets = lines
      .map((l) => l.match(bulletPattern)?.[1].trim())
      .filter((v): v is string => Boolean(v));
    return [{ kind: "summary", bullets }];
  }
  return [{ kind: "text", text: segment }];
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// v0.1.14 STEP 3 \u2014 renderer for a single OutputBlock. Each block is
// its own card with the block-type's appropriate display + a row of
// per-block actions (Copy / Refine / Rerun). Code blocks render with
// a language label; summary blocks render as a bulleted card; text
// blocks render as plain prose.
function OutputBlockView({
  block,
  fullText,
  onCopy,
  onRefine,
  onRerun,
}: {
  block: OutputBlock;
  fullText: string;
  onCopy: (text: string) => void;
  onRefine: (text: string) => void;
  onRerun: () => void;
}) {
  const blockText =
    block.kind === "code" ? block.code :
    block.kind === "summary" ? block.bullets.map((b) => `\u2022 ${b}`).join("\n") :
    block.text;

  return (
    <div className={`fc-block fc-block--${block.kind}`}>
      {block.kind === "code" && (
        <div className="fc-block-head">
          <span className="fc-block-tag">{block.language || "code"}</span>
        </div>
      )}
      {block.kind === "summary" && (
        <div className="fc-block-head">
          <span className="fc-block-tag">summary</span>
        </div>
      )}
      <div className="fc-block-body">
        {block.kind === "code" ? (
          <pre className="fc-block-pre"><code>{block.code}</code></pre>
        ) : block.kind === "summary" ? (
          <ul className="fc-block-list">
            {block.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        ) : (
          <p className="fc-block-text">{block.text}</p>
        )}
      </div>
      <div className="fc-block-actions">
        <button
          type="button"
          className="fc-block-action"
          onClick={() => onCopy(blockText)}
          title="Copy to clipboard"
        >
          Copy
        </button>
        <button
          type="button"
          className="fc-block-action"
          onClick={() => onRefine(blockText)}
          title="Ask sansxel to refine this block"
        >
          Refine
        </button>
        <button
          type="button"
          className="fc-block-action"
          onClick={() => onRerun()}
          title="Re-run the prompt that produced this"
        >
          Rerun
        </button>
        {/* Hide the unused fullText prop access warning by referencing it. */}
        <span style={{ display: "none" }}>{fullText.length}</span>
      </div>
    </div>
  );
}

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
  // v0.1.13 \u2014 Hint labels the user has explicitly dismissed this
  // session so we don't keep re-surfacing them every time they alt-tab
  // back to that app. Cleared on copilot window close.
  const [dismissedHints, setDismissedHints] = useState<Set<string>>(() => new Set());
  // v0.1.13 \u2014 Thread history. threads = ordered (newest first).
  // activeThreadId = the thread currently shown; null until first send.
  const [threads, setThreads] = useState<CopilotThread[]>(() => loadCopilotThreads());
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  // v0.1.14 \u2014 Which rail icon was clicked to open the panel. Step 2
  // will route this to different panel sub-views; Step 1 just tracks it.
  const [panelIntent, setPanelIntent] = useState<RailIntent>("main");
  // v0.1.14 \u2014 The user's plan key, fetched once on mount. Drives
  // plan-gating on rail icons. Null while loading; treated as "free".
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [lockedToast, setLockedToast] = useState<string | null>(null);
  // v0.1.14 STEP 4 \u2014 MCP attachments. Files / images dragged or
  // pasted into the panel land here; the Context Panel renders them
  // as removable chips. Sent with the chat request so the model can
  // see them.
  const [attachments, setAttachments] = useState<
    Array<{ id: string; kind: "file" | "image"; name: string; mime: string; size: number; data: string }>
  >([]);
  const [dragOver, setDragOver] = useState(false);
  // v0.1.14 STEP 5 \u2014 voice. recording flag, transcript preview, and
  // refs for the MediaRecorder + stream so we can stop them cleanly.
  const [recording, setRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  // v0.1.12 \u2014 Session refresh wired to BOTH initial mount AND window
  // focus / show. The previous code only restored on mount, so when a
  // user signed out + back in (in the main window) the floating copilot
  // kept using the now-invalidated token and every send returned "copilot
  // 401". Re-running restoreSession() each time the floating window
  // gains focus picks up whatever's currently in the persistent store.
  useEffect(() => {
    let cancelled = false;
    let lastTokenSeen: string | null = null;

    const refresh = async () => {
      try {
        const restored = await restoreSession();
        if (cancelled) return;
        const next = restored?.token ?? null;
        if (next === lastTokenSeen) return;
        lastTokenSeen = next;
        setSession(restored);
      } catch {
        if (!cancelled) setSession(null);
      }
    };

    void refresh();

    const onFocus = () => void refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
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

  // v0.1.14 \u2014 fetch the user's plan once we have a session so the
  // rail can lock icons that need a paid tier (\ud83d\udcce Attach,
  // \ud83c\udf99\ufe0f Voice). Free / unauthenticated falls through to "free".
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const sub = await getSubscription(session.token);
        if (!cancelled) setUserPlan(sub.plan ?? "free");
      } catch {
        if (!cancelled) setUserPlan("free");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

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
  // tick \u2014 the hint engine returns null for windows we don't have
  // good suggestions for, so this is naturally quiet.
  // v0.1.13: respect dismissedHints \u2014 if the user X'd a hint label,
  // don't re-surface it this session even when they alt-tab back.
  // Plus a soft 1500ms debounce so rapid foreground flicker doesn't
  // make the chip flash.
  useEffect(() => {
    if (liveModeConsent !== "granted") {
      setLiveHint(null);
      return;
    }
    let cancelled = false;
    let lastTitle: string | null = null;
    let pendingTimer: number | null = null;
    const apply = (title: string | null) => {
      const hint = deriveLiveHint(title);
      if (hint && dismissedHints.has(hint.label)) {
        setLiveHint(null);
        return;
      }
      setLiveHint(hint);
    };
    const tick = async () => {
      try {
        const title = (await invoke<string | null>("get_foreground_window_title")) ?? null;
        if (cancelled) return;
        if (title === lastTitle) return;
        lastTitle = title;
        if (pendingTimer !== null) window.clearTimeout(pendingTimer);
        pendingTimer = window.setTimeout(() => {
          if (!cancelled) apply(title);
        }, 600);
      } catch {
        // Non-Windows / command not registered yet \u2014 fail quietly
      }
    };
    void tick();
    const handle = window.setInterval(() => void tick(), FOREGROUND_POLL_MS);
    return () => {
      cancelled = true;
      if (pendingTimer !== null) window.clearTimeout(pendingTimer);
      window.clearInterval(handle);
    };
  }, [liveModeConsent, dismissedHints]);

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
      const baseText = (override ?? input).trim();
      // v0.1.14 STEP 4 \u2014 surface attachments to the model. The copilot
      // route doesn't yet accept multipart image content, so for now
      // we describe the attached items inline so the model knows
      // they exist. Clear attachments on send so they don't replay.
      const attachmentNote = attachments.length > 0
        ? `\n\n[Attached: ${attachments.map((a) => `${a.kind === "image" ? "image" : "file"} \u201c${a.name}\u201d`).join(", ")}]`
        : "";
      const text = baseText + attachmentNote;
      if (!baseText || streaming) return;
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
        const streamFormat = res.headers.get("x-sansxel-stream-format") ?? "";
        const isJsonl =
          streamFormat === "jsonl" ||
          contentType.includes("application/x-ndjson") ||
          contentType.includes("application/jsonl");
        if (
          !isJsonl &&
          !contentType.includes("text/plain") &&
          !contentType.includes("text/event-stream")
        ) {
          let body = "";
          try {
            const cloned = await res.text();
            body = cloned.length > 200 ? cloned.slice(0, 200) + "\u2026" : cloned;
          } catch {
            body = "(no body)";
          }
          throw new Error(`Unexpected response (${contentType || "no type"}): ${body}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        // v0.1.13 \u2014 JSON-Lines parser for the desktop surface. Each
        // line is one event: { type: "text" | "tool_start" | "tool_done"
        // | "message_stop" | "error", ... }. Buffer partial lines across
        // chunk boundaries. Plain-text path (web) still works \u2014
        // isJsonl branches all the per-event handling.
        let lineBuffer = "";
        const handleEvent = (event: Record<string, unknown>) => {
          const type = event.type as string | undefined;
          if (type === "text" && typeof event.text === "string") {
            assistant += event.text;
            setMessages((current) => {
              const copy = [...current];
              copy[copy.length - 1] = { role: "assistant", content: assistant };
              return copy;
            });
          } else if (type === "tool_start") {
            const id = String(event.id ?? `tool-${Date.now()}`);
            const name = String(event.name ?? "tool");
            setActiveTools((current) => [
              ...current.filter((t) => t.id !== id),
              { id, name, status: "running" },
            ]);
          } else if (type === "tool_done") {
            const id = String(event.id ?? "");
            const status = (event.status === "error" ? "error" : "ok") as
              | "ok"
              | "error";
            setActiveTools((current) =>
              current.map((t) => (t.id === id ? { ...t, status } : t)),
            );
            // Auto-clear successful tool dots after a beat so the rail
            // doesn't permanently look "occupied" after a single search.
            if (status === "ok") {
              window.setTimeout(() => {
                setActiveTools((current) => current.filter((t) => t.id !== id));
              }, 2400);
            }
          } else if (type === "error" && typeof event.message === "string") {
            // Surface as inline error in the bubble.
            assistant += `\n\u26a0 ${event.message}`;
            setMessages((current) => {
              const copy = [...current];
              copy[copy.length - 1] = { role: "assistant", content: assistant };
              return copy;
            });
          }
          // message_stop is informational; the for-loop ends naturally
          // when the response body is closed by the server.
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            if (!firstByteSeen) {
              firstByteSeen = true;
              setLiveState("streaming");
            }
            const chunk = decoder.decode(value, { stream: true });
            if (isJsonl) {
              lineBuffer += chunk;
              let nl = lineBuffer.indexOf("\n");
              while (nl !== -1) {
                const line = lineBuffer.slice(0, nl).trim();
                lineBuffer = lineBuffer.slice(nl + 1);
                nl = lineBuffer.indexOf("\n");
                if (!line) continue;
                try {
                  handleEvent(JSON.parse(line));
                } catch {
                  // Malformed line \u2014 skip rather than crash the stream.
                }
              }
            } else {
              assistant += chunk;
              setMessages((current) => {
                const copy = [...current];
                copy[copy.length - 1] = { role: "assistant", content: assistant };
                return copy;
              });
            }
          }
        }
        // Flush any trailing partial JSON-Lines line.
        if (isJsonl && lineBuffer.trim()) {
          try {
            handleEvent(JSON.parse(lineBuffer.trim()));
          } catch {
            // ignore trailing malformed
          }
        }
        // Clear any still-running tool dots (server crashed mid-tool).
        setActiveTools((current) => current.filter((t) => t.status !== "running"));
        // v0.1.11: reply finished \u2014 generate next-action chips and
        // flip to "ready" so the rail glows briefly, then decays.
        setNextActions(deriveNextActions(assistant));
        setLiveState("ready");
        // v0.1.14 STEP 4 \u2014 clear attachments so they don't get re-sent
        // on the next turn (user can re-add if they want them again).
        setAttachments([]);

        // v0.1.13 \u2014 persist this turn into thread history. Either
        // updates the active thread or creates a new one if this was
        // the first send of the session. Snapshots the messages at
        // this exact moment so a follow-up turn appends cleanly.
        const finalMessages: CopilotMessage[] = [
          ...messages.filter((m) => m.role !== "assistant" || m.content),
          { role: "user" as const, content: text },
          { role: "assistant" as const, content: assistant },
        ];
        setThreads((prev) => {
          const now = Date.now();
          const existing = activeThreadId
            ? prev.find((t) => t.id === activeThreadId)
            : null;
          let next: CopilotThread[];
          if (existing) {
            next = prev
              .map((t) =>
                t.id === existing.id
                  ? {
                      ...t,
                      messages: finalMessages,
                      title: t.title || deriveThreadTitle(finalMessages),
                      updatedAt: now,
                    }
                  : t,
              )
              // bump active thread to top
              .sort((a, b) => b.updatedAt - a.updatedAt);
          } else {
            const newThread: CopilotThread = {
              id: `t_${now}_${Math.random().toString(36).slice(2, 8)}`,
              title: deriveThreadTitle(finalMessages),
              messages: finalMessages,
              createdAt: now,
              updatedAt: now,
            };
            setActiveThreadId(newThread.id);
            next = [newThread, ...prev];
          }
          const trimmed = next.slice(0, COPILOT_THREADS_LIMIT);
          persistCopilotThreads(trimmed);
          return trimmed;
        });
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

  // v0.1.14 STEP 4 \u2014 read a File into a base64 data URL so we can
  // ship it to the model as an inline attachment. Caps file size at
  // 5MB to keep the request reasonable.
  const ingestFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files);
    list.forEach((file) => {
      if (file.size > 5_000_000) {
        // Too large \u2014 silently skip; could surface a toast later.
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const data = typeof reader.result === "string" ? reader.result : "";
        if (!data) return;
        const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const kind: "file" | "image" = file.type.startsWith("image/") ? "image" : "file";
        setAttachments((prev) => [
          ...prev,
          { id, kind, name: file.name || (kind === "image" ? "Image" : "File"), mime: file.type, size: file.size, data },
        ]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Paste handler captures clipboard images so screenshot \u2192 paste
  // works without leaving the rail.
  const onPanelPaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        ingestFiles(files);
      }
    },
    [ingestFiles],
  );

  const onPanelDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes("Files")) {
      setDragOver(true);
    }
  }, []);

  const onPanelDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOver(false);
  }, []);

  const onPanelDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
    }
  }, []);

  const onPanelDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        ingestFiles(e.dataTransfer.files);
      }
    },
    [ingestFiles],
  );

  // v0.1.14 STEP 5 \u2014 mic capture \u2192 transcribe \u2192 auto-send. Tap once
  // to start recording (state flips to "listening"); tap again to
  // stop. Onstop the recorded blob is shipped to /api/ai/voice/transcribe
  // and the resulting text fires sendText automatically.
  const startVoice = useCallback(async () => {
    if (recording || !session) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        audioChunksRef.current = [];
        // Tear down the underlying tracks so the mic light goes off.
        if (mediaStreamRef.current) {
          for (const track of mediaStreamRef.current.getTracks()) track.stop();
          mediaStreamRef.current = null;
        }
        if (blob.size === 0) return;
        try {
          setLiveState("thinking");
          const text = await transcribeAudio(session.token, blob);
          if (text && text.trim()) {
            setVoiceTranscript(text.trim());
            void sendText(text.trim());
          } else {
            setLiveState("idle");
          }
        } catch {
          setLiveState("idle");
        }
      };
      recorder.start();
      setRecording(true);
      setLiveState("listening");
    } catch {
      setRecording(false);
      setLiveState("idle");
    }
  }, [recording, session, sendText]);

  const stopVoice = useCallback(() => {
    setRecording(false);
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try { recorder.stop(); } catch { /* ignore */ }
    }
    mediaRecorderRef.current = null;
  }, []);

  const toggleVoice = useCallback(() => {
    if (recording) stopVoice();
    else void startVoice();
  }, [recording, startVoice, stopVoice]);

  // v0.1.14 STEP 5 \u2014 if the user clicked the \ud83c\udf99\ufe0f icon from the rail,
  // start recording immediately on panel open so they can just speak.
  useEffect(() => {
    if (mode === "open" && panelIntent === "voice" && !recording && session) {
      void startVoice();
    }
    // intentionally only triggers on intent / mode change, not on recording flips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, panelIntent]);

  // v0.1.13 \u2014 Thread history controls.
  // newChat: clear active thread + messages so the next send starts fresh.
  // openThread: load a thread by id, hydrate messages, mark active.
  const newChat = useCallback(() => {
    setMessages([]);
    setNextActions([]);
    setActiveThreadId(null);
    setHistoryOpen(false);
    setLiveState("idle");
  }, []);

  const openThread = useCallback(
    (id: string) => {
      const thread = threads.find((t) => t.id === id);
      if (!thread) return;
      setMessages(thread.messages);
      setNextActions(deriveNextActions(thread.messages.at(-1)?.content ?? ""));
      setActiveThreadId(id);
      setHistoryOpen(false);
      setLiveState("ready");
    },
    [threads],
  );

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
        // v0.1.14 \u2014 Rail rebuilt as an icon stack per the Capsule Rail
        // spec. Each icon click sets the panel intent + opens the panel.
        // Drag-to-snap still lives on the outer container; icon clicks
        // stop pointer propagation so they don't get swallowed by drag.
        // Position switcher moved to a small bottom cluster (vertical
        // edges) or right cluster (horizontal edges) so it's still
        // reachable but no longer competes with the primary icons.
        <div
          className="fc-bar fc-bar--icons"
          onPointerDown={onCapsulePointerDown}
          onPointerMove={onCapsulePointerMove}
          onPointerUp={onCapsulePointerUp}
          onPointerCancel={onCapsulePointerCancel}
        >
          <div className="fc-bar-icons">
            {RAIL_ICONS.map((icon) => {
              const allowed = planAllows(userPlan, icon.minPlan);
              return (
                <button
                  key={icon.intent}
                  type="button"
                  className={`fc-rail-icon${allowed ? "" : " is-locked"}`}
                  aria-label={allowed ? icon.hint : `${icon.label} \u2014 upgrade to use`}
                  title={allowed ? icon.hint : `${icon.label} requires the ${icon.minPlan} plan or higher \u2014 click to upgrade`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  onPointerMove={(e) => e.stopPropagation()}
                  onClick={() => {
                    if (!allowed) {
                      // v0.1.14 plan-gating \u2014 first click shows the locked
                      // toast, second click opens /pricing in browser.
                      if (lockedToast === icon.intent) {
                        void invoke("open_url", { url: "https://sansxel.ai/pricing" }).catch(() => {});
                        // Tauri opener fallback if open_url isn't a registered command.
                        try {
                          window.open("https://sansxel.ai/pricing", "_blank");
                        } catch { /* ignore */ }
                      } else {
                        setLockedToast(icon.intent);
                        window.setTimeout(() => setLockedToast(null), 4000);
                      }
                      return;
                    }
                    setPanelIntent(icon.intent);
                    setMode("open");
                  }}
                >
                  <span className="fc-rail-icon-glyph" aria-hidden>{icon.glyph}</span>
                  <span className="fc-rail-icon-label">{icon.label}</span>
                  {!allowed && <span className="fc-rail-icon-lock" aria-hidden>\ud83d\udd12</span>}
                </button>
              );
            })}
          </div>
          {lockedToast && (
            <div className="fc-locked-toast" role="status">
              {RAIL_ICONS.find((i) => i.intent === lockedToast)?.label} needs an upgrade. Tap again to open pricing.
            </div>
          )}

          {activeTools.length > 0 && (
            <div className="fc-bar-tools" aria-label="Active tools">
              {activeTools.map((tool) => (
                <span
                  key={tool.id}
                  className={`fc-tool-dot fc-tool-dot--${tool.status}`}
                  title={`${tool.name} \u2014 ${tool.status}`}
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

      {/* v0.1.14 STEP 6 \u2014 The horizontal cmdbar layout was removed.
          All four edges (left/right/top/bottom) now share the v2
          panel layout below. The Tauri window's geometry handles the
          docking; the React panel doesn't need to swap layouts. */}
      {mode === "open" && false && isHorizontal && (
        // ── Horizontal command-bar layout for top/bottom edges ──────
        // Spotlight / Raycast / menu-bar style: large input on the
        // left, action chips in the middle, send on the right, output
        // drops down (or up) beneath in a separate panel.
        <div className="fc-cmdbar">
          {liveHint && ((hint: LiveHint) => (
            <span className="fc-live-hint-wrap">
              <button
                type="button"
                className="fc-live-hint"
                onClick={() => void sendText(hint.prompt)}
                title="Live Mode suggestion based on the window you're focused on"
              >
                <span className="fc-live-hint-dot" />
                <span className="fc-live-hint-label">{hint.label}</span>
              </button>
              {/* v0.1.13 \u2014 dismiss X. Hides this hint label for the
                  rest of the session so it stops re-appearing every
                  time the user alt-tabs back to that app. */}
              <button
                type="button"
                className="fc-live-hint-dismiss"
                title="Hide this suggestion for now"
                aria-label="Dismiss suggestion"
                onClick={() => {
                  const label = hint.label;
                  setDismissedHints((prev) => {
                    const next = new Set(prev);
                    next.add(label);
                    return next;
                  });
                  setLiveHint(null);
                }}
              >
                ×
              </button>
            </span>
          ))(liveHint!)}
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

      {mode === "open" && (
        // ── v0.1.14 STEP 2: Vertical panel restructured per spec ────
        // Header (status + actions) \u2192 COMMAND INPUT (PRIMARY, top) \u2192
        // Quick Actions \u2192 Context Panel \u2192 Output Area (bottom).
        // Input moved from the bottom to the top so the panel reads
        // like a workspace, not a chat. Output streams beneath.
        <div
          className={`fc-panel fc-panel--v2 fc-panel--intent-${panelIntent}${dragOver ? " is-dragover" : ""}`}
          onPaste={onPanelPaste}
          onDragEnter={onPanelDragEnter}
          onDragLeave={onPanelDragLeave}
          onDragOver={onPanelDragOver}
          onDrop={onPanelDrop}
        >
          <div className="fc-panel-head">
            <div className="fc-panel-title">
              <span className="fc-panel-dot" />
              <span className="fc-panel-title-text">sansxel copilot</span>
              <span className={`fc-panel-state fc-panel-state--${liveState}`}>
                {liveState === "thinking" ? "thinking" :
                 liveState === "streaming" ? "streaming" :
                 liveState === "ready" ? "ready" :
                 liveState === "listening" ? "listening" : "idle"}
              </span>
            </div>
            <div className="fc-panel-actions">
              <button
                type="button"
                className="fc-head-btn"
                onClick={newChat}
                title="Start a fresh conversation"
                aria-label="New chat"
              >
                + New
              </button>
              <div className="fc-history-wrap">
                <button
                  type="button"
                  className={`fc-head-btn${historyOpen ? " is-open" : ""}`}
                  onClick={() => setHistoryOpen((v) => !v)}
                  title="Recent conversations"
                  aria-label="Recent conversations"
                  disabled={threads.length === 0}
                >
                  Recent ({threads.length})
                </button>
                {historyOpen && threads.length > 0 && (
                  <div className="fc-history-dropdown" role="menu">
                    {threads.map((thread) => (
                      <button
                        key={thread.id}
                        type="button"
                        className={`fc-history-item${thread.id === activeThreadId ? " is-active" : ""}`}
                        onClick={() => openThread(thread.id)}
                        role="menuitem"
                      >
                        <span className="fc-history-item-title">{thread.title}</span>
                        <span className="fc-history-item-time">{relativeTime(thread.updatedAt)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                className={`fc-stream-toggle${streamProof ? " active" : ""}`}
                onClick={() => setStreamProof((s) => !s)}
                title={streamProof ? "Stream-proof on (invisible to screen recorders)" : "Stream-proof off (visible to screen recorders)"}
              >
                {streamProof ? "🔇" : "👁"}
              </button>
              <button
                type="button"
                className="fc-collapse"
                onClick={() => setMode("collapsed")}
                title="Collapse to rail"
                aria-label="Collapse to rail"
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

          {/* v0.1.14 \u2014 PRIMARY: command input at the top. */}
          <form
            className="fc-command"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                recording ? "Listening\u2026 tap mic again to send" :
                panelIntent === "commands" ? "Run a command\u2026" :
                panelIntent === "voice" ? "Tap mic, or type instead\u2026" :
                panelIntent === "attach" ? "Add a file, or type a question about it\u2026" :
                panelIntent === "context" ? "Ask using your current context\u2026" :
                "Ask anything\u2026"
              }
              autoFocus
              className="fc-command-input"
              disabled={recording}
            />
            {/* v0.1.14 STEP 5 \u2014 Mic. Tap to record; tap again to stop +
                auto-send. Recording state pulses red so the user knows
                the mic is open. */}
            <button
              type="button"
              onClick={toggleVoice}
              className={`fc-voice-btn${recording ? " is-recording" : ""}`}
              title={recording ? "Stop + send" : "Voice input \u2014 tap to start"}
              aria-label="Toggle voice input"
            >
              {recording ? "\u25fc" : "\ud83c\udf99\ufe0f"}
            </button>
            <button
              type="submit"
              disabled={!input.trim() || streaming || recording}
              className="fc-send"
              title="Send (Enter)"
            >
              {streaming ? "\u2026" : "\u2192"}
            </button>
          </form>

          {voiceTranscript && (
            <div className="fc-voice-transcript">
              \u201c{voiceTranscript}\u201d
            </div>
          )}

          {/* v0.1.14 \u2014 Quick Actions row. 4 preset prompts that one-tap
              fire common workflows. Hidden once the conversation has
              messages so the user isn't crowded mid-thread. */}
          {messages.length === 0 && (
            <div className="fc-quick-actions" role="group" aria-label="Quick actions">
              {[
                { label: "Summarize", prompt: "Summarize what I'm currently focused on in 3 bullets." },
                { label: "Explain", prompt: "Explain what I'm looking at like I'm new to it." },
                { label: "Search web", prompt: "Search the web for the latest on " },
                { label: "Draft", prompt: "Draft a short, friendly reply to " },
              ].map((q) => (
                <button
                  key={q.label}
                  type="button"
                  className="fc-quick-action"
                  onClick={() => {
                    if (q.prompt.endsWith(" ")) {
                      // Open-ended prompt \u2014 prefill input, let user finish.
                      setInput(q.prompt);
                    } else {
                      void sendText(q.prompt);
                    }
                  }}
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}

          {/* v0.1.14 STEP 4 \u2014 Context (MCP) preview. Surfaces what the
              AI will see this turn: dragged/pasted attachments, the
              Live Mode hint, and a file-picker affordance. Each item
              has an X to remove. */}
          <div className="fc-context-panel" aria-label="Context">
            <div className="fc-context-head">
              <span className="fc-context-label">Context (MCP)</span>
              <label className="fc-context-attach-btn">
                + Attach
                <input
                  type="file"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files) ingestFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <div className="fc-context-body">
              {attachments.length === 0 && !liveHint && (
                <span className="fc-context-empty">
                  No context attached. Drag a file, paste an image (Ctrl+V), or use Live Mode.
                </span>
              )}
              {attachments.map((att) => (
                <span key={att.id} className={`fc-context-chip fc-context-chip--${att.kind}`}>
                  <span className="fc-context-chip-icon" aria-hidden>
                    {att.kind === "image" ? "\ud83d\uddbc\ufe0f" : "\ud83d\udcc4"}
                  </span>
                  <span className="fc-context-chip-name">{att.name}</span>
                  <button
                    type="button"
                    className="fc-context-chip-x"
                    onClick={() => removeAttachment(att.id)}
                    aria-label={`Remove ${att.name}`}
                    title="Remove"
                  >
                    ×
                  </button>
                </span>
              ))}
              {liveHint && (
                <button
                  type="button"
                  className="fc-context-chip fc-context-chip--live"
                  onClick={() => void sendText(liveHint.prompt)}
                  title="From Live Mode"
                >
                  <span className="fc-context-chip-icon" aria-hidden>\ud83d\udfe3</span>
                  <span className="fc-context-chip-name">{liveHint.label}</span>
                </button>
              )}
            </div>
          </div>

          {/* v0.1.14 STEP 3 \u2014 Output Area renders structured blocks
              (Code / Summary / Text) instead of plain message bubbles.
              Each assistant turn is parsed into one or more blocks
              with their own copy / refine / rerun actions. User turns
              still render as a simple inline pill. */}
          <div className="fc-output">
            {messages.length === 0 ? (
              <div className="fc-output-empty">
                <span className="fc-output-empty-dot" />
                Output will stream here.
              </div>
            ) : (
              <>
                {messages.map((message, i) => {
                  if (message.role === "user") {
                    return (
                      <div key={i} className="fc-user-turn">
                        {message.content}
                      </div>
                    );
                  }
                  const isLast = i === messages.length - 1;
                  const isStreamingThis = streaming && isLast;
                  if (!message.content && isStreamingThis) {
                    return (
                      <div key={i} className="fc-assistant-streaming">
                        <span className="fc-assistant-streaming-dot" />
                        <span className="fc-assistant-streaming-dot" />
                        <span className="fc-assistant-streaming-dot" />
                      </div>
                    );
                  }
                  const blocks = parseOutputBlocks(message.content);
                  return (
                    <div key={i} className="fc-assistant-turn">
                      {blocks.map((block, bi) => (
                        <OutputBlockView
                          key={bi}
                          block={block}
                          fullText={message.content}
                          onCopy={(text) => {
                            void navigator.clipboard.writeText(text).catch(() => {});
                          }}
                          onRefine={(text) =>
                            void sendText(
                              `Refine the block below \u2014 same intent, sharper / cleaner / more correct.\n\n${text}`,
                            )
                          }
                          onRerun={() => {
                            const lastUser = [...messages].reverse().find((m) => m.role === "user");
                            if (lastUser) void sendText(lastUser.content);
                          }}
                        />
                      ))}
                    </div>
                  );
                })}
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

          {/* Live Mode dismissible hint stays at the bottom. */}
          {liveHint && (
            <span className="fc-live-hint-wrap">
              <button
                type="button"
                className="fc-live-hint"
                onClick={() => void sendText(liveHint.prompt)}
                title="Live Mode suggestion based on the window you're focused on"
              >
                <span className="fc-live-hint-dot" />
                <span className="fc-live-hint-label">{liveHint.label}</span>
              </button>
              <button
                type="button"
                className="fc-live-hint-dismiss"
                title="Hide this suggestion for now"
                aria-label="Dismiss suggestion"
                onClick={() => {
                  const label = liveHint.label;
                  setDismissedHints((prev) => {
                    const next = new Set(prev);
                    next.add(label);
                    return next;
                  });
                  setLiveHint(null);
                }}
              >
                ×
              </button>
            </span>
          )}

          {/* v0.1.14 Step 2 \u2014 the bottom input form was removed; the
              command input now lives at the top of the panel as the
              PRIMARY surface (per the spec). */}
        </div>
      )}
    </div>
  );
}
