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
  // valid XML so highlight it the same way.
  if (lang === "svg") return "xml";
  return SUPPORTED.has(lang) ? lang : null;
}

// Languages that render to a live preview when expanded. HTML
// and SVG go straight into a sandboxed iframe; everything else
// just hides the Preview button.
const PREVIEWABLE = new Set(["html", "svg"]);

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

  // For SVG code blocks the model usually emits just the <svg>
  // root. Wrap it in a tiny HTML doc so the iframe centers it on
  // a transparent background instead of dropping the SVG flush
  // top-left at native dimensions.
  const previewHtml = previewable
    ? rawLang === "svg"
      ? `<!doctype html><html><head><style>html,body{margin:0;height:100%;display:flex;align-items:center;justify-content:center;background:transparent;}</style></head><body>${code}</body></html>`
      : code
    : "";

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
