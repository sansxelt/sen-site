"use client";

// The command surface. Cmd/Ctrl-K anywhere in the product.
//
// It searches TWO real things and invents neither: the destinations that exist in the navigation, and the
// systems this member can actually see (passed down from the server layout, member-scoped). There is no
// fuzzy index of "recent activity" and no suggestion engine, because both would need to fabricate relevance
// from data the product does not keep, and a command bar that offers a thing that is not there is worse than
// no command bar.
//
// KEYBOARD FIRST, AND ACTUALLY. Arrow keys move, Enter goes, Escape closes and returns focus to whatever had
// it. The list is a listbox with aria-activedescendant rather than roving tabindex, so a screen reader
// announces the highlighted row while typing continues in the input.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ic, I } from "./icons";
import { useDismiss } from "./use-dismiss";

export type PaletteSystem = { id: string; name: string };
type Item = { id: string; label: string; hint: string; href: string; icon: string };

const DESTINATIONS: Item[] = [
  { id: "d-overview", label: "Overview", hint: "Operational state", href: "/app", icon: I.grid },
  { id: "d-systems", label: "Systems", hint: "Everything Vraelis watches", href: "/systems", icon: I.layers },
  { id: "d-guarantees", label: "Guarantees", hint: "Standing promises", href: "/guarantees", icon: I.shield },
  { id: "d-verifications", label: "Verifications", hint: "Decisions and evidence", href: "/verifications", icon: I.vote },
  { id: "d-review", label: "Review", hint: "Plans awaiting a person", href: "/review", icon: I.eye },
  { id: "d-records", label: "Records", hint: "The permanent trail", href: "/records", icon: I.fileText },
  { id: "d-integrations", label: "Integrations", hint: "GitHub, Vercel, Slack and more", href: "/connections", icon: I.key },
  { id: "d-developers", label: "Developers", hint: "API keys, CLI, webhooks", href: "/developers", icon: I.code },
  { id: "a-new", label: "New verification", hint: "Name an outcome to prove", href: "/app", icon: I.plus },
  { id: "a-connect", label: "Connect a system", hint: "Point Vraelis at a deployment", href: "/applications/new", icon: I.plus },
  { id: "s-team", label: "Team", hint: "Who can see what", href: "/team", icon: I.user },
  { id: "s-org", label: "Organization", hint: "Company settings", href: "/organization", icon: I.building },
  { id: "s-usage", label: "Usage", hint: "API keys, consumption, limits", href: "/usage", icon: I.data },
  { id: "s-topup", label: "Top up credits", hint: "Add balance", href: "/credits", icon: I.coin },
  { id: "s-billing", label: "Billing", hint: "Plan and payment", href: "/plans", icon: I.card },
  { id: "s-account", label: "Account", hint: "Your profile", href: "/account", icon: I.user },
];

