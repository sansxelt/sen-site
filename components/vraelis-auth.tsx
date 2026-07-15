/* eslint-disable */
"use client";

// Vraelis-branded sign-in surface. Same NextAuth mechanics as the
// sansxel AuthPanel/OAuthSection (credentials via signIn(..,{redirect:
// false}), email signup via /api/auth/register, OAuth via
// signIn(provider)), but rendered light + green + centered using the
// vraelis design tokens instead of the dark sansxel chrome.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, type CSSProperties, type FormEvent } from "react";
import {
  getAuthErrorMessage,
  getSafeRedirectPath,
  oauthProviders,
  type OauthProvider,
} from "../lib/auth-ui";

type AuthMode = "signup" | "signin";
type Tone = "error" | "info" | "success";
type Status = { message: string; tone: Tone };

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--line-2)",
  background: "var(--bg-1)",
  padding: "12px 14px",
  fontSize: 14.5,
  color: "var(--fg-1)",
  outline: "none",
  fontFamily: "var(--font-sans)",
  boxSizing: "border-box",
};

function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
      <path d="M21.64 12.2c0-.68-.06-1.34-.17-1.98H12v3.74h5.41a4.63 4.63 0 0 1-2.01 3.04v2.52h3.25c1.9-1.75 2.99-4.33 2.99-7.32Z" fill="#4285F4" />
      <path d="M12 22c2.7 0 4.97-.9 6.63-2.43l-3.25-2.52c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.58-4.12H3.06v2.6A9.99 9.99 0 0 0 12 22Z" fill="#34A853" />
      <path d="M6.42 13.89A5.98 5.98 0 0 1 6.1 12c0-.66.11-1.3.32-1.89V7.51H3.06A10 10 0 0 0 2 12c0 1.61.39 3.13 1.06 4.49l3.36-2.6Z" fill="#FBBC05" />
      <path d="M12 5.98c1.47 0 2.79.5 3.83 1.48l2.87-2.87C16.97 2.98 14.7 2 12 2a9.99 9.99 0 0 0-8.94 5.51l3.36 2.6c.78-2.36 2.98-4.13 5.58-4.13Z" fill="#EA4335" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: "var(--fg-1)" }}>
      <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.04c-3.34.73-4.04-1.42-4.04-1.42-.55-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.09 1.83 1.23 1.83 1.23 1.08 1.84 2.82 1.31 3.5 1 .11-.78.42-1.31.77-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.39 1.23-3.23-.12-.3-.53-1.52.12-3.17 0 0 1.01-.32 3.3 1.23A11.48 11.48 0 0 1 12 6.3c1.02 0 2.05.14 3.01.4 2.29-1.55 3.29-1.23 3.29-1.23.66 1.65.25 2.87.13 3.17.77.84 1.23 1.92 1.23 3.23 0 4.61-2.81 5.62-5.49 5.92.43.38.82 1.1.82 2.22v3.3c0 .32.21.7.83.58A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

function statusStyle(tone: Tone): CSSProperties {
  const map: Record<Tone, { bg: string; border: string; color: string }> = {
    success: { bg: "var(--acc-soft)", border: "var(--acc-line)", color: "var(--acc-deep)" },
    error: { bg: "rgba(178,58,58,0.08)", border: "rgba(178,58,58,0.25)", color: "#9F2D2D" },
    info: { bg: "var(--bg-2)", border: "var(--line-2)", color: "var(--fg-3)" },
  };
  const c = map[tone];
  return {
    marginTop: 16,
    borderRadius: "var(--r-xs)",
    border: `1px solid ${c.border}`,
    background: c.bg,
    color: c.color,
    padding: "11px 14px",
    fontSize: 13,
    lineHeight: 1.5,
  };
}

