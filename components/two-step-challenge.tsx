"use client";

// The second step of signing in. app/signin/page.tsx renders this INSTEAD of the sign-in form whenever the
// session is a pending two-step sign-in (password, Google, GitHub or SSO accepted, code not yet entered).
//
// It decides nothing. Every action posts to /api/auth/two-step, which runs an Auth.js session update; the code
// is checked in the jwt callback on the server (lib/two-step-session.ts). This screen only shows the answer:
// signed in (go on to callbackUrl), still pending with a notice, or signed out (the pending state aged out).
//
// Same form system as the sign-in form (components/vraelis-auth.tsx): .auth-form classes from
// public/vraelis/authenticated.css, labels above fields, one ink primary button, outlined secondary buttons.

import { signOut } from "next-auth/react";
import { useEffect, useRef, useState, type FormEvent } from "react";

type Method = "totp" | "email";
type Mode = Method | "recovery";
type Notice = "invalid" | "expired" | "rate_limited" | "unavailable" | "sent" | "send_failed" | "send_limited";
type Status = { tone: "error" | "info" | "success"; message: string };

type Reply = {
  ok?: boolean;
  state?: "signed_in" | "pending" | "signed_out";
  notice?: Notice | null;
  methods?: Method[] | null;
  emailSentAt?: number | null;
};

function noticeText(n: Notice, mode: Mode, emailHint: string): Status {
  switch (n) {
    case "invalid": return { tone: "error", message: mode === "recovery" ? "That recovery code did not work. Check it, or try another one." : "That code did not work. Check it and try again." };
    case "expired": return { tone: "error", message: mode === "email" ? "That code has expired. Send a new one and use the newest email." : "That code has expired. Try the current one." };
    case "rate_limited": return { tone: "error", message: "Too many attempts. Wait a few minutes, then try again." };
    case "unavailable": return { tone: "error", message: "We could not check that right now. Try again in a moment." };
    case "sent": return { tone: "info", message: `Code sent to ${emailHint}. It can take a minute to arrive.` };
    case "send_failed": return { tone: "error", message: "We could not send the email just now. Try again shortly, or use another way to verify." };
    case "send_limited": return { tone: "error", message: "You have asked for several codes. Wait a few minutes before asking for another." };
  }
}

