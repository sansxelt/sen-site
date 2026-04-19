// v0.1.4 — ChatGPT-style "+" menu that lives to the LEFT of the chat
// input. Opens UPWARD because we sit at the bottom of the chat shell.
// Each menu item maps to one of the v0.1.4 power features. Some of
// the underlying api.ts helpers (deep research, web search, quizzes)
// are being built in parallel by other agents, so the parent wraps
// those calls in try/catch and falls back to a plain text directive
// when the helper isn't there yet.

import { useEffect, useMemo, useRef, useState } from "react";

export type RecentFile = {
  name: string;
  size: number;
  kind: "text" | "image" | "binary";
  body?: string;
  savedAt: string;
};

export type ChatInputMenuAction =
  | "attach"
  | "image"
  | "deep-research"
  | "web-search"
  | "agent-mode"
  | "sources"
  | "canvas"
  | "github"
  | "quizzes";

type Props = {
  agentMode: boolean;
  canvasOpen: boolean;
  recentFiles: RecentFile[];
  onAction: (action: ChatInputMenuAction) => void;
  onPickRecent: (file: RecentFile) => void;
};

// Recent files live in localStorage under this key. FIFO, capped at 8.
export const RECENT_FILES_KEY = "sansxel.recent-files";
export const RECENT_FILES_MAX = 8;

export function loadRecentFiles(): RecentFile[] {
  try {
    const raw = window.localStorage.getItem(RECENT_FILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentFile[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, RECENT_FILES_MAX);
  } catch {
    return [];
  }
}

export function pushRecentFile(file: RecentFile): RecentFile[] {
  const existing = loadRecentFiles().filter((entry) => entry.name !== file.name);
  const next = [file, ...existing].slice(0, RECENT_FILES_MAX);
  try {
    window.localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / unavailable
  }
  return next;
}

const MENU_ITEMS: Array<{
  id: ChatInputMenuAction;
  icon: string;
  label: string;
  blurb: string;
}> = [
  {
    id: "attach",
    icon: "\u{1F4CE}",
    label: "Add photos & files",
    blurb: "Drop images, docs, or text — they ride along with your next message.",
  },
  {
    id: "image",
    icon: "\u{1F5BC}\uFE0F",
    label: "Create image",
    blurb: "Generate an image from your prompt.",
  },
  {
    id: "deep-research",
    icon: "\u{1F52C}",
    label: "Deep research",
    blurb: "Send the prompt through a longer, multi-source pass.",
  },
  {
    id: "web-search",
    icon: "\u{1F310}",
    label: "Web search",
    blurb: "Pull live results from the web before answering.",
  },
  {
    id: "agent-mode",
    icon: "\u2699\uFE0F",
    label: "Agent mode",
    blurb: "Reply as a step-by-step plan you can continue or branch.",
  },
  {
    id: "sources",
    icon: "\u{1F4C4}",
    label: "Add sources",
    blurb: "Open the sources view to upload reference docs.",
  },
  {
    id: "canvas",
    icon: "\u{1F3A8}",
    label: "Canvas",
    blurb: "Toggle the side canvas for sketches and longer drafts.",
  },
  {
    id: "github",
    icon: "\u{1F419}",
    label: "GitHub",
    blurb: "Open the GitHub integration page.",
  },
  {
    id: "quizzes",
    icon: "\u{1F4DD}",
    label: "Quizzes",
    blurb: "Generate a 5-question quiz from your prompt.",
  },
];

export function ChatInputMenu({
  agentMode,
  canvasOpen,
  recentFiles,
  onAction,
  onPickRecent,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click / Escape. Both menu + recent submenu collapse.
  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setShowRecent(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setShowRecent(false);
      }
    };
    window.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const recentLabel = useMemo(() => {
    if (recentFiles.length === 0) return "No recent files yet";
    return `${recentFiles.length} recent file${recentFiles.length === 1 ? "" : "s"}`;
  }, [recentFiles.length]);

  return (
    <div className="chat-plus" ref={rootRef}>
      <button
        type="button"
        className={`chat-icon-btn chat-plus-btn${open ? " is-open" : ""}`}
        onClick={() => {
          setOpen((value) => !value);
          setShowRecent(false);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        title="More actions"
      >
        <PlusIcon />
      </button>

      {open && (
        <div className="chat-plus-menu" role="menu">
          <button
            type="button"
            className="chat-plus-item"
            onClick={() => {
              setOpen(false);
              setShowRecent(false);
              onAction("attach");
            }}
          >
            <span className="chat-plus-item-icon">{MENU_ITEMS[0].icon}</span>
            <span className="chat-plus-item-body">
              <span className="chat-plus-item-label">{MENU_ITEMS[0].label}</span>
              <span className="chat-plus-item-blurb">{MENU_ITEMS[0].blurb}</span>
            </span>
          </button>

          <button
            type="button"
            className={`chat-plus-item chat-plus-item--submenu${showRecent ? " is-open" : ""}`}
            onClick={() => setShowRecent((value) => !value)}
          >
            <span className="chat-plus-item-icon">{"\u{1F552}"}</span>
            <span className="chat-plus-item-body">
              <span className="chat-plus-item-label">Recent files</span>
              <span className="chat-plus-item-blurb">{recentLabel}</span>
            </span>
            <span className="chat-plus-caret">{showRecent ? "\u02C5" : "\u02C3"}</span>
          </button>

          {showRecent && (
            <div className="chat-plus-recent">
              {recentFiles.length === 0 ? (
                <div className="chat-plus-recent-empty">
                  Files you attach will appear here.
                </div>
              ) : (
                recentFiles.map((file) => (
                  <button
                    key={`${file.name}-${file.savedAt}`}
                    type="button"
                    className="chat-plus-recent-item"
                    onClick={() => {
                      setOpen(false);
                      setShowRecent(false);
                      onPickRecent(file);
                    }}
                  >
                    <span className="chat-plus-recent-name">{file.name}</span>
                    <span className="chat-plus-recent-meta">
                      {`${formatBytes(file.size)} \u00B7 ${formatRelative(file.savedAt)}`}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {MENU_ITEMS.slice(1).map((item) => {
            const isAgent = item.id === "agent-mode";
            const isCanvas = item.id === "canvas";
            const isOn = (isAgent && agentMode) || (isCanvas && canvasOpen);
            return (
              <button
                key={item.id}
                type="button"
                className={`chat-plus-item${isOn ? " is-on" : ""}`}
                onClick={() => {
                  setOpen(false);
                  setShowRecent(false);
                  onAction(item.id);
                }}
              >
                <span className="chat-plus-item-icon">{item.icon}</span>
                <span className="chat-plus-item-body">
                  <span className="chat-plus-item-label">
                    {item.label}
                    {isOn && <span className="chat-plus-on">ON</span>}
                  </span>
                  <span className="chat-plus-item-blurb">{item.blurb}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 5V19M5 12H19"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const deltaMs = Date.now() - date.getTime();
  const deltaMin = Math.floor(deltaMs / (1000 * 60));
  if (deltaMin < 1) return "just now";
  if (deltaMin < 60) return `${deltaMin}m ago`;
  const deltaH = Math.floor(deltaMin / 60);
  if (deltaH < 24) return `${deltaH}h ago`;
  const deltaD = Math.floor(deltaH / 24);
  if (deltaD < 7) return `${deltaD}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
