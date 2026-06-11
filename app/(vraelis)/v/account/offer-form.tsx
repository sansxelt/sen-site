"use client";

import { useActionState, useState, type CSSProperties } from "react";
import { saveOfferAction, type ActionResult } from "./actions";

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: "var(--r-xs)",
  border: "1px solid var(--line-2)",
  background: "var(--bg-1)",
  padding: "11px 13px",
  fontSize: 14,
  color: "var(--fg-1)",
  outline: "none",
  fontFamily: "var(--font-sans)",
};

const labelStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10.5,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--fg-4)",
  marginBottom: 7,
  display: "block",
};

const hintStyle: CSSProperties = {
  fontSize: 11.5,
  color: "var(--fg-4)",
  marginTop: 6,
  lineHeight: 1.5,
};

// One numbered step in the offer-first sequence.
function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 14 }}>
      <div
        aria-hidden
        style={{
          flex: "0 0 auto",
          width: 26,
          height: 26,
          borderRadius: 999,
          border: "1px solid var(--acc-line)",
          background: "var(--acc-soft)",
          color: "var(--acc-deep)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 2,
        }}
      >
        {n}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ fontSize: 14.5, color: "var(--fg-1)", margin: "2px 0 12px", letterSpacing: "-0.01em" }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

const PAY_OPTIONS = [
  { key: "full", label: "Full payment", sub: "Collect the whole amount up front." },
  { key: "deposit", label: "Deposit to book", sub: "Take a deposit to lock it in; collect the rest later." },
] as const;