export function TwoStepChallenge({
  callbackUrl,
  methods: initialMethods,
  emailHint,
  emailSentAt: initialEmailSentAt,
}: {
  callbackUrl: string;
  methods: Method[] | null;
  emailHint: string;
  emailSentAt: number | null;
}) {
  const [methods, setMethods] = useState<Method[] | null>(initialMethods);
  const [mode, setMode] = useState<Mode>(initialMethods?.includes("totp") ? "totp" : initialMethods?.includes("email") ? "email" : "totp");
  const [emailSentAt, setEmailSentAt] = useState<number | null>(initialEmailSentAt);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"verify" | "send" | "recheck" | "leave" | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, [mode]);

  async function post(payload: Record<string, unknown>): Promise<Reply | null> {
    try {
      const res = await fetch("/api/auth/two-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return (await res.json().catch(() => ({}))) as Reply;
    } catch {
      return null;
    }
  }

  // One place that reads a reply: go on when signed in, start over when the pending sign-in is gone.
  function settle(reply: Reply | null, forMode: Mode): boolean {
    if (!reply) { setStatus({ tone: "error", message: "Network error. Check your connection and try again." }); return false; }
    if (reply.state === "signed_in") {
      setStatus({ tone: "success", message: "Verified. Signing you in." });
      window.location.assign(callbackUrl);
      return true;
    }
    if (reply.state === "signed_out") {
      setStatus({ tone: "error", message: "This sign-in timed out. Sign in again to get a new code." });
      window.setTimeout(() => window.location.assign(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`), 1600);
      return true;
    }
    if (reply.methods !== undefined) setMethods(reply.methods ?? null);
    if (typeof reply.emailSentAt === "number") setEmailSentAt(reply.emailSentAt);
    setStatus(reply.notice ? noticeText(reply.notice, forMode, emailHint) : null);
    return false;
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim()) return;
    setBusy("verify");
    setStatus(null);
    const reply = await post({ action: "verify", method: mode, code });
    const done = settle(reply, mode);
    if (!done) { setBusy(null); setCode(""); inputRef.current?.focus(); }
  }

  async function sendEmail() {
    setBusy("send");
    setStatus(null);
    setMode("email");
    setCode("");
    const reply = await post({ action: "send_email" });
    settle(reply, "email");
    setBusy(null);
  }

  async function recheck() {
    setBusy("recheck");
    setStatus(null);
    const reply = await post({ action: "recheck" });
    const done = settle(reply, mode);
    if (!done && reply?.methods) setMode(reply.methods.includes("totp") ? "totp" : "email");
    setBusy(null);
  }

  async function leave() {
    setBusy("leave");
    await signOut({ redirectTo: `/signin?callbackUrl=${encodeURIComponent(callbackUrl)}` });
  }

  function switchTo(next: Mode) {
    if (next === "email" && !emailSentAt) { void sendEmail(); return; }
    setMode(next);
    setCode("");
    setStatus(null);
  }

  const leaveButton = (
    <button type="button" className="auth-form__provider two-step__leave" onClick={() => void leave()} disabled={busy === "leave"}>
      {busy === "leave" ? "Signing out…" : "Sign in as someone else"}
    </button>
  );

  // The settings could not be read when the password (or provider) was accepted. The step is not waived; the
  // person can ask again once the database answers.
  if (!methods) {
    return (
      <div className="auth-form">
        <div className="auth-form__head">
          <h1>Two-step verification</h1>
          <p>Your account uses two-step verification, and we could not load it just now. Try again in a moment.</p>
        </div>
        <button type="button" className="auth-form__submit" onClick={() => void recheck()} disabled={busy !== null}>
          {busy === "recheck" ? "Checking…" : "Try again"}
        </button>
        {status ? <div className="auth-form__status" data-tone={status.tone} role={status.tone === "error" ? "alert" : "status"}>{status.message}</div> : null}
        {leaveButton}
      </div>
    );
  }

  const lead =
    mode === "totp" ? "Open your authenticator app and enter the 6-digit code it shows for Vraelis."
    : mode === "email" ? (emailSentAt ? `We sent a 6-digit code to ${emailHint}. It works for 10 minutes.` : `We will email a 6-digit code to ${emailHint}.`)
    : "Enter one of the recovery codes you saved when you turned on two-step verification. Each code works once.";
  const label = mode === "totp" ? "Authenticator code" : mode === "email" ? "Email code" : "Recovery code";
  const isNumeric = mode !== "recovery";

  return (
    <div className="auth-form">
      <div className="auth-form__head">
        <h1>Two-step verification</h1>
        <p>{lead}</p>
      </div>

      <form onSubmit={verify} className="auth-form__fields">
        <label className="auth-form__field">
          <span>{label}</span>
          <input
            ref={inputRef}
            key={mode}
            className={isNumeric ? "two-step__code" : undefined}
            type="text"
            name={isNumeric ? "one-time-code" : "recovery-code"}
            inputMode={isNumeric ? "numeric" : "text"}
            autoComplete={isNumeric ? "one-time-code" : "off"}
            autoCapitalize="none"
            spellCheck={false}
            pattern={isNumeric ? "[0-9 ]*" : undefined}
            maxLength={isNumeric ? 7 : 24}
            placeholder={isNumeric ? "123456" : "abcde-fghjk"}
            value={code}
            onChange={(e) => setCode(isNumeric ? e.target.value.replace(/[^0-9 ]/g, "") : e.target.value)}
            disabled={busy === "verify"}
            required
          />
          {mode === "email" ? (
            emailSentAt ? (
              <span className="auth-form__hint">
                Not there? Check spam, or{" "}
                <button type="button" className="two-step__inline" onClick={() => void sendEmail()} disabled={busy !== null}>
                  {busy === "send" ? "sending…" : "send a new code"}
                </button>.
              </span>
            ) : (
              <span className="auth-form__hint">
                <button type="button" className="two-step__inline" onClick={() => void sendEmail()} disabled={busy !== null}>
                  {busy === "send" ? "Sending…" : "Send the code"}
                </button>
              </span>
            )
          ) : null}
        </label>
        <button type="submit" className="auth-form__submit" disabled={busy !== null || !code.trim() || (mode === "email" && !emailSentAt)}>
          {busy === "verify" ? "Checking…" : "Verify"}
        </button>
      </form>

      {status ? <div className="auth-form__status" data-tone={status.tone} role={status.tone === "error" ? "alert" : "status"}>{status.message}</div> : null}

      <div className="two-step__alts" aria-label="Other ways to verify">
        {mode !== "totp" && methods.includes("totp") ? (
          <button type="button" onClick={() => switchTo("totp")} disabled={busy !== null}>Use your authenticator app</button>
        ) : null}
        {mode !== "email" && methods.includes("email") ? (
          <button type="button" onClick={() => switchTo("email")} disabled={busy !== null}>{busy === "send" ? "Sending…" : "Email me a code"}</button>
        ) : null}
        {mode !== "recovery" ? (
          <button type="button" onClick={() => switchTo("recovery")} disabled={busy !== null}>Use a recovery code</button>
        ) : null}
      </div>

      {leaveButton}
    </div>
  );
}