export function VraelisSignIn({
  callbackUrl = "/account",
  initialMode = "signin",
}: {
  callbackUrl?: string;
  initialMode?: AuthMode;
}) {
  const router = useRouter();
  const safeRedirect = getSafeRedirectPath(callbackUrl) || "/account";
  // Defaults to sign-in, but a signup-intent CTA (homepage "Start free")
  // opens straight in create-account mode so a brand-new user doesn't land
  // on a "Welcome back" sign-in screen.
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<AuthMode | OauthProvider | null>(null);
  const [agreed, setAgreed] = useState(false);

  const emailBusy = busy === "signup" || busy === "signin";
  // Clickwrap: creating an account (email OR OAuth) requires agreeing to Terms + Privacy.
  const needsConsent = mode === "signup" && !agreed;
  const CONSENT_MSG = "Please agree to the Terms and Privacy Policy to continue.";

  async function handleOAuth(provider: OauthProvider) {
    setStatus(null);
    if (mode === "signup" && !agreed) { setStatus({ tone: "error", message: CONSENT_MSG }); return; }
    setBusy(provider);
    try {
      await signIn(provider, { redirectTo: safeRedirect });
    } catch (error) {
      console.error("Provider auth failed:", error);
      setBusy(null);
      setStatus({ tone: "error", message: getAuthErrorMessage(error, "provider") });
    }
  }

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    if (mode === "signup" && !agreed) { setStatus({ tone: "error", message: CONSENT_MSG }); return; }
    setBusy(mode);
    try {
      if (mode === "signup") {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, name, password }),
        });
        const payload = (await response.json()) as { error?: string; verify?: "pending"; email?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "We couldn't create your account right now.");
        }
        if (payload.verify === "pending") {
          setPassword("");
          router.push(`/auth/verify-email?email=${encodeURIComponent(payload.email ?? email)}`);
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        redirectTo: safeRedirect,
      });
      if (result?.error) throw new Error(result.error);
      setPassword("");
      setStatus({ tone: "success", message: "Signing you in." });
      router.push(result?.url ?? safeRedirect);
      router.refresh();
    } catch (error) {
      console.error("Email auth failed:", error);
      setStatus({ tone: "error", message: getAuthErrorMessage(error, mode) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ width: "min(440px, 100%)", margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <a href="/" style={{ textDecoration: "none", color: "var(--fg-1)", fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.035em", display: "inline-block", marginBottom: 16 }}>Vraelis</a>
        <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3.6vw, 2.4rem)", marginBottom: 10 }}>
          {mode === "signup" ? <>Create your <span className="em">account</span>.</> : <>Access your <span className="em">account</span>.</>}
        </h1>
        <p style={{ fontSize: 14.5, color: "var(--fg-3)", lineHeight: 1.55 }}>
          {mode === "signup" ? "Connect an AI-built system and verify it before production." : "Sign in to your applications, verification runs, evidence, and reports."}
        </p>
      </div>

      <div className="card" style={{ padding: "22px 24px 26px", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-lg)" }}>
        {/* mode toggle */}
        <div className="seg" style={{ display: "flex", width: "100%", marginBottom: 20 }}>
          {(["signin", "signup"] as AuthMode[]).map((m) => (
            <button key={m} type="button" onClick={() => { setMode(m); setStatus(null); }} className={mode === m ? "on" : ""} style={{ flex: 1 }}>
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        {/* Clickwrap consent — gates every signup method (email + OAuth). */}
        {mode === "signup" && (
          <label style={{ display: "flex", gap: 9, alignItems: "flex-start", marginBottom: 16, fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5, cursor: "pointer" }}>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 2, width: 15, height: 15, flex: "none", accentColor: "var(--acc-deep)", cursor: "pointer" }} />
            <span>I agree to the <Link href="/terms" target="_blank" style={{ color: "var(--acc-deep)" }}>Terms</Link> and <Link href="/privacy" target="_blank" style={{ color: "var(--acc-deep)" }}>Privacy Policy</Link>.</span>
          </label>
        )}

        {/* OAuth */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {oauthProviders.map((opt) => {
            const providerBusy = busy === opt.provider;
            const primary = opt.provider === "google";
            return (
              <button
                key={opt.provider}
                type="button"
                onClick={() => void handleOAuth(opt.provider)}
                disabled={providerBusy || needsConsent}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%",
                  borderRadius: "var(--r-sm)", border: `1px solid ${primary ? "var(--line-3)" : "var(--line-2)"}`,
                  background: "var(--bg-1)", padding: "12px 14px", fontSize: 14.5, fontWeight: 600, color: "var(--fg-1)",
                  cursor: providerBusy ? "wait" : needsConsent ? "not-allowed" : "pointer", boxShadow: primary ? "var(--shadow-sm)" : "none",
                  opacity: needsConsent ? 0.55 : 1,
                }}
              >
                {opt.provider === "google" ? <GoogleIcon /> : <GitHubIcon />}
                {providerBusy ? "Redirecting…" : `Continue with ${opt.label}`}
              </button>
            );
          })}
        </div>

        {/* divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 18px" }}>
          <span style={{ flex: 1, height: 1, background: "var(--line-1)" }} />
          <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)", letterSpacing: "0.04em" }}>or with email</span>
          <span style={{ flex: 1, height: 1, background: "var(--line-1)" }} />
        </div>

        {/* email/password */}
        <form onSubmit={handleEmailAuth} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "signup" && (
            <input type="text" aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" disabled={emailBusy} required minLength={1} style={inputStyle} />
          )}
          <input type="email" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" disabled={emailBusy} required style={inputStyle} />
          <input type="password" aria-label="Password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" disabled={emailBusy} required minLength={8} style={inputStyle} />
          <button type="submit" className="btn" disabled={emailBusy || needsConsent} style={{ width: "100%", justifyContent: "center", marginTop: 2, opacity: (emailBusy || needsConsent) ? 0.7 : 1 }}>
            {busy === "signup" ? "Creating account…" : busy === "signin" ? "Signing in…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
          {mode === "signup" && <p style={{ fontSize: 12, color: "var(--fg-4)", textAlign: "center", margin: "2px 0 0", lineHeight: 1.5 }}>We&apos;ll email you a verification link to confirm your address before your first sign-in.</p>}
          {mode === "signin" && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Link href="/auth/reset-password" style={{ fontSize: 12, color: "var(--fg-4)", textDecoration: "none" }}>
                Forgot password?
              </Link>
            </div>
          )}
        </form>

        {status && <div style={statusStyle(status.tone)}>{status.message}</div>}
      </div>

      <p style={{ textAlign: "center", marginTop: 18, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-5)" }}>
        No card required. Cancel anytime.
      </p>
    </div>
  );
}
