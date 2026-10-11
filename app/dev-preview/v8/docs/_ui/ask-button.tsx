"use client";

import { openAsk } from "./events";

// The Ask AI entry (the docs bar on both hosts) and its icon, apart from the panel so the docs bar can import it
// without importing the panel.

export function AskIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 12.5a7.5 7.5 0 0 1-11.1 6.6L4 20l1-4.4A7.5 7.5 0 1 1 20 12.5Z" /><path d="M9 11h6M9 14.5h3.5" />
    </svg>
  );
}

export function AskButton() {
  return (
    <button type="button" className="v8-docs-askbtn" onClick={() => openAsk()} aria-haspopup="dialog" aria-label="Ask AI about these docs">
      <AskIcon /><span>Ask AI</span>
    </button>
  );
}
