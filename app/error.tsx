"use client";

import Link from "next/link";
import { useEffect } from "react";
import { GROUND_CSS } from "@/lib/v6-routes";

/* THE ROUTE ERROR BOUNDARY, IN DESIGN 06.
 *
 * It used to be written against the ambient design tokens: className="eyebrow", className="display",
 * var(--acc-deep) on the support link. The comment above it explained that this "renders INSIDE the app
 * shell, so the design tokens from the root layout are available", and that was true and also not the
 * question. The tokens are available; WHICH VALUES they hold is decided further down, by whether something
 * mounted ProductSurface, and an error boundary replaces the page that would have done the mounting.
 *
 * So on every graphite surface — /signin, the whole /auth round trip, /invite, and the homepage — an error
 * rendered the public LIGHT palette against a near-black document: dark ink on near-black, plus an emerald
 * link that design 06 does not have. The one page whose entire job is to stay calm when something has
 * already failed was the page that looked most broken.
 *
 * IT PAINTS ITS OWN SURFACE INSTEAD, which is what app/not-found.tsx already does and for the same reason.
 * Inheriting is not an option here even in principle: this boundary catches errors on light routes
 * (/platform, /pricing) AND dark ones (/signin, /docs), so there is no ambient ground it could follow that
 * would be right for both. A surface that cannot know what it is standing on has to bring its own floor.
 * Graphite, matching the 404, because "something went wrong" is one voice across the site.
 *
 * The colour rule holds: nothing here is coloured. An error boundary firing is not a verification failing,
 * and spending the red that means "this check failed" on a page-load fault would teach the wrong thing.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  const g = GROUND_CSS.graphite;
  return (
    <main className="verr">
      <style>{`html, body { background: ${g.bg} !important; color-scheme: ${g.scheme} !important; }` + ERR_CSS}</style>
      <div className="verr-stack">
        <p className="verr-kicker">Vraelis</p>
        <h1 className="verr-head">This page hit an error.</h1>
        <p className="verr-body">
          Something on our end went wrong loading this page. Your account and your credits are unaffected.
          Try again, and if it keeps happening, email <a className="verr-mail" href="mailto:help@vraelis.com">help@vraelis.com</a>.
        </p>
        <div className="verr-actions">
          <button type="button" className="verr-cta" onClick={reset}>Try again</button>
          <Link href="/" className="verr-link">Back to Vraelis</Link>
        </div>
        {error.digest ? <p className="verr-ref">Reference: {error.digest}</p> : null}
      </div>
    </main>
  );
}

/* Design 06, written out, for the same reason app/not-found.tsx writes it out: this renders from the ROOT
   layout, which never loads the v6 stylesheet, and it must not depend on the product stylesheet either
   because it is reached from both sides. Keep in step with _system/v6.css by hand. */
const ERR_CSS = `
.verr{
  position:relative; min-height:100svh;
  display:flex; align-items:center; justify-content:center;
  padding:clamp(40px,8vw,96px) clamp(20px,5vw,64px);
  background:#0A0A0B; color:#C4C5C9;
  font-family:var(--font-geist-sans),-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;
}
.verr-stack{ width:100%; max-width:620px; }
.verr-kicker{
  margin:0 0 18px; font-size:13px; font-weight:500;
  letter-spacing:.14em; text-transform:uppercase; color:#8E9095;
}
.verr-head{
  margin:0; font-weight:600; letter-spacing:-.032em; line-height:1.04;
  font-size:clamp(2rem,4.2vw,3.1rem); color:#FAFAFA; text-wrap:balance;
}
.verr-body{
  margin:20px 0 0; max-width:54ch;
  font-size:clamp(1rem,1.2vw,1.08rem); line-height:1.6; color:#C4C5C9; text-wrap:pretty;
}
/* The support address is the one thing on the page a person may need to act on, so it is underlined at rest
   rather than on hover. A link nobody can see is not a link. */
.verr-mail{ color:#FAFAFA; text-decoration:none; border-bottom:1px solid rgba(255,255,255,.4); padding-bottom:1px; }
.verr-mail:hover{ border-color:#FAFAFA; }
.verr-actions{ display:flex; flex-wrap:wrap; align-items:center; gap:22px; margin-top:34px; }
/* Contrast, not hue. The primary action is white on graphite everywhere in design 06. */
.verr-cta{
  display:inline-flex; align-items:center; justify-content:center;
  background:#FAFAFA; color:#0A0A0B; border:0; cursor:pointer;
  font-family:inherit; font-size:15px; font-weight:550; letter-spacing:-.01em;
  padding:12px 22px; border-radius:11px;
  transition:background 140ms cubic-bezier(0,0,.2,1);
}
.verr-cta:hover{ background:#FFFFFF; }
.verr-link{
  font-size:14.5px; color:#C4C5C9; text-decoration:none;
  border-bottom:1px solid rgba(255,255,255,.22); padding-bottom:2px;
  transition:color 140ms ease, border-color 140ms ease;
}
.verr-link:hover{ color:#FAFAFA; border-color:rgba(255,255,255,.5); }
.verr-ref{ margin:22px 0 0; font-family:var(--font-geist-mono),ui-monospace,SFMono-Regular,Menlo,monospace;
  font-size:11.5px; color:#8E9095; }
.verr-cta:focus-visible, .verr-link:focus-visible, .verr-mail:focus-visible{
  outline:2px solid #FAFAFA; outline-offset:3px; border-radius:4px;
}
`;
