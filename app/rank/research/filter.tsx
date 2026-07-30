"use client";

import Link from "next/link";
import { useState } from "react";

// Category filtering for the chronological feed. A client component only because the filter is interactive;
// the articles themselves are rendered on the server so the text is in the HTML and remains readable and
// indexable with JavaScript off.
type Item = { slug: string; title: string; summary: string; category: string; date: string; minutes: number };

export function ResearchFilter({ categories, items }: { categories: string[]; items: Item[] }) {
  const [active, setActive] = useState<string>("Latest");
  const shown = active === "Latest" ? items : items.filter((i) => i.category === active);
  const tabs = ["Latest", ...categories];

  if (!items.length) return null;

  return (
    <div>
      <div role="tablist" aria-label="Filter research by category" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        {tabs.map((t) => {
          const on = t === active;
          return (
            <button
              key={t}
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t)}
              style={{
                fontFamily: "var(--font-code)", fontSize: 11, letterSpacing: "0.05em",
                padding: "6px 11px", borderRadius: 999, cursor: "pointer",
                border: `1px solid ${on ? "var(--acc-line)" : "var(--line-2)"}`,
                background: on ? "var(--acc-soft)" : "transparent",
                color: on ? "var(--acc-deep)" : "var(--fg-4)",
              }}
            >{t}</button>
          );
        })}
      </div>

      <div>
        {shown.map((a) => (
          <Link key={a.slug} href={`/research/${a.slug}`} style={{
            display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 18, alignItems: "baseline",
            textDecoration: "none", color: "inherit",
            borderTop: "1px solid var(--line-2)", padding: "16px 0",
          }}>
            <span>
              <span style={{ display: "block", fontSize: "1.02rem", fontWeight: 550, letterSpacing: "-0.01em", marginBottom: 5, color: "var(--fg-1)" }}>{a.title}</span>
              <span style={{ display: "block", fontSize: "0.9rem", color: "var(--fg-4)", maxWidth: "62ch", lineHeight: 1.5 }}>{a.summary}</span>
            </span>
            <span style={{ fontFamily: "var(--font-code)", fontSize: 10.5, color: "var(--fg-5)", whiteSpace: "nowrap" }}>
              {a.date}, {a.minutes} min
            </span>
          </Link>
        ))}
        {shown.length === 0 && (
          <p style={{ borderTop: "1px solid var(--line-2)", paddingTop: 18, color: "var(--fg-4)", fontSize: 14 }}>
            Nothing in this category yet.
          </p>
        )}
      </div>
    </div>
  );
}
