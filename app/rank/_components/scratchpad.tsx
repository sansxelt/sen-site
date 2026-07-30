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

// ── SUGGESTIONS: THE PANEL READS WHAT YOU PASTED AND SAYS WHEN IT LOOKS WRONG ──────────────────────
//
// Everything in this panel is on its way to a terminal, and the failures that matter are the ones you
// cannot see. Two leading spaces before `$env:Path += ...`, a curly quote where a straight one belongs, an
// em dash where `--url` was meant, a non-breaking space that came along with the text from a web page:
// each of these looks correct in a note and fails when it is run, and the error the shell gives back
// almost never names the character that caused it. That is a bad half-hour, and it is avoidable by
// looking.
//
// ENTIRELY LOCAL, AND THAT IS NOT NEGOTIABLE. The header above promises this text never touches the
// network, and a suggestion feature is exactly the kind of thing that would quietly break that promise by
// sending the note somewhere to be judged. inspect() is a pure function of the string: no fetch, no
// model, no telemetry, no counter. Everything it knows is in the regexes below, and it runs during render
// in the same tab that already has the text.
//
// IT SUGGESTS, IT DOES NOT CORRECT. Nothing is rewritten unless the reader presses the fix, because this
// is a scratchpad and some of what looks wrong is deliberate: a drafted claim is allowed its em dash and
// its curly apostrophe, and indented JSON is indented on purpose. So the checks that COULD destroy real
// content are scoped to lines that look like commands, and the rest are offered rather than applied.
type Notice = {
  id: string;
  /** What is wrong, in one line, naming the character rather than a rule number. */
  text: string;
  /** Applied only on an explicit press. Absent when there is nothing safe to do automatically. */
  fix?: (t: string) => string;
  fixLabel?: string;
};

/** Whitespace that is not a space: non-breaking, figure, narrow-no-break. Visible as a gap, fatal in a shell. */
const HARD_SPACE = /[   ]/;
/** Zero-width and BOM. Not visible at all, and the usual cause of "but I copied it exactly". */
const INVISIBLE = /[​‌‍⁠﻿]/;
/** Typographic quotes, which every shell treats as ordinary letters rather than as quoting. */
const SMART_QUOTE = /[‘’‚‛“”„‟]/;
/** An en/em dash immediately before a word, which is what `--flag` becomes after an autocorrect. */
const DASH_FLAG = /(^|\s)[–—](?=[A-Za-z])/;
/** Leading whitespace on a line that begins a command. Deliberately NOT "any indented line": indentation
 *  inside drafted JSON or a pasted body is correct, and stripping it would be the panel breaking the note
 *  it was asked to protect. */
const INDENTED_COMMAND =
  /^[ \t]+(?=(?:\$env:|\$[A-Za-z_]|curl\b|irm\b|iwr\b|iex\b|vraelis\b|node\b|npm\b|npx\b|pnpm\b|git\b|sudo\b|powershell\b|pwsh\b|sh\b|bash\b|cd\b|export\b|Set-|Get-|New-|\[Environment\]))/;
