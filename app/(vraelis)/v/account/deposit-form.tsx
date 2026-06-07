"use client";

import { useActionState, useState, type CSSProperties } from "react";
import { setDepositAction, type ActionResult } from "./actions";

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: "var(--r-xs)",
  border: "1px solid var(--line-2)",
  background: "var(--bg-1)",
  padding: "10px 12px",
  fontSize: 14,
  color: "var(--fg-1)",
  outline: "none",
  fontFamily: "var(--font-mono)",
};

export function DepositForm({
  initialEnabled,
  initialAmount,
}: {
  initialEnabled: boolean;
  initialAmount: number | null;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(setDepositAction, null);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [amount, setAmount] = useState(initialAmount != null ? String(initialAmount / 100) : "25");

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13.5, color: "var(--fg-1)" }}>
        <input type="checkbox" name="enabled" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--acc-deep)" }} />
        Require a deposit to confirm a booking
      </label>
      <p style={{ fontSize: 11.5, color: "var(--fg-4)", lineHeight: 1.5, margin: 0 }}>
        Recommended — a deposit cuts no-shows and locks the booking with an on-platform payment (your cut, automatically).
      </p>
      {enabled && (
        <>
          <div style={{ display: "flex", gap: 6 }}>
            {[25, 50, 100].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(String(v))}
                style={{
                  flex: 1, padding: "7px 4px", fontSize: 12.5, fontFamily: "var(--font-mono)", cursor: "pointer",
                  borderRadius: "var(--r-xs)",
                  border: `1px solid ${amount === String(v) ? "var(--acc-deep)" : "var(--line-2)"}`,
                  background: amount === String(v) ? "rgba(14,158,108,0.06)" : "var(--bg-1)",
                  color: amount === String(v) ? "var(--acc-deep)" : "var(--fg-3)", fontWeight: amount === String(v) ? 600 : 400,
                }}
              >
                ${v}{v === 25 ? " ·rec" : ""}
              </button>
            ))}
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid var(--line-2)", borderRadius: "var(--r-xs)", padding: "0 10px", background: "var(--bg-1)", maxWidth: 160 }}>
            <span style={{ color: "var(--fg-4)", fontSize: 13 }}>$</span>
            <input name="amount" type="number" min={0.5} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="deposit" style={{ ...inputStyle, border: "none", background: "transparent", padding: "9px 2px" }} />
          </div>
        </>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="submit" className="btn btn--ghost" disabled={pending} style={{ padding: "8px 14px", fontSize: 13, opacity: pending ? 0.7 : 1 }}>
          {pending ? "Saving…" : "Save"}
        </button>
        {state && <span style={{ fontSize: 12.5, color: state.ok ? "var(--acc-deep)" : "#9F2D2D" }}>{state.message}</span>}
      </div>
    </form>
  );
}
