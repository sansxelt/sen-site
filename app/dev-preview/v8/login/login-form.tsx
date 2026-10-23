"use client";

import { useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";

// The credentials form (founder, 2026-10-23: Vraelis issues credentials to an organization, a team or a person; no
// Google or other third-party sign-in). Laid out like scale.com/demo: a two-column grid of fields and a Submit button
// with an arrow. The password goes from this browser straight to Auth0 (/co/authenticate); this site receives only the
// single-use login ticket, POSTed to /api/login/start, which continues to Auth0's /authorize. Errors are generic: the
// form never says whether an email exists.
const noSubscribe = () => () => {};
type Props = { open: boolean; domain?: string; clientId?: string; realm?: string };
const MSG = {
  email: "Enter the work email on your Vraelis account.",
  password: "Enter your password.",
  wrong: "That email and password do not match a Vraelis account.",
  blocked: "Too many attempts. Wait a few minutes, then try again.",
  failed: "Logging in did not work. Try again.",
  // Codex LOGIN-R4-01: while Auth0 is not connected, say so. No account was looked up and nothing was checked.
  closed: "Logging in is not open yet. Nothing was checked or sent.",
};

export function LoginForm({ open, domain, clientId, realm }: Props) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // NO-SCRIPT SAFETY (Codex, 2026-10-22 r2: with scripts off, the form fell back to a GET and put the password in the
  // /login URL). The fields render disabled and enable only once this component has hydrated, so without JavaScript
  // nothing can be typed and disabled fields are never submitted. method="post" is a second layer.
  const ready = useSyncExternalStore(noSubscribe, () => true, () => false);
  // Founder, 2026-10-23: "allow entire thing + flow ... no one got creds anyways". The form is usable whether or not
  // Auth0 is connected. Before it is (loginOpen() false), no account exists anywhere, so every attempt is answered
  // "not open yet" in the browser (Codex LOGIN-R4-01: never imply an account lookup). The password field is cleared
  // and nothing is sent or stored. Once Auth0 is configured and opened, the same form runs the real Auth0 flow below.
  const off = busy || !ready;
  const ticketForm = useRef<HTMLFormElement>(null);
  const ticket = useRef<HTMLInputElement>(null);
  const org = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ready) return;
    const f = new FormData(e.currentTarget);
    const username = String(f.get("email") ?? "").trim();
    const password = String(f.get("password") ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(username)) return setError(MSG.email);
    if (!password) return setError(MSG.password);
    if (!open || !domain || !clientId || !realm) { // not connected: nothing is sent, and the typed password is cleared
      const pw = e.currentTarget.elements.namedItem("password");
      if (pw instanceof HTMLInputElement) pw.value = "";
      return setError(MSG.closed);
    }
    setBusy(true); setError(null);
    try {
      const res = await fetch(`https://${domain}/co/authenticate`, {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_id: clientId, username, password, realm, credential_type: "http://auth0.com/oauth/grant-type/password-realm" }),
      });
      if (res.status === 429) { setBusy(false); return setError(MSG.blocked); }
      if (!res.ok) { setBusy(false); return setError(res.status === 401 || res.status === 403 ? MSG.wrong : MSG.failed); }
      const body = (await res.json()) as { login_ticket?: unknown };
      if (typeof body.login_ticket !== "string") { setBusy(false); return setError(MSG.failed); }
      ticket.current!.value = body.login_ticket;
      org.current!.value = String(f.get("organization") ?? "").trim();
      ticketForm.current!.submit();
    } catch {
      setBusy(false); setError(MSG.failed);
    }
  }

  return (
    <>
      {<noscript><p className="lgn-error">Logging in needs JavaScript. Turn it on for this page, then reload.</p></noscript>}
      <form className="lgn-form" method="post" onSubmit={submit} noValidate aria-describedby={error ? `${id}-err` : undefined}>
        <div className="lgn-grid">
          <label className="lgn-field lgn-span">
            <span className="lgn-label">Work email</span>
            <input className="lgn-input" name="email" type="email" placeholder="you@company.com" autoComplete="username"
              inputMode="email" required disabled={off} />
          </label>
          <label className="lgn-field">
            <span className="lgn-label">Password</span>
            <input className="lgn-input" name="password" type="password" placeholder="Your password" autoComplete="current-password"
              required disabled={off} />
          </label>
          <label className="lgn-field">
            <span className="lgn-label">Organization <span className="lgn-opt">optional</span></span>
            <input className="lgn-input" name="organization" placeholder="e.g. acme-robotics" autoComplete="organization"
              disabled={off} />
          </label>
        </div>
        {error && <p id={`${id}-err`} className="lgn-error" role="alert">{error}</p>}
        <button type="submit" className="lgn-submit" disabled={off}>
          {busy ? "Logging In" : "Log In"}<span className="lgn-submit__arrow" aria-hidden="true">›</span>
        </button>
      </form>
      {/* Carries only the single-use ticket to this site. */}
      <form ref={ticketForm} action="/api/login/start" method="post" hidden>
        <input ref={ticket} type="hidden" name="login_ticket" />
        <input ref={org} type="hidden" name="organization" />
      </form>
    </>
  );
}
