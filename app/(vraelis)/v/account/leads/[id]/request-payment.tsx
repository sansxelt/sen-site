"use client";

import { useActionState, useState, type CSSProperties } from "react";
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

export function RequestPayment({
  leadId,
  connected,
  cutRate,
}: {
  leadId: string;
  connected: boolean;
  cutRate: number;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(requestPaymentAction, null);
  const [amount, setAmount] = useState("");

  if (!connected) {
    return (
      <p style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.5 }}>
        Set up payouts in the{" "}
        <a href="/v/account?tab=money" style={{ color: "var(--acc-deep)" }}>Money tab</a>{" "}
        to collect payment from this lead — Vraelis collects it, takes its cut automatically, and Stripe deducts card-processing fees from the payout it sends you.
      </p>
    );
  }

  const amt = Number(amount);
  const valid = Number.isFinite(amt) && amt >= 0.5;
  const fee = valid ? amt * cutRate : 0;
  const keep = valid ? amt - fee : 0;
  const pct = (cutRate * 100).toFixed(cutRate * 100 % 1 === 0 ? 0 : 1);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="hidden" name="leadId" value={leadId} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid var(--line-2)", borderRadius: "var(--r-xs)", padding: "0 10px", background: "var(--bg-1)" }}>
          <span style={{ color: "var(--fg-4)", fontSize: 13 }}>$</span>
          <input
            name="amount"
            type="number"
            min={0.5}
            step="0.01"
            placeholder="amount"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ width: 96, border: "none", background: "transparent", padding: "9px 2px", fontSize: 13, color: "var(--fg-1)", outline: "none", fontFamily: "var(--font-mono)" }}
          />
        </div>
        <input name="description" placeholder="what it's for (e.g. 12-week program)" maxLength={300} style={{ ...inputStyle, flex: "1 1 200px", minWidth: 160 }} />
        <button type="submit" className="btn" disabled={pending} style={{ padding: "9px 18px", fontSize: 13, opacity: pending ? 0.7 : 1 }}>
          {pending ? "Sending…" : "Collect payment →"}
        </button>
      </div>

      {/* Live fee / you-keep preview from the plan cut rate */}
      {valid && (
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)", paddingTop: 2 }}>
          <span>After Vraelis fee <b style={{ color: "var(--money)", fontWeight: 700 }}>${keep.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b></span>
          <span>Vraelis fee ({pct}%) <span style={{ color: "var(--fg-3)" }}>${fee.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></span>
        </div>
      )}

      <p style={{ fontSize: 11.5, color: "var(--fg-4)", lineHeight: 1.5, margin: 0 }}>
        Sends the lead a secure payment request. Collected through Vraelis — it automatically takes its {pct}% fee, and Stripe deducts card-processing fees from the payout it sends you. No invoicing, no chasing.
      </p>

      {state && <span style={{ fontSize: 12.5, color: state.ok ? "var(--acc-deep)" : "#9F2D2D" }}>{state.message}</span>}
    </form>
  );
}
