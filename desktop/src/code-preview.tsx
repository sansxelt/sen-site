import { useEffect, useMemo, useRef, useState } from "react";

// v0.1.4 — Live HTML / JS / JSX preview pane (Claude-style artifacts).
//
// The chat view scans assistant streams for fenced code blocks tagged
// `html`, `javascript`, `jsx`, or `tsx`. If a block runs more than ~30
// lines we surface a "Run preview" button under it. Clicking the
// button opens THIS pane on the right side of the chat area and pipes
// the code into a sandboxed iframe (allow-scripts only — no parent
// access, no same-origin, no top-frame nav).
//
// HTML blocks: written straight into iframe srcdoc.
// JS / JSX / TSX: wrapped in a tiny HTML harness that pulls React
//                 from a CDN. JSX/TSX is transpiled with Babel
//                 standalone (also CDN). esbuild-wasm isn't a
//                 dep on the desktop side yet, and pulling it in
//                 just for previews would balloon bundle size for
//                 a feature most users won't hit every day.

export type CodeArtifactLang = "html" | "javascript" | "jsx" | "tsx";

export type CodeArtifact = {
  lang: CodeArtifactLang;
  code: string;
  // Stable id derived from a hash of (lang + code) so the chat view
  // can dedupe when the same block restreams during a partial update.
  id: string;
};

// Detect runnable code blocks in a streamed assistant message. Returns
// every fenced ```html/javascript/jsx/tsx block whose body is at least
// `minLines` lines long. The chat view passes minLines=30 per spec.
const FENCED_BLOCK_RE = /```(html|javascript|jsx|tsx)\r?\n([\s\S]*?)```/g;

export function findCodeArtifacts(
  text: string,
  minLines = 30,
): CodeArtifact[] {
  const out: CodeArtifact[] = [];
  if (!text) return out;
  FENCED_BLOCK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FENCED_BLOCK_RE.exec(text)) !== null) {
    const lang = match[1] as CodeArtifactLang;
    const code = match[2];
    if (!code) continue;
    const lineCount = code.split("\n").length;
    if (lineCount < minLines) continue;
    out.push({ lang, code, id: hashId(`${lang}|${code}`) });
  }
  return out;
}

// Fast non-cryptographic hash → short hex string. Used only for
// stable dedupe keys, not for security. djb2 is plenty here.
function hashId(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return `art_${(h >>> 0).toString(36)}`;
}

// Wrap raw JS / JSX / TSX in an HTML harness that pulls React +
// (for JSX/TSX) Babel standalone from a CDN so the iframe can
// transpile and run client-side. Plain JavaScript skips Babel.
function buildHarness(artifact: CodeArtifact): string {
  const isReact =
    artifact.lang === "jsx" || artifact.lang === "tsx";
  const escaped = artifact.code.replace(/<\/script>/gi, "<\\/script>");
  const scriptTag = isReact
    ? `<script type="text/babel" data-presets="${
        artifact.lang === "tsx" ? "react,typescript" : "react"
      }">\n${escaped}\n</script>`
    : `<script>\n${escaped}\n</script>`;
  const head = isReact
    ? `<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>`
    : "";
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; padding: 12px; background: #fafafa;
                   color: #111; font-family: system-ui, sans-serif; }
      #root { min-height: 100%; }
    </style>
    ${head}
  </head>
  <body>
    <div id="root"></div>
    ${scriptTag}
  </body>
</html>`;
}

type CodePreviewProps = {
  artifact: CodeArtifact;
  onClose: () => void;
};

export function CodePreview({ artifact, onClose }: CodePreviewProps) {
  const [view, setView] = useState<"preview" | "code">("preview");
  const [reloadKey, setReloadKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const srcDoc = useMemo(() => {
    if (artifact.lang === "html") {
      return artifact.code;
    }
    return buildHarness(artifact);
  }, [artifact]);

  // Force a fresh iframe element when the artifact swaps (new id) so
  // we never carry script side-effects from the previous preview.
  useEffect(() => {
    setReloadKey((value) => value + 1);
  }, [artifact.id]);

  return (
    <aside
      className="code-preview-pane"
      aria-label={`Code preview: ${artifact.lang}`}
    >
      <div className="code-preview-head">
        <div className="code-preview-head-text">
          <div className="code-preview-head-kicker">Live preview</div>
          <div className="code-preview-head-title">
            {artifact.lang.toUpperCase()} artifact
          </div>
        </div>
        <div className="code-preview-head-actions">
          <button
            type="button"
            className={`code-preview-tab${view === "preview" ? " active" : ""}`}
            onClick={() => setView("preview")}
          >
            Preview
          </button>
          <button
            type="button"
            className={`code-preview-tab${view === "code" ? " active" : ""}`}
            onClick={() => setView("code")}
          >
            Code
          </button>
          <button
            type="button"
            className="code-preview-tab"
            onClick={() => setReloadKey((value) => value + 1)}
            title="Reload preview"
          >
            Reload
          </button>
          <button
            type="button"
            className="code-preview-close"
            onClick={onClose}
            aria-label="Close preview"
          >
            x
          </button>
        </div>
      </div>

      {view === "preview" ? (
        <iframe
          key={reloadKey}
          ref={iframeRef}
          className="code-preview-frame"
          // sandbox only allows scripts — no same-origin, no parent
          // window access, no top-frame nav. The iframe can't read
          // the user's localStorage or call back into the desktop app.
          sandbox="allow-scripts"
          srcDoc={srcDoc}
          title={`${artifact.lang} preview`}
        />
      ) : (
        <pre className="code-preview-code">{artifact.code}</pre>
      )}
    </aside>
  );
}
