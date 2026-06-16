"use client";

import { useActionState, type CSSProperties } from "react";
import { setSmsAction, type ActionResult } from "./actions";
import { useRefreshOnSuccess } from "./use-refresh-on-success";

const label: CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em",
  textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 7, display: "block",
};
const input: CSSProperties = {
  width: "100%", boxSizing: "border-box", borderRadius: "var(--r-xs)", border: "1px solid var(--line-2)",
  background: "var(--bg-1)", padding: "11px 13px", fontSize: 13.5, color: "var(--fg-1)", outline: "none",
  fontFamily: "var(--font-mono)",
};

export function SmsForm({
  initialOwnerPhone = "",
  initialTwilioNumber = "",
}: {
  initialOwnerPhone?: string;
  initialTwilioNumber?: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(setSmsAction, null);
  useRefreshOnSuccess(state); // refresh the Text & voice chip + checklist row on save
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={label} htmlFor="ownerPhone">Your phone <span style={{ textTransform: "none", letterSpacing: 0, color: "var(--fg-5)" }}>(new-lead alerts)</span></label>
        <input id="ownerPhone" name="ownerPhone" defaultValue={initialOwnerPhone} placeholder="+1 555 123 4567" maxLength={32} style={input} />
      </div>
      <div>
        <label style={label} htmlFor="twilioNumber">Agent&apos;s text &amp; voice number <span style={{ textTransform: "none", letterSpacing: 0, color: "var(--fg-5)" }}>(the number leads see)</span></label>
        <input id="twilioNumber" name="twilioNumber" defaultValue={initialTwilioNumber} placeholder="+1 555 987 6543" maxLength={32} style={input} />
      </div>
      <p style={{ fontSize: 11.5, color: "var(--fg-4)", lineHeight: 1.5, margin: 0 }}>
        This is the number your agent texts leads from and answers missed calls on. It goes live once the number clears carrier registration. Until then, your agent still works every lead over chat, email, and the web.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="submit" className="btn" disabled={pending} style={{ opacity: pending ? 0.7 : 1 }}>
          {pending ? "Saving…" : "Save"}
        </button>
        {state && <span style={{ fontSize: 13, color: state.ok ? "var(--acc-deep)" : "#9F2D2D" }}>{state.message}</span>}
      </div>
    </form>
  );
}
