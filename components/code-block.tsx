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
]);

function normLang(raw: string | undefined): string | null {
  if (!raw) return null;
  const lang = raw.trim().toLowerCase();
  if (!lang) return null;
  return SUPPORTED.has(lang) ? lang : null;
}

export function CodeBlock({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const langMatch = /language-([\w-]+)/.exec(className ?? "");
  const lang = normLang(langMatch?.[1]);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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

  return (
    <div className="md-codeblock">
      <div className="md-codeblock-head">
        <span className="md-codeblock-lang">{lang ?? "plain"}</span>
        <button
          type="button"
          onClick={copy}
          className="md-codeblock-copy"
          title="Copy code"
        >
          {copied ? "Copied" : "Copy"}
        </button>
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
    </div>
  );
}
