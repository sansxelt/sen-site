"use client";

import { useState } from "react";

// Reusable waitlist form. Posts to /api/waitlist with the
// product_interest tag so we can segment in the admin dashboard.

type Status = "idle" | "submitting" | "success" | "error";

type Props = {
  product: "workshop" | "whisper" | "lens" | "lens-day-kit" | "platform";
  accent?: string;
  cta?: string;
  placeholder?: string;
  size?: "default" | "large";
};

export function WaitlistForm({
  product,
  accent = "#a8c4ff",
  cta = "Join waitlist",
  placeholder = "your@email.com",
  size = "default",
}: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError]   = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), product }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Could not join. Try again.");
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not join.");
    }
  };

  if (status === "success") {
    return (
      <div
        style={{
          padding: size === "large" ? "20px 22px" : "14px 18px",
          borderRadius: 14,
          border: `1px solid ${accent}40`,
          background: `${accent}0d`,
          color: accent,
          fontSize: 14,
        }}
      >
        You are on the list. We will email when there is news.
      </div>
    );
  }

  const padY  = size === "large" ? 14 : 11;
  const fz    = size === "large" ? 15 : 14;

  return (
    <form onSubmit={submit} style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "stretch",
        }}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: "1 1 240px",
            padding: `${padY}px 14px`,
            borderRadius: 100,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.03)",
            color: "#f5f5f7",
            fontSize: fz,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          style={{
            padding: `${padY}px 22px`,
            borderRadius: 100,
            border: `1px solid ${accent}55`,
            background: `${accent}18`,
            color: accent,
            fontSize: fz,
            fontWeight: 500,
            cursor: status === "submitting" ? "wait" : "pointer",
            opacity: status === "submitting" ? 0.6 : 1,
            transition: "background 200ms",
          }}
        >
          {status === "submitting" ? "Joining…" : cta}
        </button>
      </div>
      {error && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#f87171" }}>{error}</div>
      )}
    </form>
  );
}
