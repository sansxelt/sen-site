"use client";

import { useState, type CSSProperties, type FormEvent } from "react";

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: "var(--r-xs)",
  border: "1px solid var(--line-2)",
  background: "var(--bg-1)",
  padding: "12px 14px",
  fontSize: 14,
  color: "var(--fg-1)",
  outline: "none",
  fontFamily: "var(--font-sans)",
};

export function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const data = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/vraelis/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          company: data.get("company"),
          message: data.get("message"),
          topic: "sales",
        }),
      });
      const json = (await res.json()) as { ok?: boolean };
      if (!res.ok || !json.ok) throw new Error("failed");
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="win" style={{ padding: "30px 28px", textAlign: "center" }}>
        <div style={{ width: 46, height: 46, borderRadius: "50%", border: "1px solid var(--acc-line)", background: "var(--acc-soft)", color: "var(--acc)", display: "grid", placeItems: "center", margin: "0 auto 18px", fontSize: 22 }}>✓</div>
        <h2 style={{ fontSize: 20, color: "var(--fg-1)", marginBottom: 10 }}>Thanks — we&apos;ll be in touch.</h2>
        <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55 }}>Our team will reply to your email shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="win" style={{ padding: "26px 26px", display: "flex", flexDirection: "column", gap: 12 }}>
      <input name="name" placeholder="Your name" style={inputStyle} />
      <input name="email" type="email" placeholder="Work email" required style={inputStyle} />
      <input name="company" placeholder="Company" style={inputStyle} />
      <textarea name="message" placeholder="How many leads a month, and what do you need?" required rows={4} style={{ ...inputStyle, resize: "vertical" }} />
      <button type="submit" className="btn" disabled={state === "sending"} style={{ justifyContent: "center", opacity: state === "sending" ? 0.7 : 1 }}>
        {state === "sending" ? "Sending…" : "Talk to sales"}
      </button>
      {state === "error" && <p style={{ fontSize: 13, color: "#9F2D2D", textAlign: "center" }}>Something went wrong — try again or email sales@vraelis.com.</p>}
    </form>
  );
}
