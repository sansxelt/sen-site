// Shared building blocks for the legal / trust pages (privacy, terms, data
// rights, trademark). Plain server components, no client JS.

import type { ReactNode } from "react";

export function H({ children }: { children: ReactNode }) {
  return <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.15rem, 2vw, 1.45rem)", letterSpacing: "-0.02em", color: "var(--fg-1)", margin: "1.9em 0 0.5em" }}>{children}</h2>;
}

export function P({ children }: { children: ReactNode }) {
  return <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "var(--fg-2)", margin: "0 0 1em" }}>{children}</p>;
}

// Visual bullet (a small filled circle), not a text marker, so the list reads
// cleanly without any dot or dash characters in the copy.
export function Ul({ items }: { items: ReactNode[] }) {
  return (
    <ul style={{ margin: "0 0 1em", padding: 0, listStyle: "none", display: "grid", gap: 9 }}>
      {items.map((it, i) => (
        <li key={i} style={{ display: "flex", gap: 11, fontSize: 15, lineHeight: 1.6, color: "var(--fg-2)" }}>
          <span aria-hidden style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--acc-deep)", flex: "none", marginTop: 9 }} />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export function LegalShell({ eyebrow, title, updated, intro, children }: { eyebrow: string; title: string; updated?: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section className="section" style={{ borderBottom: "none" }}>
      <div className="wrap" style={{ maxWidth: 760, paddingTop: "clamp(28px, 4vw, 52px)" }}>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display" style={{ fontSize: "clamp(2rem, 3.4vw, 2.8rem)", marginBottom: updated ? 8 : 14 }}>{title}</h1>
        {updated && <p style={{ fontSize: 13, color: "var(--fg-4)", marginBottom: 22 }}>{updated}</p>}
        {intro && <p className="lead-copy" style={{ marginBottom: 8 }}>{intro}</p>}
        {children}
      </div>
    </section>
  );
}
