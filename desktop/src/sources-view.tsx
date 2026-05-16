import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ChatSource,
  deleteSource,
  listSources,
  uploadSource,
} from "./api";
import type { DesktopSession } from "./auth";

// v0.1.4 — Sources view (RAG scaffold).
//
// Drop-area upload + list of uploaded reference materials. The
// underlying chat route accepts source_ids on each turn; wiring those
// ids INTO the chat send call is the v0.1.5 follow-up. For now this
// view is the management surface.

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ACCEPT_EXTENSIONS = ".pdf,.md,.markdown,.txt";

export function DesktopSourcesView({ session }: { session: DesktopSession }) {
  const [sources, setSources] = useState<ChatSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await listSources(session.token);
      setSources(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load sources.");
    } finally {
      setLoading(false);
    }
  }, [session.token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleUpload = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      setUploading(true);
      setError(null);
      try {
        for (const file of list) {
          const created = await uploadSource(session.token, file);
          setSources((current) => [created, ...current]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(false);
      }
    },
    [session.token],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      // Optimistic remove — restore on failure.
      const previous = sources;
      setSources((current) => current.filter((entry) => entry.id !== id));
      try {
        await deleteSource(session.token, id);
      } catch (err) {
        setSources(previous);
        setError(err instanceof Error ? err.message : "Delete failed.");
      }
    },
    [session.token, sources],
  );

  return (
    <div className="view view--sources">
      <div className="view-head">
        <h1>Sources</h1>
        <p>
          Upload PDFs, Markdown, or text files. Attach them to a chat to give
          VRAELIS-1 reference material for the answer.
        </p>
      </div>

      <div className="view-body">
        <div
          className={`sources-drop${dragOver ? " is-over" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            const files = event.dataTransfer?.files;
            if (files && files.length > 0) void handleUpload(files);
          }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <div className="sources-drop-title">
            {uploading ? "Uploading…" : "Drop files here or click to upload"}
          </div>
          <div className="sources-drop-sub">
            PDF, MD, or TXT — up to 5MB each. PDF text extraction lands in
            v0.1.5; for now PDFs upload as filename references.
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_EXTENSIONS}
            multiple
            style={{ display: "none" }}
            onChange={(event) => {
              const files = event.target.files;
              if (files && files.length > 0) void handleUpload(files);
              event.target.value = "";
            }}
          />
        </div>

        {error && <div className="chat-error">{error}</div>}

        {loading ? (
          <div className="view-loading">Loading sources…</div>
        ) : sources.length === 0 ? (
          <div className="memory-empty">
            <div className="memory-empty-head">No sources yet</div>
            <p>
              Anything you upload here will be available to attach as
              reference material in a future chat turn.
            </p>
          </div>
        ) : (
          <div className="sources-list">
            {sources.map((source) => (
              <div key={source.id} className="sources-row">
                <div className="sources-row-meta">
                  <div className="sources-row-title">{source.title}</div>
                  <div className="sources-row-sub">
                    {formatBytes(source.byte_size)} ·{" "}
                    {new Date(source.created_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  type="button"
                  className="sources-row-del"
                  onClick={() => void handleDelete(source.id)}
                  aria-label={`Delete ${source.title}`}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
