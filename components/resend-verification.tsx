"use client";

import { useState, type CSSProperties, type FormEvent } from "react";

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--line-2)",
  background: "var(--bg-1)",
  fontSize: 14,
  color: "var(--fg-1)",
  outline: "none",
};

export function ResendVerification({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [email,   setEmail]   = useState(defaultEmail);
  const [status,  setStatus]  = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage(null);

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Could not send verification email.");
        return;
      }

      setStatus("sent");
      setMessage("If that email has a pending signup, a fresh verification link is on the way. Check your inbox (and spam folder).");
    } catch {
      setStatus("error");
      setMessage("Network error. Try again in a minute.");
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 16, display: "grid", gap: 12 }}>
      <label style={{ fontFamily: "var(--font-code)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--fg-4)" }}>
        Your email
      </label>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        style={inputStyle}
      />

      {message && (
        <div style={{
          borderRadius: "var(--r-sm)", border: "1px solid", padding: "10px 12px", fontSize: 12.5, lineHeight: 1.5,
          ...(status === "error"
            ? { borderColor: "rgba(178,58,58,0.25)", background: "rgba(178,58,58,0.08)", color: "#9F2D2D" }
            : { borderColor: "var(--acc-line)", background: "var(--acc-soft)", color: "var(--acc-deep)" }),
        }}>
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={status === "loading" || status === "sent"}
        className="btn"
        style={{ width: "100%", opacity: status === "loading" || status === "sent" ? 0.6 : 1 }}
      >
        {status === "loading" ? "Sending…"
        : status === "sent"    ? "Sent, check your inbox"
                               : "Send a new link"}
      </button>
    </form>
  );
}
