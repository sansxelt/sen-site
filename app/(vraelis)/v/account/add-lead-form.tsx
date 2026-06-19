"use client";

import { useActionState, useRef, type CSSProperties } from "react";
import { addLeadAndReachOut, type ActionResult } from "./actions";
import { useRefreshOnSuccess } from "./use-refresh-on-success";

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: "var(--r-xs)",
  border: "1px solid var(--line-2)",
  background: "var(--bg-1)",
  padding: "9px 12px",
  fontSize: 13.5,
  color: "var(--fg-1)",
  outline: "none",
  fontFamily: "var(--font-sans)",
};

export function AddLeadForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, fd) => {
      const res = await addLeadAndReachOut(prev, fd);
      if (res.ok) formRef.current?.reset();
      return res;
    },
    null,
  );
  useRefreshOnSuccess(state); // show the new lead in the pipeline/funnel immediately

  return (
    <details style={{ borderBottom: "1px solid var(--line-1)" }}>
      <summary style={{ cursor: "pointer", padding: "13px 16px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--acc-deep)", listStyle: "none" }}>
        + Add a lead &amp; reach out
      </summary>
      <form ref={formRef} action={action} style={{ padding: "4px 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input name="name" placeholder="Name" style={inputStyle} />
          <input name="email" type="email" placeholder="Email" style={inputStyle} />
        </div>
        <input name="phone" placeholder="Phone (optional)" style={inputStyle} />
        <textarea name="note" rows={2} placeholder="Note for your agent — who they are / why you're reaching out" style={{ ...inputStyle, resize: "vertical" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="submit" className="btn" disabled={pending} style={{ padding: "9px 16px", fontSize: 13, opacity: pending ? 0.7 : 1 }}>
            {pending ? "Reaching out…" : "Reach out"}
          </button>
          {state && (
            <span style={{ fontSize: 12.5, color: state.ok ? "var(--acc-deep)" : "#9F2D2D" }}>{state.message}</span>
          )}
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-4)", lineHeight: 1.5 }}>
          Your agent emails them a first-touch message and starts the thread — replies come back to you. Only add people who gave you their details and agreed to hear from you.
        </p>
      </form>
    </details>
  );
}
