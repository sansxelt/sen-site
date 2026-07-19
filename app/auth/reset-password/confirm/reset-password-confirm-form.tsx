"use client";

import Link from "next/link";
import { useState, type CSSProperties, type FormEvent } from "react";

type StatusTone = "error" | "success";
type Status = { message: string; tone: StatusTone };

const inputStyle: CSSProperties = {
  width: "100%", marginTop: 8, padding: "12px 14px", borderRadius: "var(--r-sm)",
  border: "1px solid var(--line-2)", background: "var(--bg-1)", fontSize: 14.5, color: "var(--fg-1)", outline: "none",
};
const backLink: CSSProperties = { marginTop: 20, display: "inline-block", fontSize: 13.5, color: "var(--fg-3)", textDecoration: "none" };

function statusStyle(tone: StatusTone): CSSProperties {
  const c = tone === "success"
    ? { bg: "var(--acc-soft)", border: "var(--acc-line)", color: "var(--acc-deep)" }
    : { bg: "rgba(178,58,58,0.08)", border: "rgba(178,58,58,0.25)", color: "#9F2D2D" };
  return { borderRadius: "var(--r-sm)", border: `1px solid ${c.border}`, background: c.bg, color: c.color, padding: "10px 14px", fontSize: 13.5 };
}

export function ResetPasswordConfirmForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="card" style={{ padding: "clamp(22px, 4vw, 32px)" }}>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--fg-3)", margin: 0 }}>
          This reset link is invalid or missing. Request a new one below.
        </p>
        <Link href="/auth/reset-password" style={backLink}>
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="card" style={{ padding: "clamp(22px, 4vw, 32px)" }}>
        <p style={{ fontFamily: "var(--font-code)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--fg-4)", margin: 0 }}>
          All done
        </p>
        <h2 style={{ marginTop: 10, fontSize: 20, fontWeight: 700, color: "var(--fg-1)" }}>
          Password updated.
        </h2>
        <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: "var(--fg-3)" }}>
          Your password has been changed. Sign in with your new credentials.
        </p>
        <Link href="/signin" className="btn" style={{ marginTop: 22, display: "inline-block" }}>
          Sign in
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const payload = (await response.json()) as { error?: string; ok?: boolean };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "We couldn't reset your password.");
      }

      setDone(true);
    } catch (error) {
      setStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "We couldn't reset your password. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ padding: "clamp(22px, 4vw, 32px)" }}>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--fg-2)" }}>
            New password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            disabled={loading}
            placeholder="At least 8 characters"
            style={inputStyle}
          />
        </div>

        {status && <div style={statusStyle(status.tone)}>{status.message}</div>}

        <button type="submit" disabled={loading} className="btn" style={{ width: "100%", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Saving..." : "Set new password"}
        </button>
      </form>

      <Link href="/auth/reset-password" style={backLink}>
        ← Request a new link
      </Link>
    </div>
  );
}
