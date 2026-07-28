"use client";

// A SCRATCHPAD THAT SURVIVES NAVIGATION.
//
// The console makes you carry things between pages. A key is shown ONCE at creation and then never again,
// a verification id belongs to a record you are about to open, a claim gets drafted before there is
// anywhere to put it. Today that means a second window, or the clipboard, which holds one thing and
// forgets it the moment you copy anything else.
//
// So: one panel, on every page of the product, that keeps its text.
//
// ── WHERE THE TEXT LIVES, AND WHY THAT MATTERS ──────────────────────────────────────────────────────
//
// localStorage. It never touches the network, is never sent to Vraelis, and appears in no request, no log
// and no database. That is the whole design: a scratchpad the company can read is not a scratchpad.
//
// It is also UNENCRYPTED and readable by any script on this origin, which matters because the first thing
// anyone will paste here is an API key. That is a real trade and the panel says so out loud rather than
// letting someone discover it later. A key that lives here is exactly as exposed as this browser profile
// is, so on a shared machine it should be cleared, and Reset does that completely.
//
// ── WHY IT LOOKS LIKE A TERMINAL ────────────────────────────────────────────────────────────────────
//
// Because of what goes in it. Keys, ids, curl commands, a claim being drafted. Proportional text turns a
// key into something you cannot check a character of, and wraps a command in a way that hides where it
// ends. Monospace with a fixed gutter makes all of that legible, and the product already ships a CLI, so
// the register is the product's own rather than a costume.
import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "vraelis:scratchpad";
const OPEN_KEY = "vraelis:scratchpad-open";
// Window state persists alongside the text. Minimising something and finding it maximised again on the
// next page is the panel forgetting a decision you made, which is the same failure as losing the note.
const VIEW_KEY = "vraelis:scratchpad-view";

// Generous, and bounded. localStorage is a shared, small quota per origin, and an unbounded text area is
// how one runaway paste evicts everything else the product stores there.
const MAX = 20000;

