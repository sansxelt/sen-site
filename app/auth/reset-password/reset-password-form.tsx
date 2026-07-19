"use client";

import Link from "next/link";
import { useState, type CSSProperties, type FormEvent } from "react";

type StatusTone = "error" | "success";
type Status = { message: string; tone: StatusTone };

const inputStyle: CSSProperties = {
  width: "100%",
  marginTop: 8,
  padding: "12px 14px",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--line-2)",
  background: "var(--bg-1)",
  fontSize: 14.5,
  color: "var(--fg-1)",
  outline: "none",
};

function statusStyle(tone: StatusTone): CSSProperties {
  const c = tone === "success"
    ? { bg: "var(--acc-soft)", border: "var(--acc-line)", color: "var(--acc-deep)" }
    : { bg: "rgba(178,58,58,0.08)", border: "rgba(178,58,58,0.25)", color: "#9F2D2D" };
  return { borderRadius: "var(--r-sm)", border: `1px solid ${c.border}`, background: c.bg, color: c.color, padding: "10px 14px", fontSize: 13.5 };
}

const backLink: CSSProperties = { marginTop: 20, display: "inline-block", fontSize: 13.5, color: "var(--fg-3)", textDecoration: "none" };

export function ResetPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const payload = (await response.json()) as { error?: string; ok?: boolean };

      if (!response.ok) {
        throw new Error(payload.error ?? "We couldn't send the reset link.");
      }

      setSent(true);
    } catch (error) {
      setStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "We couldn't send the reset link. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="card" style={{ padding: "clamp(22px, 4vw, 32px)" }}>
        <p style={{ fontFamily: "var(--font-code)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--fg-4)", margin: 0 }}>
          Check your inbox
        </p>
        <h2 style={{ marginTop: 10, fontSize: 20, fontWeight: 700, color: "var(--fg-1)" }}>
          Reset link sent.
        </h2>
        <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: "var(--fg-3)" }}>
          If an email-based account exists for{" "}
          <span style={{ color: "var(--fg-1)", fontWeight: 600 }}>{email}</span>, you will receive a reset
          link shortly. It expires in one hour.
        </p>
        <Link href="/signin" style={backLink}>
          ← Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "clamp(22px, 4vw, 32px)" }}>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--fg-2)" }}>
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            placeholder="you@example.com"
            style={inputStyle}
          />
        </div>

        {status && <div style={statusStyle(status.tone)}>{status.message}</div>}

        <button type="submit" disabled={loading} className="btn" style={{ width: "100%", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>

      <Link href="/signin" style={backLink}>
        ← Back to sign in
      </Link>
    </div>
  );
}