export function OfferForm({
  initialName,
  initialDescription,
  initialServices,
  initialDepositEnabled,
  initialDepositAmount,
  initialQualifying,
  initialLeadSources,
}: {
  initialName: string;
  initialDescription: string;
  initialServices: string;
  initialDepositEnabled: boolean;
  initialDepositAmount: number | null; // cents
  initialQualifying: string;
  initialLeadSources: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveOfferAction, null);
  const [payType, setPayType] = useState<string>(initialDepositEnabled ? "deposit" : "full");
  const [depositAmount, setDepositAmount] = useState<string>(
    initialDepositAmount != null ? String(initialDepositAmount / 100) : "25",
  );

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      {/* 1 — What you sell */}
      <Step n={1} title="What do you sell?">
        <input
          name="businessName"
          defaultValue={initialName}
          placeholder="Your business or offer name — e.g. Apex Coaching"
          maxLength={120}
          style={{ ...inputStyle, marginBottom: 10 }}
        />
        <textarea
          name="businessDescription"
          defaultValue={initialDescription}
          placeholder="What you sell, in a sentence or two — e.g. A 12-week 1:1 coaching program for founders who want to scale past their first $10k month."
          maxLength={400}
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />
        <p style={hintStyle}>This is what Vraelis uses to talk about your offer in your voice.</p>
      </Step>

      {/* 2 — How much */}
      <Step n={2} title="How much does it cost?">
        <textarea
          name="businessServices"
          defaultValue={initialServices}
          placeholder={"One offer per line, with the price — e.g.\n12-week program — $4,000\nIntensive call — $750\nStrategy audit — free"}
          maxLength={2000}
          rows={4}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 13 }}
        />
        <p style={hintStyle}>
          Vraelis quotes <b>only</b> these exact prices (never invents one) and can collect the matching amount on-platform.
        </p>
      </Step>

      {/* 3 — How customers pay */}
      <Step n={3} title="How do customers pay?">
        <input type="hidden" name="payType" value={payType} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {PAY_OPTIONS.map((o) => {
            const active = payType === o.key;
            return (
              <button
                type="button"
                key={o.key}
                onClick={() => setPayType(o.key)}
                style={{
                  textAlign: "left",
                  cursor: "pointer",
                  borderRadius: "var(--r-xs)",
                  border: `1px solid ${active ? "var(--acc-deep)" : "var(--line-2)"}`,
                  background: active ? "rgba(14,158,108,0.06)" : "var(--bg-1)",
                  padding: "11px 13px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    flex: "0 0 auto",
                    width: 15,
                    height: 15,
                    borderRadius: 999,
                    marginTop: 1,
                    border: `4px solid ${active ? "var(--acc-deep)" : "var(--line-3)"}`,
                    background: "var(--bg-1)",
                  }}
                />
                <span>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--fg-1)" }}>{o.label}</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--fg-3)", marginTop: 2 }}>{o.sub}</span>
                </span>
              </button>
            );
          })}
          {/* Payment plan — placeholder, not built yet */}
          <div
            aria-disabled
            style={{
              borderRadius: "var(--r-xs)",
              border: "1px dashed var(--line-2)",
              background: "var(--bg-2)",
              padding: "11px 13px",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              opacity: 0.7,
            }}
          >
            <span aria-hidden style={{ flex: "0 0 auto", width: 15, height: 15, borderRadius: 999, marginTop: 1, border: "2px solid var(--line-3)", background: "var(--bg-2)" }} />
            <span>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600, color: "var(--fg-3)" }}>
                Payment plan
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-4)", border: "1px solid var(--line-2)", borderRadius: 999, padding: "1px 7px" }}>Coming soon</span>
              </span>
              <span style={{ display: "block", fontSize: 12, color: "var(--fg-4)", marginTop: 2 }}>Split a high-ticket offer into installments. On the roadmap.</span>
            </span>
          </div>
        </div>

        {payType === "deposit" && (
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle} htmlFor="depositAmount">Deposit amount</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              {[25, 50, 100].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setDepositAmount(String(v))}
                  style={{
                    flex: 1, padding: "7px 4px", fontSize: 12.5, fontFamily: "var(--font-mono)", cursor: "pointer",
                    borderRadius: "var(--r-xs)",
                    border: `1px solid ${depositAmount === String(v) ? "var(--acc-deep)" : "var(--line-2)"}`,
                    background: depositAmount === String(v) ? "rgba(14,158,108,0.06)" : "var(--bg-1)",
                    color: depositAmount === String(v) ? "var(--acc-deep)" : "var(--fg-3)",
                    fontWeight: depositAmount === String(v) ? 600 : 400,
                  }}
                >
                  ${v}
                </button>
              ))}
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid var(--line-2)", borderRadius: "var(--r-xs)", padding: "0 10px", background: "var(--bg-1)", maxWidth: 160 }}>
              <span style={{ color: "var(--fg-4)", fontSize: 13 }}>$</span>
              <input
                id="depositAmount"
                name="depositAmount"
                type="number"
                min={0.5}
                step="0.01"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="deposit"
                style={{ ...inputStyle, fontFamily: "var(--font-mono)", border: "none", background: "transparent", padding: "9px 2px" }}
              />
            </div>
            <p style={hintStyle}>A deposit cuts no-shows and runs the first payment through Vraelis (your cut, automatically). Needs payouts connected below.</p>
          </div>
        )}
      </Step>

      {/* 4 — Qualifying questions */}
      <Step n={4} title="What should Vraelis ask to qualify buyers?">
        <textarea
          name="qualifyingQuestions"
          defaultValue={initialQualifying}
          placeholder={"One per line — the things you'd want to know before a call. e.g.\nWhat's your current monthly revenue?\nWhat's your goal in the next 90 days?\nHave you worked with a coach before?\nWhat's your timeline to start?"}
          maxLength={1500}
          rows={4}
          style={{ ...inputStyle, resize: "vertical" }}
        />
        <p style={hintStyle}>Vraelis asks these naturally in conversation to separate serious buyers from browsers.</p>
      </Step>

      {/* 5 — Where leads come from */}
      <Step n={5} title="Where do your leads come from?">
        <input
          name="leadSources"
          defaultValue={initialLeadSources}
          placeholder="e.g. Instagram DMs, link in bio, webinars, referrals, email list"
          maxLength={500}
          style={inputStyle}
        />
        <p style={hintStyle}>Just so you know where to drop your Vraelis link. Connect the channels themselves below.</p>
      </Step>

      <div style={{ display: "flex", alignItems: "center", gap: 12, borderTop: "1px solid var(--line-1)", paddingTop: 18 }}>
        <button type="submit" className="btn" disabled={pending} style={{ opacity: pending ? 0.7 : 1 }}>
          {pending ? "Saving…" : "Save your offer"}
        </button>
        {state && (
          <span style={{ fontSize: 13, color: state.ok ? "var(--acc-deep)" : "#9F2D2D" }}>{state.message}</span>
        )}
      </div>
    </form>
  );
}
