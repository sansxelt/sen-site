"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";

// Render message text with URLs as short, clickable anchors instead of giant
// raw links that overflow the bubble. Any stray URL still wraps safely.
const URL_RE = /(https?:\/\/[^\s]+)/g;
const isUrl = (s: string) => /^https?:\/\//.test(s);
function linkLabel(url: string): string {
  if (url.includes("/book/")) return "Choose a time →";
  if (url.includes("/pay") || url.includes("checkout.stripe")) return "Pay securely →";
  return "Open link →";
}
function renderBody(text: string): ReactNode {
  return text.split(URL_RE).map((part, i) =>
    isUrl(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noreferrer"
        style={{ color: "var(--acc-deep)", fontWeight: 600, textDecoration: "underline", overflowWrap: "anywhere" }}
      >
        {linkLabel(part)}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

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

type Turn = { role: "lead" | "agent"; text: string };

// Self-contained lead chat (reused later by the embeddable widget):
// first screen collects details + the opening message, then it becomes a
// live multi-turn conversation with the AI on the same page.
export function IntakeForm({
  intakeKey,
  businessName,
}: {
  intakeKey: string;
  businessName: string;
}) {
  const [phase, setPhase] = useState<"form" | "chat" | "error">("form");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [leadId, setLeadId] = useState<string>("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Keep the latest message in view as the thread grows.
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [turns]);

  async function startConversation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const opening = String(data.get("message") ?? "");
    const phoneVal = String(data.get("phone") ?? "").trim();
    // SMS consent must be ACTIVELY given (checkbox) before a textable number is
    // captured. No phone, or no consent → we simply don't send the number; the
    // chat/email flow still works.
    if (phoneVal && !smsConsent) { setConsentError(true); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/vraelis/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: intakeKey,
          name: data.get("name"),
          email: data.get("email"),
          phone: smsConsent ? phoneVal : "",
          smsConsent,
          message: opening,
          source: "form",
        }),
      });
      const json = (await res.json()) as { ok?: boolean; leadId?: string; reply?: string };
      if (!res.ok || !json.ok || !json.leadId) throw new Error("failed");
      setLeadId(json.leadId);
      setTurns([
        { role: "lead", text: opening },
        ...(json.reply ? [{ role: "agent" as const, text: json.reply }] : []),
      ]);
      setPhase("chat");
    } catch {
      setPhase("error");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setTurns((t) => [...t, { role: "lead", text }]);
    setBusy(true);
    try {
      const res = await fetch("/api/vraelis/intake/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: intakeKey, leadId, message: text }),
      });
      const json = (await res.json()) as { ok?: boolean; reply?: string };
      if (!res.ok || !json.ok) throw new Error("failed");
      setTurns((t) => [...t, { role: "agent", text: json.reply ?? "" }]);
    } catch {
      setTurns((t) => [...t, { role: "agent", text: "Sorry — something went wrong. Please try again." }]);
    } finally {
      setBusy(false);
    }
  }

  if (phase === "error") {
    return (
      <div className="win" style={{ width: "min(440px,100%)", padding: "30px 28px", textAlign: "center" }}>
        <h2 style={{ fontSize: 20, color: "var(--fg-1)", marginBottom: 10 }}>Something went wrong.</h2>
        <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55 }}>Please refresh and try again.</p>
      </div>
    );
  }

  if (phase === "chat") {
    return (
      <div className="win" style={{ width: "min(440px,100%)", display: "flex", flexDirection: "column", maxHeight: "80vh" }}>
        <div className="win__bar">
          <div className="win__dots"><i /><i /><i /></div>
          <span className="win__addr"><span className="dot dot--acc pulse" /> {businessName}</span>
        </div>
        <div ref={threadRef} style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 12, minHeight: 220 }}>
          {turns.map((t, i) => (
            <div
              key={i}
              className={`bub ${t.role === "lead" ? "bub--out" : "bub--in"}`}
              style={{ maxWidth: "85%", alignSelf: t.role === "lead" ? "flex-end" : "flex-start", overflowWrap: "anywhere", wordBreak: "break-word" }}
            >
              <div className="bub__who">{t.role === "lead" ? "You" : businessName}</div>
              {renderBody(t.text)}
            </div>
          ))}
          {busy && (
            <div className="bub bub--in" style={{ alignSelf: "flex-start" }}>
              <span className="typing"><i /><i /><i /></span>
            </div>
          )}
        </div>
        <form onSubmit={sendMessage} style={{ display: "flex", gap: 8, padding: 14, borderTop: "1px solid var(--line-1)" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message…"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button type="submit" className="btn" disabled={busy || !input.trim()} style={{ opacity: busy || !input.trim() ? 0.6 : 1 }}>
            Send
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="win" style={{ width: "min(440px,100%)", padding: "28px 26px" }}>
      <p className="eyebrow" style={{ display: "inline-flex", marginBottom: 12 }}>Get in touch</p>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, letterSpacing: "-0.02em", color: "var(--fg-1)", marginBottom: 8 }}>
        Message {businessName}
      </h1>
      <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55, marginBottom: 20 }}>
        Drop your details and what you need — you&apos;ll get an answer in seconds, and can keep chatting right here.
      </p>
      <form onSubmit={startConversation} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input name="name" placeholder="Your name" style={inputStyle} />
        <input name="email" type="email" placeholder="Email" style={inputStyle} />
        <input name="phone" placeholder="Phone (optional, for text updates)" style={inputStyle} />
        <textarea name="message" placeholder="What can we help with?" required rows={4} style={{ ...inputStyle, resize: "vertical" }} />
        {/* Active, unchecked SMS opt-in. The phone above is only treated as
            SMS-consented when this is checked; the box is not in a <label> so
            tapping the Privacy/Terms links can't toggle it. */}
        <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
          <input
            id="smsConsent"
            type="checkbox"
            checked={smsConsent}
            onChange={(e) => { setSmsConsent(e.target.checked); if (e.target.checked) setConsentError(false); }}
            style={{ marginTop: 3, flexShrink: 0, width: 15, height: 15, accentColor: "var(--acc)", cursor: "pointer" }}
          />
          <span style={{ fontSize: 11, color: "var(--fg-3)", lineHeight: 1.5 }}>
            I agree to receive conversational text messages from {businessName} and its AI assistant about my inquiry, appointment scheduling, reminders, follow-up, support, payment requests, and service updates. Message frequency varies. Message and data rates may apply. Reply STOP to opt out and HELP for help. Consent is not a condition of purchase. See our{" "}
            <a href="https://vraelis.com/privacy" target="_blank" rel="noreferrer" style={{ color: "var(--acc-deep)", textDecoration: "underline" }}>Privacy Policy</a>{" "}and{" "}
            <a href="https://vraelis.com/terms" target="_blank" rel="noreferrer" style={{ color: "var(--acc-deep)", textDecoration: "underline" }}>Terms</a>.
          </span>
        </div>
        {consentError && (
          <p style={{ fontSize: 11, color: "#9F2D2D", lineHeight: 1.5, margin: "-2px 0 0" }}>
            To get text updates, check the box above — or clear the phone field to continue by chat and email.
          </p>
        )}
        <button type="submit" className="btn" disabled={busy} style={{ justifyContent: "center", opacity: busy ? 0.7 : 1 }}>
          {busy ? "Starting…" : "Start chat"}
        </button>
      </form>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-5)", textAlign: "center", marginTop: 16 }}>
        Powered by Vraelis
      </p>
    </div>
  );
}
