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
import { useRef, useState } from "react";
import { Composer } from "./composer";
import { Ic, I } from "@/app/rank/_components/icons";

export function CompactComposer({ balance }: { balance: number }) {
  const [open, setOpen] = useState(false);
  const region = useRef<HTMLDivElement>(null);

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
        style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "14px 16px",
          border: "1px dashed var(--line-3)", borderRadius: "var(--r-lg, 14px)", background: "var(--bg-2)",
          color: "var(--fg-2)", fontSize: 14, fontFamily: "inherit", cursor: "pointer", textAlign: "left",
        }}
      >
        <span aria-hidden style={{ display: "inline-flex", color: "var(--fg-3)" }}><Ic d={I.plus} size={16} sw={2} /></span>
        <span style={{ fontWeight: 500 }}>Verify a guarantee</span>
        <span style={{ color: "var(--fg-5)", fontSize: 12.5 }}>Name a deployment and what must stay true</span>
      </button>
    );
  }

  return (
    <div ref={region}>
      <Composer balance={balance} />
      <button
        onClick={() => setOpen(false)}
        style={{ marginTop: 10, background: "none", border: "none", color: "var(--fg-4)", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", padding: 0 }}
      >
        Close
      </button>
    </div>
  );
}
