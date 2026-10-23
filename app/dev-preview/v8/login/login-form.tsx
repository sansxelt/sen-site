"use client";

import { useId, useRef, useState, type FormEvent } from "react";

// The credentials form (founder, 2026-10-23: Vraelis issues credentials to an organization, a team or a person; no
// Google or other third-party sign-in). Laid out like scale.com/demo: a two-column grid of fields and a Submit button
// with an arrow. The password goes from this browser straight to Auth0 (/co/authenticate); this site receives only the
// single-use login ticket, POSTed to /api/login/start, which continues to Auth0's /authorize. Errors are generic: the
// form never says whether an email exists.
type Props = { open: boolean; domain?: string; clientId?: string; realm?: string };
const MSG = {
  email: "Enter the work email on your Vraelis account.",
  password: "Enter your password.",
  wrong: "That email and password do not match a Vraelis account.",
  blocked: "Too many attempts. Wait a few minutes, then try again.",
  failed: "Logging in did not work. Try again.",
};

export function LoginForm({ open, domain, clientId, realm }: Props) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ticketForm = useRef<HTMLFormElement>(null);
  const ticket = useRef<HTMLInputElement>(null);
  const org = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!open || !domain || !clientId || !realm) return;
    const f = new FormData(e.currentTarget);
    const username = String(f.get("email") ?? "").trim();
    const password = String(f.get("password") ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(username)) return setError(MSG.email);
    if (!password) return setError(MSG.password);
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
      <form className="lgn-form" onSubmit={submit} noValidate aria-describedby={error ? `${id}-err` : undefined}>
        <div className="lgn-grid">
          <input className="lgn-input" name="organization" aria-label="Organization or team (optional)" placeholder="Organization or team (optional)"
            autoComplete="organization" disabled={!open || busy} />
          <input className="lgn-input" name="email" type="email" aria-label="Work email" placeholder="Work email*" autoComplete="username"
            inputMode="email" required disabled={!open || busy} />
          <input className="lgn-input lgn-span" name="password" type="password" aria-label="Password" placeholder="Password*"
            autoComplete="current-password" required disabled={!open || busy} />
        </div>
        {error && <p id={`${id}-err`} className="lgn-error" role="alert">{error}</p>}
        <button type="submit" className="lgn-submit" disabled={!open || busy}>
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
