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
  const assigned = Boolean(initialTwilioNumber);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.55, margin: 0, fontWeight: 600 }}>
        Your agent gets its own business texting line. Leads text that number and your agent replies automatically, and follows up after missed calls. Vraelis provides the number, you don&apos;t need one of your own.
      </p>

      {/* AI agent number — Vraelis-assigned, read-only. Until SMS registration
          clears there's no number to show, so this is a status, not an input. */}
      <div>
        <span style={label}>Your agent&apos;s number <span style={{ textTransform: "none", letterSpacing: 0, color: "var(--fg-5)" }}>(leads text this)</span></span>
        {assigned ? (
          <div style={{ ...input, display: "flex", alignItems: "center", gap: 8, background: "var(--acc-soft)", borderColor: "var(--acc-line)", color: "var(--acc-deep)", fontWeight: 600 }}>
            <span className="dot dot--acc" />{initialTwilioNumber}
          </div>
        ) : (
          <div style={{ ...input, display: "flex", alignItems: "center", gap: 8, color: "var(--fg-4)", background: "var(--bg-2)" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#C2540C", flexShrink: 0 }} />Not assigned yet
          </div>
        )}
        <p style={{ fontSize: 11.5, color: "var(--fg-4)", lineHeight: 1.5, margin: "7px 0 0" }}>
          {assigned
            ? "This is your agent's live texting and call-back number."
            : "We'll assign your agent a business texting number automatically once SMS registration is approved. Until then, your agent still works every lead over chat, email, and the web."}
        </p>
      </div>

      {/* Owner phone — the one thing the owner actually provides (alerts). */}
      <div>
        <label style={label} htmlFor="ownerPhone">Your phone <span style={{ textTransform: "none", letterSpacing: 0, color: "var(--fg-5)" }}>(where you get new-lead alerts)</span></label>
        <input id="ownerPhone" name="ownerPhone" defaultValue={initialOwnerPhone} placeholder="+1 555 123 4567" maxLength={32} style={input} />
        {/* Preserve any assigned agent number when the owner saves their phone. */}
        <input type="hidden" name="twilioNumber" value={initialTwilioNumber} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="submit" className="btn" disabled={pending} style={{ opacity: pending ? 0.7 : 1 }}>
          {pending ? "Saving…" : "Save"}
        </button>
        {state && <span style={{ fontSize: 13, color: state.ok ? "var(--acc-deep)" : "#9F2D2D" }}>{state.message}</span>}
      </div>
    </form>
  );
}
