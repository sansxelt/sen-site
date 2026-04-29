"use client";

import { useEffect, useState } from "react";
import { codeToHtml } from "shiki/bundle/web";

// Code block with Shiki syntax highlighting + copy-to-clipboard.
// Drop-in replacement for ReactMarkdown's default <code> block
// renderer. Streaming-friendly: re-runs highlight on every content
// change, falls back to plain text instantly while Shiki loads.

const SHIKI_THEME = "vesper" as const;

// Shiki's web bundle ships with a curated language set. Keep this
// list to ones the model actually emits in chat (most common
// programming + config + markup). Unknown langs fall through to
// plain text, no error.
const SUPPORTED = new Set<string>([
  "javascript",
  "js",
  "jsx",
  "typescript",
  "ts",
  "tsx",
  "python",
  "py",
  "ruby",
  "rb",
  "go",
  "rust",
  "rs",
  "java",
  "kotlin",
  "swift",
  "csharp",
  "cs",
  "cpp",
  "c",
  "html",
  "css",
  "scss",
  "json",
  "yaml",
  "yml",
  "toml",
  "sql",
  "bash",
  "sh",
  "shell",
  "powershell",
  "ps1",
  "markdown",
  "md",
  "diff",
  "graphql",
  "dockerfile",
  "ini",
  "xml",
  "lua",
  "r",
  "php",
  "xml",
]);

function normLang(raw: string | undefined): string | null {
  if (!raw) return null;
  const lang = raw.trim().toLowerCase();
  if (!lang) return null;
  // Shiki ships an xml grammar but no separate svg one; SVG is
  // valid XML so highlight it the same way. JSX and React both
  // use jsx; tsx is a separate Shiki grammar.
  if (lang === "svg") return "xml";
  if (lang === "react") return "jsx";
  if (lang === "py") return "python";
  return SUPPORTED.has(lang) ? lang : null;
}

// Builds the iframe srcDoc per language. Each preview is loaded
// from a vendor CDN (esm.sh / jsdelivr) inside the sandbox so the
// host page doesn't ship the runtime weight unless the user opens
// a preview. Sandbox is allow-scripts only (no same-origin) so
// the iframe is treated as a unique origin and CDN scripts run
// without leaking into the host.
function escapeForScriptTag(s: string): string {
  return s.replace(/<\/script>/g, "<\\/script>");
}