/** A command left mid-continuation, so pasting it runs half a line or hangs waiting for the rest. */
const DANGLING_CONTINUATION = /[\\`]\s*$/;
/** The live API key format (lib/v-api-keys.ts generateApiKey). Not a fix — a reminder of what this panel is. */
const API_KEY = /vr_live_[0-9a-f]{8,}/;

const straighten = (t: string) =>
  t.replace(/[‘’‚‛]/g, "'").replace(/[“”„‟]/g, '"');

/** Pure. Order matters: the least visible problems come first, because those are the ones a reader cannot
 *  find by staring at the note. */
export function inspect(t: string): Notice[] {
  if (!t) return [];
  const out: Notice[] = [];
  const lines = t.split("\n");

  if (INVISIBLE.test(t)) {
    out.push({
      id: "invisible",
      text: "There is an invisible character in here (zero-width or a byte-order mark). It will not show up anywhere, and it breaks the line when it runs.",
      fixLabel: "remove it",
      fix: (s) => s.replace(new RegExp(INVISIBLE.source, "g"), ""),
    });
  }
  if (HARD_SPACE.test(t)) {
    out.push({
      id: "hard-space",
      text: "One of the spaces is a non-breaking space, not a space. It looks identical and a shell will not read it as a separator.",
      fixLabel: "make it a space",
      fix: (s) => s.replace(new RegExp(HARD_SPACE.source, "g"), " "),
    });
  }
  if (SMART_QUOTE.test(t)) {
    out.push({
      id: "smart-quote",
      text: "These are curly quotes. A shell treats them as ordinary characters, so the quoting you meant does not happen.",
      fixLabel: "straighten quotes",
      fix: straighten,
    });
  }
  if (DASH_FLAG.test(t)) {
    out.push({
      id: "dash-flag",
      text: "There is an en or em dash where a flag would start. Autocorrect turns -- into a dash, and the flag stops being recognised.",
      fixLabel: "make it --",
      fix: (s) => s.replace(/(^|\s)[–—](?=[A-Za-z])/g, "$1--"),
    });
  }

  const indented = lines.filter((l) => INDENTED_COMMAND.test(l)).length;
  if (indented > 0) {
    out.push({
      id: "indented",
      text:
        indented === 1
          ? "A command here starts with leading whitespace, which usually means it came along with the copy."
          : `${indented} commands here start with leading whitespace, which usually means it came along with the copy.`,
      fixLabel: "trim the start",
      // Only the lines that matched. Untouched lines keep their indentation, so JSON and prose survive.
      fix: (s) => s.split("\n").map((l) => (INDENTED_COMMAND.test(l) ? l.replace(/^[ \t]+/, "") : l)).join("\n"),
    });
  }

  if (DANGLING_CONTINUATION.test(t.trimEnd()) || lines.some((l, i) => i === lines.length - 1 && DANGLING_CONTINUATION.test(l))) {
    out.push({
      id: "dangling",
      text: "This ends on a line-continuation, so the last line is only half a command. Some of it probably did not get copied.",
    });
  }

  if (API_KEY.test(t)) {
    out.push({
      id: "api-key",
      text: "That looks like a live API key. This note is stored unencrypted in this browser — Reset is what removes it.",
    });
  }

  return out;
}

// WINDOW CHROME HAS ITS OWN PALETTE, and it is deliberately not the verdict tokens.
//
// These first used --stop-line, --wait-line and --go-line, which are 30% alpha BORDER tints, so the dots
// came out muddy against a dark panel. The obvious fix is the matching --*-ink values, and it is the
// wrong one: --go-ink is the green that means Verified. In a product whose entire claim rests on what
// green means, spending it on a zoom button blurs the one vocabulary that cannot afford to blur.
//
// So these are the window-control colours everybody already reads as close, minimise and zoom. They say
// "this is a window", which is exactly what they are for, and they leave the verdict palette alone.
const LIGHTS = {
  close: { base: "#FF5F57", hot: "#FF8A84" },
  min:   { base: "#FEBC2E", hot: "#FFD067" },
  zoom:  { base: "#28C840", hot: "#5BE06E" },
};

export function Scratchpad() {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  // The three window states a real title bar has. "normal" is the default, "min" shows the bar alone,
  // "zoom" is the taller one for when you are actually working in here rather than glancing at it.
  const [view, setView] = useState<"normal" | "min" | "zoom">("normal");
  const [text, setText] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [copied, setCopied] = useState(false);
  // Derived during render, not stored. inspect() is pure and the note is at most MAX characters, so there
  // is nothing here worth memoising and nothing to keep in sync with the text.
  const notices = inspect(text);
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
          {/* AND, ONCE COLLAPSED, THE WAY BACK.
              An 11px dot is a fine control for someone who already knows it is there. Collapsed to a bare
              strip it is the ONLY way back, and a panel that looks inert to anyone who does not think to
              aim at the amber dot again is a panel people assume is broken. The whole bar restores it.

              Only when collapsed. Making the expanded bar collapse on click would trade a discovery
              problem for an accident, and this is meant to be the safe direction: it never closes, and it
              never touches the text. */}
          <div
            onClick={view === "min" ? () => setView("normal") : undefined}
            onKeyDown={view === "min" ? (e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setView("normal"); }
            } : undefined}
            role={view === "min" ? "button" : undefined}
            tabIndex={view === "min" ? 0 : undefined}
            title={view === "min" ? "Expand notes" : undefined}
            aria-label={view === "min" ? "Expand notes" : undefined}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "9px 12px",
              borderBottom: "1px solid var(--line-2)", background: "var(--bg-2)",
              cursor: view === "min" ? "pointer" : "default",
            }}>
            {/* THREE REAL CONTROLS, NOT THREE DOTS. They look like a title bar, so they have to behave
                like one: something that renders as a button and does nothing is a small lie that costs a
                click to discover. Same jobs a window has, adapted to a panel with no dock to fly into.

                  red     close it
                  amber   collapse to this bar alone, so it stays to hand without taking the screen
                  green   zoom, for when you are working in here rather than glancing at it

                None of them touches the text. It is written on every keystroke and only Reset removes it. */}
            <span style={{ display: "flex", gap: 5 }}>
              {([
                ["close", LIGHTS.close, "Close", () => setOpen(false)],
                ["min", LIGHTS.min, view === "min" ? "Expand" : "Collapse to the title bar",
                  () => setView((v) => (v === "min" ? "normal" : "min"))],
                ["zoom", LIGHTS.zoom, view === "zoom" ? "Restore size" : "Zoom",
                  () => setView((v) => (v === "zoom" ? "normal" : "zoom"))],
              ] as [string, { base: string; hot: string }, string, () => void][]).map(([id, c, label, act]) => (
                <button
                  key={id}
                  // The bar behind these restores the panel when collapsed, so a click on red has to stop
                  // there. Without this, closing a collapsed panel would also quietly expand it, and it
                  // would come back full size the next time it was opened.
                  onClick={(e) => { e.stopPropagation(); act(); }}
                  title={label}
                  aria-label={label}
                  onMouseEnter={(e) => { e.currentTarget.style.background = c.hot; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = c.base; }}
                  style={{
                    width: 11, height: 11, borderRadius: "50%", background: c.base,
                    // A hairline inner edge, which is what stops a flat circle reading as a sticker on a
                    // dark panel. Same trick the real ones use.
                    boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.28)",
                    border: "none", padding: 0, cursor: "pointer", lineHeight: 0,
                    transition: "background 120ms ease",
                  }}
                />
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

          {/* SUGGESTIONS SIT BETWEEN THE TEXT AND THE BUTTONS, which is where a reader looks after
              pasting and before pressing copy — the one moment the warning can still save them. Absent
              entirely when there is nothing to say, so the panel does not grow a permanently empty strip.
              Quiet by default: the wait tokens rather than the failure tokens, because a curly quote in a
              draft is not an error and this is not a verdict surface. */}
          {view !== "min" && notices.length > 0 ? (
            <div style={{ borderTop: "1px solid var(--line-2)", background: "var(--bg-2)", padding: "8px 10px", display: "grid", gap: 7 }}>
              {notices.map((n) => (
                <div key={n.id} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <span aria-hidden style={{ flex: "none", marginTop: 5, width: 5, height: 5, borderRadius: 99, background: "var(--wait-ink, var(--fg-4))" }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, lineHeight: 1.5, color: "var(--fg-3)" }}>{n.text}</span>
                  {n.fix ? (
                    <button
                      onClick={() => { const f = n.fix; if (f) { setText((t) => f(t).slice(0, MAX)); setConfirmReset(false); } }}
                      className="btn btn--ghost"
                      style={{ flex: "none", padding: "3px 8px", fontSize: 11, fontFamily: "var(--font-code)" }}
                    >
                      {n.fixLabel ?? "fix"}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
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
