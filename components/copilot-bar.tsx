"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";

// Matches a [go:/some/path] marker the model emits to ask for
// navigation. We strip it from displayed text and route after the
// stream finishes.
const GO_MARKER_RE = /\[go:(\/[^\]\s]*)\]/i;
function stripGoMarker(text: string): { display: string; target: string | null } {
  const match = text.match(GO_MARKER_RE);
  if (!match) return { display: text, target: null };
  const display = text.replace(GO_MARKER_RE, "").trim();
  return { display, target: match[1] };
}

type Msg = { role: "user" | "assistant"; content: string };
type Dock = "right" | "left" | "top" | "float";

const DOCK_KEY = "sansxel.copilot.dock";

export function CopilotBar({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dock, setDock] = useState<Dock>("right");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Restore dock choice
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(DOCK_KEY);
    if (saved === "right" || saved === "left" || saved === "top" || saved === "float") {
      setDock(saved);
    }
  }, []);

  const setDockPref = useCallback((next: Dock) => {
    setDock(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DOCK_KEY, next);
    }
  }, []);

  // Hide while signed-out (copilot needs a session) and on auth bridge
  // routes. v0.2.0: copilot is now allowed on /app, defaults to float
  // mode there so it doesn't fight the LEI panel for screen space.
  const hide =
    !signedIn ||
    pathname.startsWith("/desktop-auth") ||
    pathname === "/signin";

  // On /app, snap to float mode the first time the user opens it so
  // the side-dock doesn't crash into the LEI panel stage.
  useEffect(() => {
    if (pathname === "/app" && (dock === "left" || dock === "right")) {
      setDock("float");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ⌘J / Ctrl+J toggles the takeover (⌘K is the command palette)
  useEffect(() => {
    if (hide) return;
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hide, open]);

  // Highlight-to-ask: track selection on the page; when text is
  // selected, store it. The "Ask about this" pill below uses it.
  useEffect(() => {
    if (hide) return;
    const onSelectionChange = () => {
      const sel = window.getSelection?.()?.toString().trim() ?? "";
      setSelection(sel.length > 4 && sel.length < 1200 ? sel : null);
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [hide]);

  // Auto-scroll on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const grabPageContext = useCallback(() => {
    if (typeof document === "undefined") {
      return { title: "", text: "" };
    }
    const main = document.querySelector("main") ?? document.body;
    // Strip nav/header/footer/script/style noise
    const clone = main.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll("nav, header, footer, script, style, .hx-cp, .copilot-bar")
      .forEach((n) => n.remove());
    const text = clone.innerText.replace(/\s+/g, " ").trim().slice(0, 12000);
    return {
      title: document.title,
      text,
    };
  }, []);

  const send = useCallback(
    async (overrideText?: string) => {
      const question = (overrideText ?? input).trim();
      if (!question) return;

      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }

      const ctx = grabPageContext();
      const userMsg: Msg = { role: "user", content: question };
      setMessages((m) => [...m, userMsg, { role: "assistant", content: "" }]);
      setInput("");
      setStreaming(true);

      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const res = await fetch("/api/ai/copilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            page_path: pathname,
            page_title: ctx.title,
            page_text: ctx.text,
            selection: selection ?? undefined,
          }),
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
            const { display } = stripGoMarker(assistant);
            setMessages((m) => {
              const copy = [...m];
              copy[copy.length - 1] = { role: "assistant", content: display };
              return copy;
            });
          }
        }
        // Stream done, if the model emitted [go:/path], navigate.
        // v0.1.13 \u2014 the copilot used to auto-close itself after
        // navigating ("setOpen(false)"), but that punished the user
        // for using a feature that's literally about chaining
        // "where do I go next" questions. Now it stays open across
        // route changes (both marketing + /account routes); the
        // CopilotBar lives in the root layout so React preserves the
        // open state through Next.js navigation. User closes it
        // explicitly via the X / Esc / Ctrl+J.
        const { target } = stripGoMarker(assistant);
        if (target) {
          // Small beat so the user sees the "Heading to\u2026" text first.
          setTimeout(() => {
            try {
              router.push(target);
            } catch {
              // Bad path \u2014 silently ignore; the answer is still shown.
            }
          }, 350);
        }
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          setMessages((m) => {
            const last = m[m.length - 1];
            if (last && last.role === "assistant" && !last.content) {
              return [
                ...m.slice(0, -1),
                {
                  role: "assistant",
                  content:
                    err instanceof Error
                      ? `Couldn't reach copilot: ${err.message}`
                      : "Copilot failed.",
                },
              ];
            }
            return m;
          });
        }
      } finally {
        if (abortRef.current === ac) {
          abortRef.current = null;
          setStreaming(false);
        }
      }
    },
    [input, pathname, selection, grabPageContext, router],
  );

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setStreaming(false);
    }
  }, []);

  const quickActions = useMemo(
    () => [
      { label: "Summarize this page", prompt: "Give me a 2-sentence summary of what this page is about." },
      { label: "Take me to pricing",  prompt: "Take me to the pricing page." },
      { label: "Show my usage",       prompt: "Open my usage page." },
    ],
    [],
  );

  if (hide) return null;

  // ── Closed state: floating launcher button ─────────────────────
  // v0.1.16, Always bottom-right. Mobile clearance (above the
  // dashboard bottom nav) handled in CSS via a media query.
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="copilot-launcher hx-press"
        title="Open copilot (⌘J)"
        aria-label="Open copilot"
      >
        <SparkIcon />
      </button>
    );
  }

  // ── Open state: docked panel (top / left / right) ─────────────
  return (
    <div
      className={`copilot-bar copilot-bar--${dock}`}
      role="dialog"
      aria-label="Copilot"
    >
      <div className="copilot-head">
        <div className="copilot-title">
          <SparkIcon />
          <span>Copilot</span>
        </div>
        <div className="copilot-head-actions">
          <DockToggle dock={dock} onChange={setDockPref} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="copilot-x"
            aria-label="Close"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="copilot-context">
        <span className="copilot-context-label">On</span>
        <code className="copilot-context-value">{pathname}</code>
      </div>

      {messages.length === 0 && (
        <div className="copilot-quick">
          {quickActions.map((qa) => (
            <button
              key={qa.label}
              type="button"
              onClick={() => void send(qa.prompt)}
              className="copilot-quick-btn hx-press"
            >
              {qa.label}
            </button>
          ))}
        </div>
      )}

      <div className="copilot-scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="copilot-empty">
            <p>
              Ask anything, about sansxel, this page, or wherever your
              head's at. I can also take you anywhere on the site.
            </p>
            <div className="copilot-mcp-card">
              <div className="copilot-mcp-tag">Desktop only</div>
              <div className="copilot-mcp-title">MCP tools</div>
              <p>
                In the desktop app, sansxel-1 can read files, run code, and
                connect to your tools through the Model Context Protocol.
                Examples:
              </p>
              <ul>
                <li>
                  <span className="copilot-mcp-mono">read this folder</span>
                  scan a directory for context
                </li>
                <li>
                  <span className="copilot-mcp-mono">edit my resume.docx</span>
                  modify a file in place
                </li>
                <li>
                  <span className="copilot-mcp-mono">connect Notion</span>
                  pull pages into the conversation
                </li>
              </ul>
              <p className="copilot-mcp-foot">
                MCP is desktop-only because it needs file + tool access the
                browser can't grant.
              </p>
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`copilot-msg copilot-msg--${m.role}`}
            >
              {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
            </div>
          ))
        )}
      </div>

      {selection && (
        <button
          type="button"
          onClick={() =>
            void send(`Explain this excerpt: "${selection}"`)
          }
          className="copilot-selection hx-press"
          title="Ask copilot about your selection"
        >
          Ask about: <em>{selection.slice(0, 80)}{selection.length > 80 ? "…" : ""}</em>
        </button>
      )}

      <form
        className="copilot-input"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything, or say where to go…"
          autoFocus
        />
        {streaming ? (
          <button type="button" onClick={stop} className="copilot-send copilot-send--stop">
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!input.trim()} className="copilot-send">
            Ask
          </button>
        )}
      </form>
    </div>
  );
}

function DockToggle({
  dock,
  onChange,
}: {
  dock: Dock;
  onChange: (d: Dock) => void;
}) {
  return (
    <div className="copilot-dock-toggle" role="group" aria-label="Dock position">
      <button
        type="button"
        onClick={() => onChange("top")}
        className={dock === "top" ? "is-active" : ""}
        title="Dock top"
        aria-label="Dock top"
      >▔</button>
      <button
        type="button"
        onClick={() => onChange("left")}
        className={dock === "left" ? "is-active" : ""}
        title="Dock left"
        aria-label="Dock left"
      >▏</button>
      <button
        type="button"
        onClick={() => onChange("right")}
        className={dock === "right" ? "is-active" : ""}
        title="Dock right"
        aria-label="Dock right"
      >▕</button>
      <button
        type="button"
        onClick={() => onChange("float")}
        className={dock === "float" ? "is-active" : ""}
        title="Float (drag to move)"
        aria-label="Float"
      >◳</button>
    </div>
  );
}

function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2 L13.5 9 L20 11 L13.5 13 L12 20 L10.5 13 L4 11 L10.5 9 Z" />
    </svg>
  );
}