function buildPreviewHtml(rawLang: string, code: string): string {
  if (rawLang === "html") return code;
  if (rawLang === "svg") {
    return `<!doctype html><html><head><style>html,body{margin:0;height:100%;display:flex;align-items:center;justify-content:center;background:transparent;}</style></head><body>${code}</body></html>`;
  }
  if (rawLang === "jsx" || rawLang === "tsx" || rawLang === "react") {
    const escaped = escapeForScriptTag(code);
    // Heuristic: if the snippet doesn't already render to #root we
    // assume it's a single component or expression and try a few
    // common shapes (default export, App symbol, expression).
    const bootstrap = `
      const root = ReactDOM.createRoot(document.getElementById('root'));
      try {
        let mod = null;
        try { mod = (typeof App !== 'undefined') ? App : null; } catch (_) {}
        if (!mod) {
          try { mod = (typeof Component !== 'undefined') ? Component : null; } catch (_) {}
        }
        if (mod) {
          root.render(React.createElement(mod));
        } else if (typeof __jsx_default !== 'undefined') {
          root.render(React.createElement(__jsx_default));
        }
      } catch (e) {
        document.getElementById('root').innerHTML =
          '<pre style="color:#f87171;white-space:pre-wrap;padding:14px;font:12px ui-monospace,monospace;">' +
          (e && e.stack ? e.stack : String(e)) + '</pre>';
      }
    `;
    return `<!doctype html><html><head><meta charset="utf-8"/>
<style>html,body{margin:0;background:transparent;font-family:system-ui,-apple-system,sans-serif;color:#0a0a0c;}#root{padding:14px;}</style>
<script src="https://unpkg.com/react@19/umd/react.development.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@19/umd/react-dom.development.js" crossorigin></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js" crossorigin></script>
</head><body>
<div id="root"></div>
<script type="text/babel" data-presets="${rawLang === "tsx" ? "typescript,react" : "react"}">
const __jsx_default = (function(){
${escaped}
})();
</script>
<script type="text/babel" data-presets="react">${escapeForScriptTag(bootstrap)}</script>
</body></html>`;
  }
  if (rawLang === "python" || rawLang === "py") {
    const escaped = code.replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
    return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  html,body{margin:0;background:transparent;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;color:#0a0a0c;font-size:13px;}
  #out{padding:14px;white-space:pre-wrap;line-height:1.55;}
  #status{padding:14px;color:#737373;font-style:italic;}
  .err{color:#dc2626;}
</style>
<script src="https://cdn.jsdelivr.net/pyodide/v0.28.0/full/pyodide.js"></script>
</head><body>
<div id="status">Booting Python (Pyodide)…</div>
<div id="out"></div>
<script>
(async () => {
  const out = document.getElementById('out');
  const status = document.getElementById('status');
  try {
    const py = await loadPyodide();
    let buf = '';
    py.setStdout({ batched: (s) => { buf += s; out.textContent = buf; } });
    py.setStderr({ batched: (s) => { buf += s; out.textContent = buf; } });
    status.textContent = 'Running…';
    await py.runPythonAsync(\`${escaped}\`);
    status.textContent = 'Done.';
  } catch (e) {
    status.innerHTML = '<span class="err">Python error</span>';
    out.textContent = (e && e.message) ? e.message : String(e);
  }
})();
</script>
</body></html>`;
  }
  return code;
}

// Languages that render to a live preview when expanded. Each
// path builds its own srcDoc:
//   html, svg            -> rendered directly
//   jsx, tsx, react      -> Babel-standalone + React from a CDN,
//                           wraps the snippet in a default export
//                           if it isn't one already.
//   python, py           -> Pyodide from a CDN, captures stdout
//                           into a <pre> below the code.
const PREVIEWABLE = new Set([
  "html",
  "svg",
  "jsx",
  "tsx",
  "react",
  "python",
  "py",
]);

export function CodeBlock({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const langMatch = /language-([\w-]+)/.exec(className ?? "");
  const lang = normLang(langMatch?.[1]);
  const rawLang = (langMatch?.[1] ?? "").trim().toLowerCase();
  const previewable = PREVIEWABLE.has(rawLang);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const code = String(children).replace(/\n$/, "");

  useEffect(() => {
    let cancelled = false;
    if (!lang) {
      setHighlighted(null);
      return;
    }
    void codeToHtml(code, { lang, theme: SHIKI_THEME })
      .then((html) => {
        if (!cancelled) setHighlighted(html);
      })
      .catch(() => {
        if (!cancelled) setHighlighted(null);
      });
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore, clipboard unavailable
    }
  }

  const previewHtml = previewable ? buildPreviewHtml(rawLang, code) : "";

  return (
    <div className="md-codeblock">
      <div className="md-codeblock-head">
        <span className="md-codeblock-lang">{lang ?? "plain"}</span>
        <div className="md-codeblock-actions">
          {previewable && (
            <button
              type="button"
              onClick={() => setPreviewOpen((o) => !o)}
              className="md-codeblock-action"
              title={previewOpen ? "Hide preview" : "Render in a sandbox"}
            >
              {previewOpen ? "Hide preview" : "Preview"}
            </button>
          )}
          <button
            type="button"
            onClick={copy}
            className="md-codeblock-action"
            title="Copy code"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      {highlighted ? (
        <div
          className="md-codeblock-body md-codeblock-body--shiki"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      ) : (
        <pre className="md-codeblock-body md-codeblock-body--plain">
          <code>{code}</code>
        </pre>
      )}
      {previewable && previewOpen && (
        <div className="md-codeblock-preview">
          <iframe
            // sandbox="allow-scripts" lets demos run JS (charts,
            // animations, interactive widgets) without giving the
            // iframe access to cookies, top-level navigation, or
            // form submission. allow-same-origin is intentionally
            // omitted so the iframe is treated as a unique origin.
            sandbox="allow-scripts"
            srcDoc={previewHtml}
            title={`${rawLang} preview`}
            className="md-codeblock-preview-frame"
          />
        </div>
      )}
    </div>
  );
}
