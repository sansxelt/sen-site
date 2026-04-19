"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Item = {
  id: string;
  label: string;
  section: string;
  hint?: string;
  href?: string;
  action?: () => void;
};

const STATIC_ITEMS: Item[] = [
  // Navigation
  { id: "nav-home",      label: "Home",        section: "Navigate", href: "/home" },
  { id: "nav-features",  label: "Features",    section: "Navigate", href: "/features" },
  { id: "nav-function",  label: "How it works",section: "Navigate", href: "/function" },
  { id: "nav-pricing",   label: "Pricing",     section: "Navigate", href: "/pricing" },
  { id: "nav-contact",   label: "Contact",     section: "Navigate", href: "/contact" },
  { id: "nav-app",       label: "Open chat",   section: "Navigate", href: "/app", hint: "sansxel-1 in browser" },
  { id: "nav-account",   label: "Account",     section: "Navigate", href: "/account" },
  { id: "nav-download",  label: "Download desktop", section: "Navigate", href: "/download" },

  // Account quick jumps
  { id: "acc-settings",      label: "Settings",         section: "Account", href: "/account/settings" },
  { id: "acc-keys",          label: "API keys",         section: "Account", href: "/account/keys" },
  { id: "acc-usage",         label: "Usage",            section: "Account", href: "/account/usage" },
  { id: "acc-updates",       label: "Updates",          section: "Account", href: "/account/updates" },
  { id: "acc-integrations",  label: "Integrations",     section: "Account", href: "/account/integrations" },
  { id: "acc-billing",       label: "Billing",          section: "Account", href: "/account/billing" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Toggle on ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Reset + focus on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      // microtask so the input is mounted
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return STATIC_ITEMS;
    const q = query.trim().toLowerCase();
    return STATIC_ITEMS.filter((it) => {
      const hay = `${it.label} ${it.section} ${it.hint ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query]);

  // Reset active idx when filter changes
  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of filtered) {
      const list = map.get(it.section) ?? [];
      list.push(it);
      map.set(it.section, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const choose = useCallback(
    (item: Item) => {
      setOpen(false);
      if (item.action) item.action();
      else if (item.href) router.push(item.href);
    },
    [router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filtered[activeIdx];
      if (target) choose(target);
    }
  };

  if (!open) return null;

  let runningIdx = 0;

  return (
    <div
      className="hx-cp-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="hx-cp" role="dialog" aria-label="Command palette">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search sansxel.ai…"
          className="hx-cp-input"
          autoComplete="off"
        />

        <div className="hx-cp-list">
          {filtered.length === 0 ? (
            <div className="hx-cp-empty">No matches</div>
          ) : (
            grouped.map(([section, items]) => (
              <div key={section}>
                <div className="hx-cp-section">{section}</div>
                {items.map((it) => {
                  const idx = runningIdx++;
                  return (
                    <div
                      key={it.id}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => choose(it)}
                      className={`hx-cp-item${idx === activeIdx ? " is-active" : ""}`}
                    >
                      <span>{it.label}</span>
                      {it.hint && <span className="hx-cp-item-meta">{it.hint}</span>}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="hx-cp-foot">
          <span>
            <span className="hx-kbd">↑</span>
            <span className="hx-kbd">↓</span> navigate{" "}
            <span className="hx-kbd">↵</span> open{" "}
            <span className="hx-kbd">esc</span> close
          </span>
          <span>
            <span className="hx-kbd">⌘</span>
            <span className="hx-kbd">K</span>
          </span>
        </div>
      </div>
    </div>
  );
}
