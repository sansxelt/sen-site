import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type ChatMessage,
  createNote,
  deleteNote,
  listNotes,
  type Note,
  streamChat,
  updateNote,
} from "./api";
import type { DesktopSession } from "./auth";

const AUTOSAVE_DELAY_MS = 800;

type WorkspaceProps = {
  session: DesktopSession;
  onSignOut: () => void;
};

export function NotesWorkspace({ session, onSignOut }: WorkspaceProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => notes.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId],
  );

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await listNotes(session.token);
        if (cancelled) return;
        setNotes(next);
        if (next.length > 0) setSelectedId(next[0].id);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load notes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.token]);

  const handleNewNote = useCallback(async () => {
    try {
      const note = await createNote(session.token);
      setNotes((prev) => [note, ...prev]);
      setSelectedId(note.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create note.");
    }
  }, [session.token]);

  const handleNoteChange = useCallback(
    (id: string, patch: { title?: string; body?: string }) => {
      // Optimistic local update
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                ...patch,
                updated_at: new Date().toISOString(),
              }
            : n,
        ),
      );
    },
    [],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const previous = notes;
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (selectedId === id) {
        const fallback = previous.find((n) => n.id !== id) ?? null;
        setSelectedId(fallback?.id ?? null);
      }
      try {
        await deleteNote(session.token, id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed.");
        setNotes(previous);
      }
    },
    [notes, selectedId, session.token],
  );

  return (
    <div className="ws">
      <header className="ws-header">
        <div className="ws-brand">
          <div className="main-brand-icon">
            <img src="/icon.png" alt="" />
          </div>
          <span className="main-brand-name">sansxel</span>
          <span className="main-brand-sub">desktop</span>
        </div>
        <div className="ws-header-right">
          <span className="ws-account">{session.email}</span>
          <button
            type="button"
            onClick={onSignOut}
            className="main-auth-link"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="ws-grid">
        <NoteSidebar
          notes={notes}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreate={handleNewNote}
          loading={loading}
        />
        <NoteEditor
          key={selected?.id ?? "empty"}
          note={selected}
          token={session.token}
          onLocalChange={handleNoteChange}
          onDelete={handleDelete}
        />
        <AISidebar token={session.token} note={selected} />
      </div>

      {error && <div className="ws-error">{error}</div>}
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────

function NoteSidebar({
  notes,
  selectedId,
  onSelect,
  onCreate,
  loading,
}: {
  notes: Note[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  loading: boolean;
}) {
  return (
    <aside className="ws-sidebar">
      <div className="ws-sidebar-head">
        <span className="ws-sidebar-title">Notes</span>
        <button
          type="button"
          onClick={onCreate}
          className="ws-newbtn"
          title="New note"
        >
          +
        </button>
      </div>
      <div className="ws-sidebar-list">
        {loading ? (
          <div className="ws-sidebar-empty">Loading…</div>
        ) : notes.length === 0 ? (
          <div className="ws-sidebar-empty">
            No notes yet.
            <br />
            <button
              type="button"
              onClick={onCreate}
              className="ws-empty-link"
            >
              Create your first one
            </button>
          </div>
        ) : (
          notes.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onSelect(n.id)}
              className={`ws-sidebar-item${n.id === selectedId ? " active" : ""}`}
            >
              <span className="ws-sidebar-item-title">
                {n.title || "Untitled"}
              </span>
              <span className="ws-sidebar-item-preview">
                {n.body ? n.body.slice(0, 60) : "Empty note"}
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}

// ── Editor ───────────────────────────────────────────────────────────

function NoteEditor({
  note,
  token,
  onLocalChange,
  onDelete,
}: {
  note: Note | null;
  token: string;
  onLocalChange: (id: string, patch: { title?: string; body?: string }) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    setTitle(note?.title ?? "");
    setBody(note?.body ?? "");
    setSaveState("idle");
  }, [note?.id, note?.title, note?.body]);

  const scheduleSave = useCallback(
    (id: string, patch: { title?: string; body?: string }) => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      setSaveState("saving");
      saveTimer.current = window.setTimeout(async () => {
        try {
          await updateNote(token, id, patch);
          setSaveState("saved");
        } catch {
          setSaveState("idle");
        }
      }, AUTOSAVE_DELAY_MS);
    },
    [token],
  );

  if (!note) {
    return (
      <main className="ws-editor ws-editor--empty">
        <div className="ws-editor-empty-card">
          <h2>Pick a note, or start a new one.</h2>
          <p>
            Notes save automatically. The sansxel-1 panel on the right has the
            current note in mind.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="ws-editor">
      <div className="ws-editor-toolbar">
        <span className="ws-editor-status">
          {saveState === "saving"
            ? "Saving…"
            : saveState === "saved"
              ? "Saved"
              : `Edited ${formatTime(note.updated_at)}`}
        </span>
        <button
          type="button"
          onClick={() => onDelete(note.id)}
          className="ws-editor-delete"
          title="Delete note"
        >
          Delete
        </button>
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => {
          const next = e.target.value;
          setTitle(next);
          onLocalChange(note.id, { title: next });
          scheduleSave(note.id, { title: next });
        }}
        placeholder="Untitled"
        className="ws-editor-title"
      />

      <textarea
        value={body}
        onChange={(e) => {
          const next = e.target.value;
          setBody(next);
          onLocalChange(note.id, { body: next });
          scheduleSave(note.id, { body: next });
        }}
        placeholder="Start writing…"
        className="ws-editor-body"
      />
    </main>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// ── AI sidebar ───────────────────────────────────────────────────────

function AISidebar({ token, note }: { token: string; note: Note | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Reset chat when switching notes
  useEffect(() => {
    setMessages([]);
    setInput("");
    setChatError(null);
  }, [note?.id]);

  // Auto-scroll on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const nextMsgs = [...messages, userMsg];
    setMessages([...nextMsgs, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    setChatError(null);

    try {
      let assistant = "";
      const ctx = note
        ? { note_title: note.title, note_body: note.body }
        : undefined;
      for await (const chunk of streamChat(token, nextMsgs, ctx)) {
        assistant += chunk;
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: assistant };
          return copy;
        });
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Chat failed.");
      // Drop the empty assistant placeholder
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  }, [input, messages, note, streaming, token]);

  return (
    <aside className="ws-ai">
      <div className="ws-ai-head">
        <span className="ws-ai-title">sansxel-1</span>
        <span className="ws-ai-sub">
          {note ? "in this note's context" : "no note selected"}
        </span>
      </div>

      <div className="ws-ai-scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="ws-ai-empty">
            Ask sansxel-1 anything about this note — continue a paragraph,
            summarize, rephrase, brainstorm.
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`ws-ai-msg ws-ai-msg--${m.role}`}
            >
              {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
            </div>
          ))
        )}
        {chatError && <div className="ws-ai-error">{chatError}</div>}
      </div>

      <form
        className="ws-ai-input"
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
          placeholder={streaming ? "Thinking…" : "Ask sansxel-1…"}
          disabled={streaming}
          rows={2}
        />
        <button type="submit" disabled={!input.trim() || streaming}>
          {streaming ? "…" : "Send"}
        </button>
      </form>
    </aside>
  );
}