export function Scratchpad() {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  // The three window states a real title bar has. "normal" is the default, "min" shows the bar alone,
  // "zoom" is the taller one for when you are actually working in here rather than glancing at it.
  const [view, setView] = useState<"normal" | "min" | "zoom">("normal");
  const [text, setText] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [copied, setCopied] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  // Read AFTER mount, never during render. localStorage does not exist on the server, and seeding state
  // from it directly is the classic hydration mismatch: the server renders an empty panel, the client
  // renders a full one, and React discards the difference silently.
  useEffect(() => {
    try {
      setText(localStorage.getItem(KEY) ?? "");
      setOpen(localStorage.getItem(OPEN_KEY) === "1");
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "min" || v === "zoom" || v === "normal") setView(v);
    } catch { /* private mode, or storage disabled: the panel still works, it just will not persist */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, text); } catch { /* quota or private mode */ }
  }, [text, ready]);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(OPEN_KEY, open ? "1" : "0"); } catch { /* ignored */ }
  }, [open, ready]);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(VIEW_KEY, view); } catch { /* ignored */ }
  }, [view, ready]);

  // Escape closes, but only when the panel has focus. A global Escape handler would fight every dialog,
  // menu and command palette in the product for a keystroke none of them expect to lose.
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); setOpen(false); }
  }, []);

  const reset = () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    setText("");
    setConfirmReset(false);
    area.current?.focus();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard denied: the text is selectable, which is the fallback */ }
  };

  // Nothing renders until the stored state is known, so the button never flashes the wrong state on load.
  if (!ready) return null;

  const lines = text ? text.split("\n").length : 0;

  return (
    <>
      {/* The launcher. Bottom right, above nothing else the product puts there, and it stays put while the
          panel is open so the same target closes it. */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="vra-scratchpad"
        title={open ? "Close notes" : "Notes"}
        style={{
          position: "fixed", right: 18, bottom: 18, zIndex: 70,
          display: "flex", alignItems: "center", gap: 8,
          padding: "9px 13px", borderRadius: 10, cursor: "pointer",
          fontFamily: "var(--font-code)", fontSize: 12, letterSpacing: "0.02em",
          color: open ? "var(--fg-1)" : "var(--fg-3)",
          background: "var(--bg-1)", border: "1px solid var(--line-2)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <span aria-hidden style={{ color: "var(--go-ink)" }}>{">"}</span>
        notes
        {/* A quiet mark that there is something in here, so a closed panel is never mistaken for an empty
            one. Not a count: the number of characters in your scratchpad is nobody's headline. */}
        {!open && text.trim() ? <span aria-hidden style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--go-ink)" }} /> : null}
      </button>

      {open ? (
        <section
          id="vra-scratchpad"
          aria-label="Notes"
          onKeyDown={onKeyDown}
          style={{
            position: "fixed", right: 18, bottom: 64, zIndex: 69,
            width: "min(420px, calc(100vw - 36px))",
            display: "flex", flexDirection: "column",
            background: "var(--bg-1)", border: "1px solid var(--line-2)",
            borderRadius: 12, overflow: "hidden", boxShadow: "var(--shadow-lg)",
          }}
        >
          {/* The title bar, in the product's own terminal register: three dots, a name, a status. */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: "1px solid var(--line-2)", background: "var(--bg-2)" }}>
            {/* THREE REAL CONTROLS, NOT THREE DOTS. They look like a title bar, so they have to behave
                like one: something that renders as a button and does nothing is a small lie that costs a
                click to discover. Same jobs a window has, adapted to a panel with no dock to fly into.

                  red     close it
                  amber   collapse to this bar alone, so it stays to hand without taking the screen
                  green   zoom, for when you are working in here rather than glancing at it

                None of them touches the text. It is written on every keystroke and only Reset removes it. */}
            <span style={{ display: "flex", gap: 5 }}>
              {([
                ["close", "var(--stop-line)", "Close", () => setOpen(false)],
                ["min", "var(--wait-line)", view === "min" ? "Expand" : "Collapse to the title bar",
                  () => setView((v) => (v === "min" ? "normal" : "min"))],
                ["zoom", "var(--go-line)", view === "zoom" ? "Restore size" : "Zoom",
                  () => setView((v) => (v === "zoom" ? "normal" : "zoom"))],
              ] as [string, string, string, () => void][]).map(([id, colour, label, act]) => (
                <button key={id} onClick={act} title={label} aria-label={label}
                  style={{ width: 11, height: 11, borderRadius: "50%", background: colour,
                           border: "none", padding: 0, cursor: "pointer", lineHeight: 0 }} />
              ))}
            </span>
            <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)", letterSpacing: "0.06em" }}>notes</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontFamily: "var(--font-code)", fontSize: 10.5, color: "var(--fg-5)", fontVariantNumeric: "tabular-nums" }}>
              {lines} {lines === 1 ? "line" : "lines"}
            </span>
          </div>

          {view !== "min" ? (
          <textarea
            ref={area}
            value={text}
            onChange={(e) => { setText(e.target.value.slice(0, MAX)); setConfirmReset(false); }}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            placeholder={"# keys, ids, a claim you are drafting\n# stays here while you move around the console"}
            aria-label="Notes"
            style={{
              width: "100%", minHeight: view === "zoom" ? 420 : 220, maxHeight: view === "zoom" ? "68vh" : "42vh", resize: "vertical",
              padding: "12px 14px", border: "none", outline: "none",
              background: "var(--bg-1)", color: "var(--fg-1)",
              fontFamily: "var(--font-code)", fontSize: 12.5, lineHeight: 1.65,
              // Long things go here. A key or a curl command must not be silently re-wrapped mid-token.
              whiteSpace: "pre", overflowWrap: "normal", overflowX: "auto",
            }}
          />
          ) : null}

          {/* Footer and disclosure hide together, so a collapsed panel really is just the title bar
              rather than a bar with an orphaned row of buttons under it. Two siblings, hence the
              fragment: a ternary returns one node. */}
          {view !== "min" ? (
          <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderTop: "1px solid var(--line-2)", background: "var(--bg-2)" }}>
            <button onClick={copy} disabled={!text} className="btn btn--ghost"
              style={{ padding: "5px 10px", fontSize: 11.5, fontFamily: "var(--font-code)", opacity: text ? 1 : 0.5 }}>
              {copied ? "copied" : "copy"}
            </button>
            {/* RESET ASKS ONCE. This is the only destructive control in the panel and there is no undo,
                because the text was never sent anywhere to restore it from. One click arms it, the next
                clears it, and typing disarms it again so a forgotten click cannot fire later. */}
            <button onClick={reset} disabled={!text} className="btn btn--ghost"
              style={{ padding: "5px 10px", fontSize: 11.5, fontFamily: "var(--font-code)",
                       color: confirmReset ? "var(--stop-ink)" : undefined, opacity: text ? 1 : 0.5 }}>
              {confirmReset ? "reset, sure?" : "reset"}
            </button>
            <span style={{ flex: 1 }} />
            <span style={{ fontFamily: "var(--font-code)", fontSize: 10, color: "var(--fg-5)" }}>
              {text.length >= MAX ? `${MAX} char limit` : "this browser only"}
            </span>
          </div>

          {/* SAID IN THE PANEL, NOT IN A DOC NOBODY OPENS. People will paste API keys here, and they are
              entitled to know the terms before they do rather than after, and to know how long it lasts
              before they rely on it. Both halves matter: what it costs, and what it guarantees. */}
          <p style={{ margin: 0, padding: "8px 12px 10px", fontSize: 10.5, lineHeight: 1.55, color: "var(--fg-5)", borderTop: "1px solid var(--line-1)" }}>
            Kept in this browser. It survives closing the panel, moving between pages, signing out, closing
            the tab and restarting. <strong style={{ color: "var(--fg-4)" }}>Reset is the only thing that
            removes it.</strong> Never sent to Vraelis and not encrypted, so treat it like a sticky note on
            your desk.
          </p>
          </>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
