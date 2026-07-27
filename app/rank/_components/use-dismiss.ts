"use client";

// ONE DISMISSAL CONTRACT FOR EVERY POP-OPEN CONTROL.
//
// Escape closes it AND returns focus to the trigger, a pointer press anywhere outside closes it, and it is a
// no-op while closed. The account menu, the workspace switcher and the mobile drawer have shared this since
// they were written; the command palette did not, and rolled a weaker version that only closed when the
// press landed exactly on the backdrop element. Any press that resolved to a child of the overlay left it
// open, which is why it did not reliably close on a click outside the box.
//
// It lives in its own file rather than in rank-ui.tsx because rank-ui imports the palette, so the palette
// importing back would be a cycle. Keeping every menu on one implementation is the whole point: a dismissal
// rule that exists in two places is a rule that will behave two ways.
//
// The listener is CAPTURING (third argument true) so it runs before a stopPropagation deeper in the tree can
// swallow it, and it is pointerdown rather than click so the menu closes on press instead of waiting for a
// release that may never land on the same element.
import { useEffect, type RefObject } from "react";

export function useDismiss(
  open: boolean,
  close: () => void,
  refs: { panel: RefObject<HTMLElement | null>; trigger: RefObject<HTMLElement | null> },
) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); close(); refs.trigger.current?.focus(); }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!refs.panel.current?.contains(t) && !refs.trigger.current?.contains(t)) {
        close();
        // Return focus to the trigger (matching the Escape path) so it is never lost to <body> — but only when
        // the press landed on non-focusable space; if the user pressed another control, let that control keep
        // the focus the browser is about to give it.
        const el = t instanceof Element ? t.closest("a,button,input,select,textarea,[tabindex]") : null;
        if (!el) refs.trigger.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown, true); };
  }, [open, close, refs.panel, refs.trigger]);
}
