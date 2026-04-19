import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ALL_MODEL_OPTIONS,
  type ChatMessage,
  type ModelTier,
  streamChat,
} from "./api";
import type { DesktopSession } from "./auth";

type View = "chat" | "account" | "plan" | "preferences";

type WorkspaceProps = {
  session: DesktopSession;
  onSignOut: () => void;
};

export function Workspace({ session, onSignOut }: WorkspaceProps) {
  const [view, setView] = useState<View>("chat");

  return (
    <div className="ws">
      <NavRail
        active={view}
        onChange={setView}
        onSignOut={onSignOut}
        email={session.email}
      />
      <div className="ws-main">
        {view === "chat" && <ChatView session={session} />}
        {view === "account" && <AccountView session={session} />}
        {view === "plan" && <PlanView session={session} />}
        {view === "preferences" && <PreferencesView />}
      </div>
    </div>
  );
}

// ── Nav rail ─────────────────────────────────────────────────────────

function NavRail({
  active,
  onChange,
  onSignOut,
  email,
}: {
  active: View;
  onChange: (v: View) => void;
  onSignOut: () => void;
  email: string;
}) {
  const initial = email.slice(0, 1).toUpperCase();
  return (
    <aside className="ws-nav">
      <div className="ws-nav-brand" title="sansxel">
        <img src="/icon.png" alt="" />
      </div>

      <div className="ws-nav-items">
        <NavButton
          active={active === "chat"}
          onClick={() => onChange("chat")}
          label="Chat"
        >
          <ChatIcon />
        </NavButton>
        <NavButton
          active={active === "account"}
          onClick={() => onChange("account")}
          label="Account"
        >
          <AccountIcon />
        </NavButton>
        <NavButton
          active={active === "plan"}
          onClick={() => onChange("plan")}
          label="Plan"
        >
          <PlanIcon />
        </NavButton>
        <NavButton
          active={active === "preferences"}
          onClick={() => onChange("preferences")}
          label="Preferences"
        >
          <PrefsIcon />
        </NavButton>
      </div>

      <div className="ws-nav-foot">
        <button
          type="button"
          className="ws-nav-avatar"
          onClick={onSignOut}
          title={`Sign out (${email})`}
        >
          {initial}
        </button>
      </div>
    </aside>
  );
}

function NavButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`ws-nav-btn${active ? " active" : ""}`}
      aria-label={label}
    >
      {children}
    </button>
  );
}

// ── Chat view (the main interaction) ─────────────────────────────────

