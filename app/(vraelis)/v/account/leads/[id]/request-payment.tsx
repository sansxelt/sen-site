"use client";

import { useActionState, type CSSProperties } from "react";
import { requestPaymentAction, type ActionResult } from "../../actions";

const inputStyle: CSSProperties = {
  borderRadius: "var(--r-xs)",
  border: "1px solid var(--line-2)",
  background: "var(--bg-1)",
  padding: "9px 12px",
  fontSize: 13,
  color: "var(--fg-1)",
  outline: "none",
  fontFamily: "var(--font-sans)",
};

export function RequestPayment({ leadId, connected }: { leadId: string; connected: boolean }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(requestPaymentAction, null);

  if (!connected) {
    return (
      <p style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.5 }}>
        Set up payouts on your{" "}
        <a href="/v/account" style={{ color: "var(--acc-deep)" }}>account</a>{" "}
        to charge this lead on-platform — Vraelis collects, takes its cut, and pays you out automatically.
      </p>
    );
  }

  return (
    <form action={action} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <input type="hidden" name="leadId" value={leadId} />
      <div style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid var(--line-2)", borderRadius: "var(--r-xs)", padding: "0 10px", background: "var(--bg-1)" }}>
        <span style={{ color: "var(--fg-4)", fontSize: 13 }}>$</span>
        <input name="amount" type="number" min={0.5} step="0.01" placeholder="amount" required style={{ width: 90, border: "none", background: "transparent", padding: "9px 2px", fontSize: 13, color: "var(--fg-1)", outline: "none", fontFamily: "var(--font-mono)" }} />
      </div>
      <input name="description" placeholder="what it's for (optional)" maxLength={300} style={{ ...inputStyle, flex: "1 1 200px", minWidth: 160 }} />
      <button type="submit" className="btn" disabled={pending} style={{ padding: "9px 16px", fontSize: 13, opacity: pending ? 0.7 : 1 }}>
        {pending ? "Creating…" : "Request payment"}
      </button>
      {state && <span style={{ fontSize: 12.5, width: "100%", color: state.ok ? "var(--acc-deep)" : "#9F2D2D" }}>{state.message}</span>}
    </form>
  );
}
