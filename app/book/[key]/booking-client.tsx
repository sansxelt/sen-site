"use client";

import { useState, type CSSProperties, type FormEvent } from "react";

type Slot = { iso: string; label: string };

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: "var(--r-xs)",
  border: "1px solid var(--line-2)",
  background: "var(--bg-1)",
  padding: "11px 13px",
  fontSize: 14,
  color: "var(--fg-1)",
  outline: "none",
  fontFamily: "var(--font-sans)",
};

export function BookingClient({
  intakeKey,
  businessName,
  leadId,
  slots,
  depositCents = 0,
}: {
  intakeKey: string;
  businessName: string;
  leadId: string;
  slots: Slot[];
  depositCents?: number;
}) {
  const depositLabel = depositCents > 0 ? `$${(depositCents / 100).toLocaleString()}` : "";
  const [selected, setSelected] = useState<string>("");
  const [state, setState] = useState<"idle" | "booking" | "done" | "error">("idle");
  const [confirmed, setConfirmed] = useState<string>("");

  async function book(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected || state === "booking") return;
    setState("booking");
    const data = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/vraelis/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: intakeKey,
          slot: selected,
          leadId,
          name: data.get("name"),
          email: data.get("email"),
          phone: data.get("phone"),
        }),
      });
      const json = (await res.json()) as { ok?: boolean; label?: string; redirect?: string };
      if (!res.ok || !json.ok) throw new Error("failed");
      if (json.redirect) {
        // Deposit required — send the lead to pay; booking confirms on payment.
        window.location.href = json.redirect;
        return;
      }
      setConfirmed(json.label ?? "");
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="win" style={{ width: "min(460px,100%)", padding: "30px 28px", textAlign: "center" }}>
        <div style={{ width: 46, height: 46, borderRadius: "50%", border: "1px solid var(--acc-line)", background: "var(--acc-soft)", color: "var(--acc)", display: "grid", placeItems: "center", margin: "0 auto 18px", fontSize: 22 }}>✓</div>
        <h2 style={{ fontSize: 20, color: "var(--fg-1)", marginBottom: 10 }}>You&apos;re booked.</h2>
        <p style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: 1.55 }}>
          {confirmed} with {businessName}. A confirmation is on its way to your email.
        </p>
      </div>
    );
  }

  return (
    <div className="win" style={{ width: "min(460px,100%)", padding: "26px 26px 28px" }}>
      <p className="eyebrow" style={{ display: "inline-flex", marginBottom: 12 }}>Book a time</p>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, letterSpacing: "-0.02em", color: "var(--fg-1)", marginBottom: 16 }}>
        Pick a time with {businessName}
      </h1>

      {slots.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--fg-3)" }}>No times available right now — please check back soon.</p>
      ) : (
        <form onSubmit={book}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 240, overflowY: "auto", marginBottom: 18, padding: 2 }}>
            {slots.map((s) => {
              const on = selected === s.iso;
              return (
                <button
                  key={s.iso}
                  type="button"
                  onClick={() => setSelected(s.iso)}
                  style={{
                    border: `1px solid ${on ? "var(--acc)" : "var(--line-2)"}`,
                    background: on ? "var(--acc-soft)" : "var(--bg-1)",
                    color: on ? "var(--acc-deep)" : "var(--fg-2)",
                    borderRadius: "var(--r-xs)",
                    padding: "8px 11px",
                    fontSize: 12.5,
                    cursor: "pointer",
                    fontFamily: "var(--font-mono)",
                    fontWeight: on ? 600 : 400,
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input name="name" placeholder="Your name" style={inputStyle} />
            <input name="email" type="email" placeholder="Email (for confirmation)" style={inputStyle} />
            <input name="phone" placeholder="Phone (optional)" style={inputStyle} />
            <button type="submit" className="btn" disabled={!selected || state === "booking"} style={{ justifyContent: "center", opacity: !selected || state === "booking" ? 0.6 : 1 }}>
              {state === "booking" ? (depositLabel ? "Redirecting…" : "Booking…") : depositLabel ? `Continue to ${depositLabel} deposit →` : "Confirm booking"}
            </button>
            {depositLabel && (
              <p style={{ fontSize: 11.5, color: "var(--fg-4)", textAlign: "center" }}>
                A {depositLabel} deposit confirms your booking. Paid securely through Vraelis.
              </p>
            )}
            {state === "error" && <p style={{ fontSize: 13, color: "#9F2D2D", textAlign: "center" }}>That slot may have just been taken — pick another.</p>}
          </div>
        </form>
      )}
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-5)", textAlign: "center", marginTop: 16 }}>
        Powered by Vraelis
      </p>
    </div>
  );
}
