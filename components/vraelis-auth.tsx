/* eslint-disable */
"use client";

// The Vraelis sign-in surface. NextAuth mechanics only: credentials via signIn(.., {redirect:false}),
// email signup via /api/auth/register, OAuth via signIn(provider). Nothing about credentials, providers,
// sessions or redirects is reimplemented here.
//
// It renders on the design-06 product tokens, which it reaches by being mounted inside ProductSurface
// rather than by knowing anything about the theme: every colour below is a token, so the same component
// renders correctly on whichever ground it is placed on. The one thing it must NOT do is reach for a
// colour directly, because that is what pinned the previous version to a cream-and-emerald surface.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";
import {
  getAuthErrorMessage,
  getSafeRedirectPath,
  oauthProviders,
  type OauthProvider,
} from "../lib/auth-ui";

type AuthMode = "signup" | "signin";
type Tone = "error" | "info" | "success";
type Status = { message: string; tone: Tone };

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
    <svg aria-hidden viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: "currentColor" }}>
      <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.04c-3.34.73-4.04-1.42-4.04-1.42-.55-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.09 1.83 1.23 1.83 1.23 1.08 1.84 2.82 1.31 3.5 1 .11-.78.42-1.31.77-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.39 1.23-3.23-.12-.3-.53-1.52.12-3.17 0 0 1.01-.32 3.3 1.23A11.48 11.48 0 0 1 12 6.3c1.02 0 2.05.14 3.01.4 2.29-1.55 3.29-1.23 3.29-1.23.66 1.65.25 2.87.13 3.17.77.84 1.23 1.92 1.23 3.23 0 4.61-2.81 5.62-5.49 5.92.43.38.82 1.1.82 2.22v3.3c0 .32.21.7.83.58A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

export function VraelisSignIn({
  callbackUrl = "/account",
  initialMode = "signin",
  // Defaults ON, so /signin is unchanged. The V6 surface supplies its own heading and would otherwise
  // stack two of them on the same screen, pushing the form
  // most of a fold down.
  showHeader = true,
  // Where Terms and Privacy live for the surface rendering this form. Empty keeps /terms and /privacy, which
  // is right for the current site; V6 passes its own base so the links do not walk out of the preview into
  // the previous design.
  legalBase = "",
}: {
  callbackUrl?: string;
  initialMode?: AuthMode;
  showHeader?: boolean;
  legalBase?: string;
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

  const switchTo = (m: AuthMode) => { setMode(m); setStatus(null); };

  // THE FORM, REBUILT (2026-09-30). A floating card with a segmented toggle, placeholder-only fields and a
  // blue button is gone. Labels sit above the fields, the primary action is ink like every other primary
  // action in the product, providers are plain outlined rows, and switching between signing in and creating
  // an account is a sentence at the foot, the way people expect it.
  return (
    <div className="auth-form">
      {showHeader ? (
        <div className="auth-form__head">
          <h1>{mode === "signup" ? "Create your account" : "Sign in to Vraelis"}</h1>
          <p>{mode === "signup" ? "Free to start, no card required. One account for the console, the CLI and the API." : "Welcome back. One account for the console, the CLI and the API."}</p>
        </div>
      ) : null}

      <div className="auth-form__providers">
        {oauthProviders.map((opt) => {
          const providerBusy = busy === opt.provider;
          return (
            <button key={opt.provider} type="button" className="auth-form__provider"
              onClick={() => void handleOAuth(opt.provider)} disabled={providerBusy || needsConsent}>
              {opt.provider === "google" ? <GoogleIcon /> : <GitHubIcon />}
              {providerBusy ? "Redirecting…" : `Continue with ${opt.label}`}
            </button>
          );
        })}
      </div>

      <div className="auth-form__or"><span>or</span></div>

      <form onSubmit={handleEmailAuth} className="auth-form__fields">
        {mode === "signup" && (
          <label className="auth-form__field">
            <span>Name</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" disabled={emailBusy} required minLength={1} />
          </label>
        )}
        <label className="auth-form__field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" disabled={emailBusy} required />
        </label>
        <label className="auth-form__field">
          <span className="auth-form__labelrow">
            Password
            {mode === "signin" ? <Link href="/auth/reset-password" className="auth-form__forgot">Forgot password?</Link> : null}
          </span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"} disabled={emailBusy} required minLength={8} />
          {mode === "signup" ? <span className="auth-form__hint">At least 8 characters.</span> : null}
        </label>

        {/* Clickwrap consent: it gates every way of creating an account, email and providers alike. */}
        {mode === "signup" && (
          <label className="auth-form__consent">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>I agree to the <Link href={`${legalBase}/terms`} target="_blank">Terms</Link>, the <Link href={`${legalBase}/privacy`} target="_blank">Privacy Policy</Link> and the <Link href={`${legalBase}/acceptable-use`} target="_blank">Acceptable Use Policy</Link>.</span>
          </label>
        )}

        <button type="submit" className="auth-form__submit" disabled={emailBusy || needsConsent}>
          {busy === "signup" ? "Creating account…" : busy === "signin" ? "Signing in…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
        {mode === "signup" ? <p className="auth-form__note">We will email you a link to confirm your address before your first sign-in.</p> : null}
      </form>

      {status ? <div className="auth-form__status" data-tone={status.tone} role={status.tone === "error" ? "alert" : "status"}>{status.message}</div> : null}

      <p className="auth-form__switch">
        {mode === "signup"
          ? <>Already have an account? <button type="button" onClick={() => switchTo("signin")}>Sign in</button></>
          : <>New to Vraelis? <button type="button" onClick={() => switchTo("signup")}>Create an account</button></>}
      </p>
    </div>
  );
}
