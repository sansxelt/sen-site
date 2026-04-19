import { useEffect, useState } from "react";

// v0.1.4 — Canvas (collaborative editing surface).
//
// The assistant can emit a `[canvas:Title]…content…[/canvas]` block in
// its reply. The chat view detects that, pops this side pane open with
// the latest block as the document. The user can edit, then click
// "Save back to chat" which appends a fresh user message containing
// the updated content. One canvas at a time — re-emitting just swaps
// the contents and keeps the pane open.

const CANVAS_REGEX = /\[canvas:([^\]]+)\]([\s\S]*?)\[\/canvas\]/g;

export type CanvasBlock = {
  title: string;
  content: string;
};

// Pull the LAST canvas block from a string. Returns null if none.
// Last-wins because if the assistant streams a fresh canvas in a new
// turn we want to show that one, not the stale one from earlier.
export function extractLatestCanvas(text: string): CanvasBlock | null {
  if (!text) return null;
  let match: RegExpExecArray | null;
  let last: CanvasBlock | null = null;
  CANVAS_REGEX.lastIndex = 0;
  while ((match = CANVAS_REGEX.exec(text)) !== null) {
    last = {
      title: match[1].trim() || "Canvas",
      content: match[2].trim(),
    };
  }
  return last;
}

// Strip canvas blocks out of the assistant's text so the chat bubble
// doesn't show the raw [canvas:...]...[/canvas] markup. The chat view
// uses this when rendering — the canvas pane has the real content.
export function stripCanvasBlocks(text: string): string {
  return text.replace(CANVAS_REGEX, "").replace(/\n{3,}/g, "\n\n").trim();
}

type DesktopCanvasProps = {
  block: CanvasBlock;
  onSaveBack: (updated: string) => void;
  onClose: () => void;
};

export function DesktopCanvas({
  block,
  onSaveBack,
  onClose,
}: DesktopCanvasProps) {
  const [content, setContent] = useState(block.content);

  // When the assistant emits a fresh canvas (new title or content),
  // we reset the local edit buffer to match. Otherwise the pane would
  // strand the user on the old draft after the model rewrote it.
  useEffect(() => {
    setContent(block.content);
  }, [block.title, block.content]);

  return (
    <aside className="canvas-pane" aria-label={`Canvas: ${block.title}`}>
      <div className="canvas-head">
        <div className="canvas-head-text">
          <div className="canvas-head-kicker">Canvas</div>
          <div className="canvas-head-title">{block.title}</div>
        </div>
        <button
          type="button"
          className="canvas-head-close"
          onClick={onClose}
          aria-label="Close canvas"
        >
          ×
        </button>
      </div>

      <textarea
        className="canvas-body"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        spellCheck
      />

      <div className="canvas-foot">
        <button
          type="button"
          className="canvas-save"
          onClick={() => onSaveBack(content)}
        >
          Save back to chat
        </button>
      </div>
    </aside>
  );
}
