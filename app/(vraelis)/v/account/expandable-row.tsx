"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

/**
 * The expandable Setup checklist rows (SMS, deposit) hold their open/closed
 * state in a client component so it SURVIVES a router.refresh(). A plain
 * server-rendered <details> reverts to closed on every refresh, which made the
 * row snap shut after each save. With useState the row stays open while the
 * fresh server data (the checklist status line) renders around it.
 */
export function ExpandableRow({
  summary,
  rowStyle,
  children,
}: {
  summary: ReactNode;
  rowStyle: CSSProperties;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary style={{ ...rowStyle, cursor: "pointer", listStyle: "none" }}>{summary}</summary>
      <div style={{ padding: "4px 0 14px 29px" }}>{children}</div>
    </details>
  );
}