export function CommandPalette({ systems }: { systems: PaletteSystem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const [mac, setMac] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // The hint said the Mac shortcut to everyone. On Windows and Linux the key is Control, so the bar was
  // advertising a chord that does nothing on most of the machines that will ever see it. Resolved on the
  // client because the server cannot know, and defaulting to the Ctrl label so the first paint is right for
  // the majority rather than briefly wrong for them.
  useEffect(() => {
    const p = navigator.userAgent;
    setMac(/Mac|iPhone|iPad|iPod/i.test(p));
  }, []);

  const items = useMemo(() => {
    const sys: Item[] = systems.map((s) => ({
      id: `sys-${s.id}`, label: s.name || "System", hint: "Open system", href: `/applications/${s.id}`, icon: I.layers,
    }));
    const all = [...DESTINATIONS, ...sys];
    const needle = q.trim().toLowerCase();
    if (!needle) return all.slice(0, 9);
    return all.filter((i) => i.label.toLowerCase().includes(needle) || i.hint.toLowerCase().includes(needle)).slice(0, 12);
  }, [q, systems]);

  // The highlight resets where the query changes (the onChange below), not in an effect watching it. An
  // effect that calls setState renders twice for every keystroke and flashes the old highlight in between.

  const close = useCallback(() => {
    setOpen(false); setQ("");
    // Give focus back to whatever the user was on, so the palette does not strand a keyboard user on <body>.
    restoreTo.current?.focus?.();
  }, []);

  // The SAME dismissal contract every other menu in the shell uses: Escape, and a pointer press anywhere
  // outside the panel. The palette previously closed only when the press resolved to the backdrop element
  // itself, so a press that landed on any descendant of the overlay left it open.
  useDismiss(open, close, { panel: panelRef, trigger: triggerRef });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => {
          if (!v) restoreTo.current = document.activeElement as HTMLElement;
          return !v;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  // Hold the page still while the palette is up. With the blur gone the page behind the scrim is legible,
  // so a stray wheel event visibly scrolls it under a panel that is not moving, which reads as broken.
  // The scrollbar's width is replaced as padding, or removing it shifts the whole layout sideways.
  // HOLDING THE PAGE STILL HAS TO INCLUDE PUTTING IT BACK. `overflow: hidden` alone stops the page
  // scrolling but does not preserve where it was: measured on the console, every open lost 7px and every
  // close left it lost, so six opens walked the page up 42px. Someone reading half way down a list and
  // reaching for the palette watched the page creep away from them each time.
  //
  // Taking the body out of flow at a negative offset is the version that can be undone exactly: the same
  // slice of the page stays on screen, and the scroll position is a number we restore ourselves on close
  // rather than something the browser recomputes for us.
  useEffect(() => {
    if (!open) return;
    const { body } = document;
    const scrollY = window.scrollY;
    const prev = {
      position: body.style.position, top: body.style.top, left: body.style.left,
      right: body.style.right, width: body.style.width,
      overflow: body.style.overflow, paddingRight: body.style.paddingRight,
    };
    // The scrollbar's width is replaced as padding, or removing it shifts the whole layout sideways.
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      body.style.paddingRight = prev.paddingRight;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  if (!open) {
    return (
      <button
        ref={triggerRef}
        onClick={() => { restoreTo.current = document.activeElement as HTMLElement; setOpen(true); }}
        aria-label="Search and commands"
        className="vra-cmd-trigger"
      >
        <span aria-hidden style={{ display: "inline-flex", color: "var(--fg-4)" }}><Ic d={I.list} size={14} sw={1.9} /></span>
        <span className="vra-cmd-trigger__label">Search</span>
        <kbd aria-hidden className="vra-cmd-kbd">{mac ? "⌘K" : "Ctrl K"}</kbd>
      </button>
    );
  }

  const go = (href: string) => { close(); router.push(href); };

  return (
    <div
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
      // NO BACKDROP BLUR. It read as a smear rather than depth: blur re-samples whatever is behind it, so the
      // wordmark, the topbar buttons and the headline all came back soft and slightly wrong, and the effect
      // was strongest exactly where the eye goes first. A scrim does the whole job — it pushes the page back
      // by dimming it, and the panel's own border and shadow supply the elevation. The tint is the product's
      // graphite rather than pure black, so what shows through stays the colour it already was.
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(10,10,11,0.76)", display: "grid", placeItems: "start center", paddingTop: "12vh" }}
    >
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Search and commands"
        style={{ width: "min(560px, calc(100vw - 32px))", background: "var(--bg-1)", border: "1px solid var(--line-2)", borderRadius: 14, boxShadow: "var(--shadow-lg)", overflow: "hidden" }}>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setCursor(0); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); close(); }
            else if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, items.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); const it = items[cursor]; if (it) go(it.href); }
          }}
          placeholder="Search systems, or jump to anything"
          aria-label="Search systems, or jump to anything"
          role="combobox" aria-expanded aria-controls="vra-cmd-list"
          aria-activedescendant={items[cursor] ? `vra-cmd-${items[cursor].id}` : undefined}
          style={{ width: "100%", padding: "15px 18px", border: "none", borderBottom: "1px solid var(--line-2)", background: "transparent", color: "var(--fg-1)", fontSize: 15, outline: "none", fontFamily: "inherit" }}
        />
        <ul id="vra-cmd-list" role="listbox" aria-label="Results" style={{ listStyle: "none", margin: 0, padding: 6, maxHeight: "52vh", overflowY: "auto" }}>
          {items.map((it, i) => (
            <li key={it.id} id={`vra-cmd-${it.id}`} role="option" aria-selected={i === cursor}>
              <button
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(it.href)}
                style={{ width: "100%", display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 9, border: "none", cursor: "pointer", textAlign: "left", background: i === cursor ? "var(--bg-3)" : "transparent", color: "var(--fg-1)", fontFamily: "inherit" }}
              >
                <span aria-hidden style={{ display: "inline-flex", color: "var(--fg-4)" }}><Ic d={it.icon} size={15} sw={1.8} /></span>
                <span style={{ fontSize: 13.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
                <span style={{ fontSize: 11.5, color: "var(--fg-4)", flex: "none" }}>{it.hint}</span>
              </button>
            </li>
          ))}
          {items.length === 0 && (
            <li style={{ padding: "16px 12px", fontSize: 13.5, color: "var(--fg-4)" }}>Nothing matches that.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
