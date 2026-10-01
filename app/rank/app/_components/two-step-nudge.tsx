"use client";

// The Overview's offer to turn on two-step verification. Shown until it is on (the page decides that on the
// server), and dismissible for the rest of the browser session.
//
// WHY A COOKIE AND NOT sessionStorage. The page renders on the server, so it has to know about a dismissal
// BEFORE it sends any HTML. sessionStorage is only readable after hydration, which means either a card that
// flashes up and vanishes for someone who dismissed it, or one that pops in late and shifts the page for
// everyone else. A cookie with no expiry lasts exactly one browser session and the server can read it.
//
// The name is written out literally (app/rank/app/page.tsx reads the same name, and scripts/two-step-verify.ts
// checks the two agree) so scripts/privacy-consent-verify.ts finds it and holds it to the cookie policy, where
// it is listed under Essential in app/_content/legal.tsx. A constant exported from this "use client" module
// would reach the server page as a client reference, not as the string.

import Link from "next/link";
import { useState } from "react";

export function TwoStepNudge() {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  function dismiss() {
    document.cookie = `vr_two_step_nudge=dismissed; path=/; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
    setHidden(true);
  }

  return (
    <div className="card" role="region" aria-label="Two-step verification" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 26, padding: "16px 20px" }}>
      <div style={{ flex: "1 1 320px", minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14.5, color: "var(--fg-1)" }}>Turn on two-step verification</div>
        <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 3, lineHeight: 1.5 }}>
          Right now a password alone gets into this account. Add a code from an authenticator app or your email to every sign-in. It takes about a minute.
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flex: "none" }}>
        <button type="button" className="btn btn--ghost" style={{ padding: "8px 14px", fontSize: 13.5 }} onClick={dismiss}>Not now</button>
        <Link href="/account#two-step" className="btn" style={{ padding: "8px 14px", fontSize: 13.5 }}>Set it up</Link>
      </div>
    </div>
  );
}
