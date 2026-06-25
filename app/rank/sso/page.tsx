"use client";

import { useState } from "react";

const ERRORS: Record<string, string> = {
  sso_unavailable: "SSO isn't available for that link. Try entering your work email below.",
  invalid_callback: "The sign-in response was incomplete. Please try again.",
  state_mismatch: "The sign-in session expired or didn't match. Please try again.",
  nonce_mismatch: "Couldn't verify the sign-in response. Please try again.",
  domain_mismatch: "Your identity provider returned an email that doesn't match your organization's verified domain.",
  domain_not_verified: "Your organization's domain isn't verified for SSO.",
  email_unverified: "Your identity provider reported your email as unverified.",
  sso_disabled: "Your organization has SSO sign-in but domain access is turned off. Ask an admin to enable domain access.",
  saml_not_enabled: "SAML sign-in isn't enabled yet. OIDC SSO is supported.",
  token_exchange_failed: "Couldn't complete sign-in with your identity provider. Please try again.",
  validation_failed: "Couldn't validate your sign-in. Please try again.",
  provision_failed: "Couldn't map you into your organization. Please try again.",
  idp_error: "Your identity provider reported an error. Please try again.",
};

export default function SsoPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const initialError = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("error") : null;
  const [err, setErr] = useState(initialError && ERRORS[initialError] ? ERRORS[initialError] : "");

  async function go() {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setMsg("Enter a valid work email."); return; }
    setBusy(true); setMsg(""); setErr("");
    const r = await fetch("/api/v/sso/resolve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const j = await r.json().catch(() => ({}));
    if (j.redirect) { window.location.href = j.redirect; return; }
    setBusy(false);
    setMsg("If your organization has SSO enabled, you'll be redirected. Otherwise, sign in with your usual method.");
  }

  return (
    <div className="wrap" style={{ maxWidth: 460, paddingTop: "clamp(40px, 8vw, 90px)", paddingBottom: 80 }}>
      <p className="eyebrow">Enterprise sign-in</p>
      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 4vw, 2.4rem)", marginBottom: 10 }}>Sign in with SSO</h1>
      <p style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: 1.6, marginBottom: 22 }}>Enter your work email. If your organization has configured single sign-on for a verified domain, you&apos;ll be redirected to your identity provider.</p>
      {err && <div className="card" style={{ marginBottom: 16, borderColor: "var(--money)", background: "color-mix(in srgb, var(--money) 6%, transparent)" }}><p style={{ fontSize: 13, color: "var(--fg-2)", margin: 0, lineHeight: 1.6 }}>{err}</p></div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" onKeyDown={(e) => { if (e.key === "Enter" && !busy) go(); }} style={{ flex: "1 1 220px", padding: "11px 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 15, outline: "none" }} />
        <button onClick={go} disabled={busy} className="btn" style={{ opacity: busy ? 0.6 : 1 }}>{busy ? "Checking…" : "Continue"}</button>
      </div>
      {msg && <p style={{ fontSize: 13, color: "var(--fg-3)", margin: "14px 0 0", lineHeight: 1.6 }}>{msg}</p>}
      <p style={{ fontSize: 12.5, color: "var(--fg-5)", margin: "26px 0 0", lineHeight: 1.6 }}>SSO authenticates you into your organization. Workspace and project permissions are managed separately. <a href="/signin" style={{ color: "var(--acc-deep)" }}>Use a different sign-in method →</a></p>
    </div>
  );
}
