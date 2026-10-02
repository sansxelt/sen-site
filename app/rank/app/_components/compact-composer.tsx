"use client";

// The creation surface, demoted to an action.
//
// The composer is unchanged and still does the whole job; what changed is how much of the screen it claims
// before anyone asks for it. On an account with records it starts as one line, because the reason to open
// the console is usually to read state rather than to start work, and a full-height form at the top of the
// page asserts the opposite. On an empty account the page renders the composer directly and this wrapper is
// never used, so a first-time visitor still lands on the thing they need.
//
// Not a <details> element: the trigger has to disappear when open (a disclosure that keeps its summary
// visible wastes the row it was trying to save) and focus has to move into the form, neither of which the
// native element does.
import { useEffect, useRef, useState } from "react";
import { Composer } from "./composer";
import { Ic, I } from "@/app/rank/_components/icons";

export function CompactComposer({ balance, defaultOpen = false, surface, initialUrl }: { balance: number; defaultOpen?: boolean; surface?: string | null; initialUrl?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  const region = useRef<HTMLDivElement>(null);
  // Opened from the top bar: bring the form into view and put the cursor in its first field.
  useEffect(() => {
    if (!defaultOpen) return;
    const el = region.current;
    el?.scrollIntoView({ block: "start", behavior: "smooth" });
    (el?.querySelector("input,textarea") as HTMLElement | null)?.focus({ preventScroll: true });
  }, [defaultOpen]);

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          // Focus the first field once it exists, so opening with the keyboard lands you in the form.
          requestAnimationFrame(() => region.current?.querySelector("input,textarea")instanceof HTMLElement
            ? (region.current.querySelector("input,textarea") as HTMLElement).focus()
            : undefined);
        }}
        // A solid card, not a dashed placeholder. The dashed grey box read as an unfinished slot in the page,
        // and it is the one action the product exists for.
        className="vra-attn"
        style={{
          display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 18px",
          border: "1px solid var(--line-2)", borderRadius: 10, background: "var(--bg-1)", boxShadow: "var(--shadow-card)",
          color: "var(--fg-2)", fontSize: 14, fontFamily: "inherit", cursor: "pointer", textAlign: "left",
        }}
      >
        <span aria-hidden style={{ display: "inline-grid", placeItems: "center", width: 28, height: 28, borderRadius: 7, background: "var(--acc-soft)", color: "var(--acc)", flex: "none" }}><Ic d={I.plus} size={15} sw={2.2} /></span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontWeight: 600, color: "var(--fg-1)" }}>New verification</span>
          <span style={{ display: "block", color: "var(--fg-4)", fontSize: 13, marginTop: 1 }}>A live URL and one sentence about what should work</span>
        </span>
        <span aria-hidden style={{ marginLeft: "auto", color: "var(--acc-deep)", fontWeight: 600, fontSize: 13.5, flex: "none" }}>Start →</span>
      </button>
    );
  }

  return (
    <div ref={region}>
      <Composer balance={balance} surface={surface} initialUrl={initialUrl} />
      <button
        onClick={() => setOpen(false)}
        style={{ marginTop: 10, background: "none", border: "none", color: "var(--fg-4)", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", padding: 0 }}
      >
        Close
      </button>
    </div>
  );
}
