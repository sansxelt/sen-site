"use client";
import { useState } from "react";

const USE_OPTIONS = [
  { id: "daily",        label: "Daily wear",        sub: "Meetings, commutes, everyday life" },
  { id: "field",        label: "Field recording",   sub: "Journalism, research, documentation" },
  { id: "access",       label: "Accessibility",     sub: "Hearing, memory, or vision support" },
  { id: "build",        label: "Building with it",  sub: "Dev kit, research, third-party apps" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignUpCard() {
  const [step, setStep]     = useState(0);
  const [email, setEmail]   = useState("");
  const [err, setErr]       = useState("");
  const [use, setUse]       = useState("");

  const advance = () => {
    if (!EMAIL_RE.test(email)) { setErr("Enter a valid email."); return; }
    setErr("");
    setStep(1);
  };

  const submit = () => {
    if (!use) return;
    setStep(2);
  };

  const reset = () => { setEmail(""); setUse(""); setStep(0); };

  const card: React.CSSProperties = {
    background: "#0E1421",
    border: "1px solid rgba(199,205,215,0.10)",
    padding: "clamp(24px, 4vw, 40px)",
    position: "relative",
  };

  const label: React.CSSProperties = {
    fontFamily: "JetBrains Mono, monospace",
    fontSize: 10,
    letterSpacing: "0.08em",
    color: "#5A6478",
    textTransform: "uppercase" as const,
    marginBottom: 6,
    display: "block",
  };

  const input: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    background: "#060A12",
    border: "1px solid rgba(199,205,215,0.18)",
    color: "#ECEFF4",
    fontFamily: "Inter Tight, sans-serif",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box" as const,
    marginBottom: err ? 4 : 16,
  };

  const btn: React.CSSProperties = {
    width: "100%",
    padding: "12px 0",
    background: "#ECEFF4",
    color: "#0A0F18",
    fontFamily: "Inter Tight, sans-serif",
    fontSize: 14,
    fontWeight: 500,
    border: "none",
    cursor: "pointer",
    letterSpacing: "-0.005em",
  };

  const dots = (
    <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === step ? "#5CE5D5" : "rgba(199,205,215,0.15)" }} />
      ))}
    </div>
  );

  if (step === 2) return (
    <div style={card}>
      {dots}
      <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, letterSpacing: "0.06em", color: "#5CE5D5", marginBottom: 12 }}>YOU&apos;RE ON THE LIST</p>
      <h3 style={{ fontFamily: "Inter Tight, sans-serif", fontSize: "clamp(1.25rem, 2.5vw, 1.5rem)", fontWeight: 500, color: "#ECEFF4", lineHeight: 1.2, marginBottom: 12, letterSpacing: "-0.02em" }}>
        We&apos;ll write once when there&apos;s a dev-kit window.
      </h3>
      <p style={{ color: "#8B95A6", fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
        We won&apos;t send newsletters or marketing. One email, one real update.
      </p>
      <button onClick={reset} style={{ ...btn, background: "transparent", border: "1px solid rgba(199,205,215,0.18)", color: "#ECEFF4" }}>
        Add another email
      </button>
    </div>
  );

  if (step === 1) return (
    <div style={card}>
      {dots}
      <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, letterSpacing: "0.06em", color: "#5CE5D5", marginBottom: 12 }}>ONE MORE THING</p>
      <h3 style={{ fontFamily: "Inter Tight, sans-serif", fontSize: "clamp(1.25rem, 2.5vw, 1.5rem)", fontWeight: 500, color: "#ECEFF4", lineHeight: 1.2, marginBottom: 20, letterSpacing: "-0.02em" }}>
        How do you see yourself using it?
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {USE_OPTIONS.map((o) => (
          <button
            key={o.id}
            onClick={() => setUse(o.id)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              padding: "12px 14px",
              background: use === o.id ? "rgba(92,229,213,0.06)" : "#060A12",
              border: `1px solid ${use === o.id ? "rgba(92,229,213,0.30)" : "rgba(199,205,215,0.18)"}`,
              color: use === o.id ? "#ECEFF4" : "#8B95A6",
              cursor: "pointer",
              textAlign: "left" as const,
              transition: "all 0.15s",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 500, color: "inherit", fontFamily: "Inter Tight, sans-serif" }}>{o.label}</span>
            <span style={{ fontSize: 11, color: "#5A6478", fontFamily: "Inter Tight, sans-serif", marginTop: 2 }}>{o.sub}</span>
          </button>
        ))}
      </div>
      <button onClick={submit} disabled={!use} style={{ ...btn, opacity: use ? 1 : 0.4, cursor: use ? "pointer" : "default" }}>
        Continue
      </button>
    </div>
  );

  return (
    <div style={card}>
      {dots}
      <h3 style={{ fontFamily: "Inter Tight, sans-serif", fontSize: "clamp(1.25rem, 2.5vw, 1.625rem)", fontWeight: 500, color: "#ECEFF4", lineHeight: 1.2, marginBottom: 8, letterSpacing: "-0.02em" }}>
        Get early access.
      </h3>
      <p style={{ color: "#8B95A6", fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
        We&apos;ll write once when there&apos;s a dev-kit window. Not before.
      </p>
      <span style={label}>Email</span>
      <input
        style={input}
        type="email"
        placeholder="you@something.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && advance()}
      />
      {err && <p style={{ fontSize: 11, color: "#FF6470", marginBottom: 12, fontFamily: "JetBrains Mono, monospace" }}>{err}</p>}
      <button onClick={advance} style={btn}>Continue</button>
    </div>
  );
}
