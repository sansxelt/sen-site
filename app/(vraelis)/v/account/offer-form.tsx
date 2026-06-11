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
        <h3 style={{ fontSize: 14, color: "var(--fg-1)", margin: "3px 0 9px", letterSpacing: "-0.01em" }}>{title}</h3>
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
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* 1 — What you sell */}
      <Step n={1} title="What do you sell?">
        <input
          name="businessName"
          defaultValue={initialName}
          placeholder="Offer name — e.g. Apex Coaching"
          maxLength={120}
          style={{ ...inputStyle, marginBottom: 8 }}
        />
        <textarea
          name="businessDescription"
          defaultValue={initialDescription}
          placeholder="One line on what it is — e.g. 12-week 1:1 coaching for founders scaling past $10k/mo."
          maxLength={400}
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </Step>

      {/* 2 — How much */}
      <Step n={2} title="Price">
        <textarea
          name="businessServices"
          defaultValue={initialServices}
          placeholder={"One per line with a price — e.g.\n12-week program — $4,000\nStrategy call — $750"}
          maxLength={2000}
          rows={3}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 13 }}
        />
        <p style={hintStyle}>Vraelis quotes <b>only</b> these prices and can collect them on-platform.</p>
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

      {/* Advanced — collapsed by default so core setup stays to 3 steps */}
      <details style={{ borderTop: "1px solid var(--line-1)", paddingTop: 14 }}>
        <summary style={{ cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11.5, letterSpacing: "0.04em", color: "var(--fg-3)", listStyle: "none" }}>
          <span style={{ color: "var(--acc-deep)" }}>+</span> Advanced — qualification &amp; lead sources <span style={{ color: "var(--fg-5)" }}>(optional)</span>
        </summary>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
          <div>
            <label style={labelStyle} htmlFor="qualifyingQuestions">What should Vraelis ask to qualify buyers?</label>
            <textarea
              id="qualifyingQuestions"
              name="qualifyingQuestions"
              defaultValue={initialQualifying}
              placeholder={"One per line — e.g.\nWhat's your monthly revenue?\nWhat's your goal in 90 days?\nTimeline to start?"}
              maxLength={1500}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <p style={hintStyle}>Vraelis asks these naturally to separate serious buyers from browsers.</p>
          </div>
          <div>
            <label style={labelStyle} htmlFor="leadSources">Where do your leads come from?</label>
            <input
              id="leadSources"
              name="leadSources"
              defaultValue={initialLeadSources}
              placeholder="e.g. Instagram DMs, link in bio, webinars, referrals"
              maxLength={500}
              style={inputStyle}
            />
            <p style={hintStyle}>Just so you know where to drop your Vraelis link.</p>
          </div>
        </div>
      </details>

      <div style={{ display: "flex", alignItems: "center", gap: 12, borderTop: "1px solid var(--line-1)", paddingTop: 16 }}>
        <button type="submit" className="btn" disabled={pending} style={{ opacity: pending ? 0.7 : 1 }}>
          {pending ? "Saving…" : "Save setup"}
        </button>
        {state && (
          <span style={{ fontSize: 13, color: state.ok ? "var(--acc-deep)" : "#9F2D2D" }}>{state.message}</span>
        )}
      </div>
    </form>
  );
}