function ChatView({ session }: { session: DesktopSession }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [tier, setTier] = useState<ModelTier>("balanced");
  const [planNotice, setPlanNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text) return;

    // If a previous stream is still running, abort it. The new
    // message takes priority (same UX as ChatGPT).
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    const userMsg: ChatMessage = { role: "user", content: text };
    const nextMsgs = [...messages, userMsg];
    setMessages([...nextMsgs, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    setChatError(null);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      let assistant = "";
      for await (const chunk of streamChat(session.token, nextMsgs, {
        tier,
        signal: ac.signal,
        onMeta: (meta) => {
          if (
            meta.tier_requested &&
            meta.tier_resolved &&
            meta.tier_requested !== meta.tier_resolved
          ) {
            setPlanNotice(
              `Your plan doesn't include ${meta.tier_requested} — replied with ${meta.tier_resolved} instead.`,
            );
          } else {
            setPlanNotice(null);
          }
        },
      })) {
        assistant += chunk;
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: assistant };
          return copy;
        });
      }
    } catch (err) {
      // Aborts are intentional, not errors
      if ((err as { name?: string })?.name === "AbortError") {
        return;
      }
      setChatError(err instanceof Error ? err.message : "Chat failed.");
      setMessages((prev) => {
        // If the in-flight assistant is empty, drop it. Otherwise keep
        // the partial response so the user sees what arrived.
        const last = prev[prev.length - 1];
        if (last && last.role === "assistant" && !last.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      if (abortRef.current === ac) {
        abortRef.current = null;
        setStreaming(false);
      }
    }
  }, [input, messages, session.token, tier]);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setStreaming(false);
    }
  }, []);

  const showEmpty = messages.length === 0;

  return (
    <div className="chat">
      <div className="chat-topbar">
        <ModelPicker tier={tier} onChange={setTier} />
      </div>

      {planNotice && (
        <div className="chat-plan-notice">
          {planNotice}
          <button
            type="button"
            className="chat-plan-notice-x"
            onClick={() => setPlanNotice(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <div className="chat-scroll" ref={scrollRef}>
        {showEmpty ? (
          <div className="chat-empty">
            <div className="chat-empty-mark">sansxel-1</div>
            <h2>Ask anything.</h2>
            <p>Ideas, drafts, code, plans — the AI that remembers what you’re building.</p>
          </div>
        ) : (
          <div className="chat-list">
            {messages.map((m, i) => {
              const isLast = i === messages.length - 1;
              const isInflight =
                isLast && m.role === "assistant" && streaming && m.content === "";
              return (
                <div
                  key={i}
                  className={`chat-msg chat-msg--${m.role}`}
                >
                  {isInflight ? <BounceDots /> : m.content}
                </div>
              );
            })}
            {chatError && <div className="chat-error">{chatError}</div>}
          </div>
        )}
      </div>

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Message sansxel-1…"
          rows={1}
        />
        <div className="chat-input-actions">
          {/* Voice button — wired up next push */}
          <button
            type="button"
            className="chat-icon-btn"
            title="Voice (coming next)"
            disabled
          >
            <MicIcon />
          </button>
          {streaming ? (
            <button
              type="button"
              onClick={stop}
              className="chat-send chat-send--stop"
              title="Stop"
            >
              <StopIcon />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="chat-send"
              title="Send"
            >
              <SendIcon />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function ModelPicker({
  tier,
  onChange,
}: {
  tier: ModelTier;
  onChange: (t: ModelTier) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = ALL_MODEL_OPTIONS.find((m) => m.tier === tier) ?? ALL_MODEL_OPTIONS[0];

  return (
    <div className="model-picker">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="model-picker-trigger"
      >
        <span className="model-picker-name">{current.display_name}</span>
        <span className="model-picker-caret">▾</span>
      </button>
      {open && (
        <div className="model-picker-menu">
          {ALL_MODEL_OPTIONS.map((opt) => (
            <button
              type="button"
              key={opt.tier}
              onClick={() => {
                onChange(opt.tier);
                setOpen(false);
              }}
              className={`model-picker-item${opt.tier === tier ? " active" : ""}`}
            >
              <div className="model-picker-item-name">{opt.display_name}</div>
              <div className="model-picker-item-blurb">{opt.blurb}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BounceDots() {
  return (
    <span className="chat-dots" aria-label="Thinking">
      <span className="chat-dot" />
      <span className="chat-dot" />
      <span className="chat-dot" />
    </span>
  );
}

// ── Other views (placeholders — real data lands next push) ──────────

function AccountView({ session }: { session: DesktopSession }) {
  const display = session.displayName ?? session.email;
  return (
    <div className="view">
      <div className="view-head">
        <h1>Account</h1>
        <p>Signed in to sansxel.ai as {display}.</p>
      </div>
      <div className="view-body">
        <FieldRow label="Email" value={session.email} />
        <FieldRow label="Display name" value={session.displayName ?? "—"} />
        <ComingSoon>
          Editable profile fields, password change, and a list of every signed-in
          desktop with revoke buttons land in the next iteration.
        </ComingSoon>
      </div>
    </div>
  );
}

function PlanView({ session: _session }: { session: DesktopSession }) {
  return (
    <div className="view">
      <div className="view-head">
        <h1>Plan</h1>
        <p>Your subscription, usage, and upgrades.</p>
      </div>
      <div className="view-body">
        <ComingSoon>
          Live plan from your sansxel.ai subscription, per-feature usage meters,
          and one-click upgrades to Apprentice / Studio / Pro plug in here next.
        </ComingSoon>
      </div>
    </div>
  );
}

function PreferencesView() {
  return (
    <div className="view">
      <div className="view-head">
        <h1>Preferences</h1>
        <p>How sansxel adapts to you.</p>
      </div>
      <div className="view-body">
        <ComingSoon>
          Focus area, work style, summary style, density, theme — these will
          actually change the desktop UI/UX once wired up.
        </ComingSoon>
      </div>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="field-row">
      <div className="field-label">{label}</div>
      <div className="field-value">{value}</div>
    </div>
  );
}

function ComingSoon({ children }: { children: React.ReactNode }) {
  return (
    <div className="coming-soon">
      <div className="coming-soon-tag">Up next</div>
      <p>{children}</p>
    </div>
  );
}

// ── Inline icons ─────────────────────────────────────────────────────

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function PlanIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6l9 14 9-14-3-4z" />
      <path d="M3 6h18" />
      <path d="m9 6 3 14 3-14" />
    </svg>
  );
}

function PrefsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
