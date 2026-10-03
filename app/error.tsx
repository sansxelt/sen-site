"use client";

import Link from "next/link";
import { useEffect } from "react";
import { GROUND_CSS, V6_HOME } from "@/lib/v6-routes";

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
 * Inheriting is not an option here even in principle: this boundary catches errors on every route, so there
 * is no ambient ground it could follow that would be right for all of them. A surface that cannot know what it
 * is standing on has to bring its own floor. The same black and the same buttons as the 404, because
 * "something went wrong" is one voice across the site (plan C, 2026-10-02): the way to try again first, as the
 * white button, then the way home as the ghost beside it, and a React <title>, since an error boundary is a
 * client component and cannot export metadata.
 *
 * TRY AGAIN RE-FETCHES. Next 16.2 hands error boundaries unstable_retry, which fetches the segment again and
 * re-renders it; reset only re-renders what is already on the client, which cannot recover from a server
 * error. The button uses retry where the framework provides it and reset where it does not.
 *
 * The colour rule holds: nothing here is coloured. An error boundary firing is not a check finding a problem,
 * and spending the red that means "a check found a problem" on a page-load fault would teach the wrong thing.
 */
export default function Error({ error, reset, unstable_retry }: { error: Error & { digest?: string }; reset: () => void; unstable_retry?: () => void }) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  const g = GROUND_CSS.paper;
  return (
    <main className="verr">
      <title>Error | Vraelis</title>
      <style>{`html, body { background: ${g.bg} !important; color-scheme: ${g.scheme} !important; }` + ERR_CSS}</style>
      <div className="verr-stack">
        <p className="verr-kicker">Vraelis</p>
        <h1 className="verr-head">This page hit an error.</h1>
        <p className="verr-body">Something on our end went wrong loading this page. Your account and your credits are unaffected.</p>
        {/* The address follows its sentence instead of sitting inside it, so the sentence stays whole for the
            translator, and the address is never translated. */}
        <p className="verr-help">
          <span>If it keeps happening, email us.</span>{" "}
          <a className="verr-mail" href="mailto:help@vraelis.com" data-no-translate>help@vraelis.com</a>
        </p>
        <div className="verr-actions">
          <button type="button" className="verr-btn verr-cta" onClick={() => (unstable_retry ?? reset)()}>Try again</button>
          <Link href={V6_HOME} className="verr-btn verr-ghost">Back to Vraelis</Link>
        </div>
        {error.digest ? <p className="verr-ref">Reference <span data-no-translate>{error.digest}</span></p> : null}
      </div>
    </main>
  );
}

/* Design 06, written out, for the same reason app/not-found.tsx writes it out: this renders from the ROOT
   layout, which never loads the v6 stylesheet, and it must not depend on the product stylesheet either
   because it is reached from both sides. Keep in step with _system/v6.css (and the 404) by hand. */
const ERR_CSS = `
.verr{
  position:relative; min-height:100svh;
  display:flex; align-items:center; justify-content:center;
  padding:clamp(40px,8vw,96px) clamp(20px,5vw,64px);
  background:#0A0A0B; color:#C9CBD1;
  font-family:var(--font-brand-sans),-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;
}
.verr-stack{ width:100%; max-width:640px; }
.verr-kicker{
  margin:0 0 16px; font-size:14px; font-weight:500; line-height:1.3;
  letter-spacing:0; color:#A1A3A9;
}
/* The h1 tier: 56 at 1440, 36 on a phone, weight 500. */
.verr-head{
  margin:0; max-width:20ch; font-weight:500; letter-spacing:-.022em; line-height:1.06;
  font-size:clamp(2.25rem,3.9vw,3.5rem); color:#FAFAFA; text-wrap:balance;
}
:is(:lang(ja),:lang(zh),:lang(ko)) .verr-head{ max-width:16em; letter-spacing:0; line-height:1.16; }
:lang(ja) .verr-head{ word-break:auto-phrase; }
:lang(hi) .verr-head{ line-height:1.22; }
.verr-body{
  margin:20px 0 0; max-width:52ch;
  font-size:clamp(1.0625rem,1.39vw,1.25rem); line-height:1.5; color:#C9CBD1; text-wrap:pretty;
}
.verr-help{ margin:12px 0 0; font-size:16px; line-height:1.6; color:#C9CBD1; }
/* The support address is the one thing on the page a person may need to act on, so it is underlined at rest
   rather than on hover. A link nobody can see is not a link. Its colour is restated on hover: the site-wide
   a:hover colour is near black. */
.verr-mail{ color:#FAFAFA; text-decoration:none; border-bottom:1px solid rgba(255,255,255,0.44); padding-bottom:1px; }
.verr-mail:hover{ color:#FAFAFA; border-color:#FAFAFA; }
/* Two buttons at the large size (plan A5), the white one first; they wrap rather than squeeze. */
.verr-actions{ display:flex; flex-wrap:wrap; align-items:center; gap:12px; margin-top:32px; }
.verr-btn{
  position:relative; isolation:isolate; overflow:hidden;
  display:inline-flex; align-items:center; justify-content:center; box-sizing:border-box;
  min-height:52px; padding:8px 26px; border-radius:8px; border:1px solid transparent; margin:0;
  font-family:inherit; font-size:16px; font-weight:600; letter-spacing:-.005em; line-height:1.2; text-align:center;
  text-decoration:none; cursor:pointer;
  transition:transform 130ms cubic-bezier(0,0,.2,1), background-color 160ms ease, border-color 160ms ease;
}
.verr-btn:active{ transform:scale(.985); }
/* Primary: white, the label #0A0A0B in every state, a 10% black wipe from the left on hover. */
.verr-cta{ background:#FAFAFA; border-color:#FAFAFA; color:#0A0A0B; }
.verr-cta::before{
  content:""; position:absolute; inset:-1px; z-index:-1; pointer-events:none; border-radius:inherit;
  background:rgba(10,10,11,.10); clip-path:inset(0 101% 0 0); transition:clip-path 420ms cubic-bezier(0,0,.2,1);
}
.verr-cta:hover::before{ clip-path:inset(0 0 0 0); }
.verr-cta:hover, .verr-cta:focus-visible{ background:#FAFAFA; color:#0A0A0B; }
/* Ghost: the line lights and the ground lifts 5% on hover; the label stays white. */
.verr-ghost{ background:transparent; border-color:rgba(255,255,255,.24); color:#FAFAFA; }
.verr-ghost:hover, .verr-ghost:focus-visible{ background:rgba(255,255,255,.05); border-color:#FAFAFA; color:#FAFAFA; }
.verr-ref{ margin:24px 0 0; font-family:var(--font-brand-mono),ui-monospace,SFMono-Regular,Menlo,monospace;
  font-size:12px; color:#A1A3A9; }
.verr-btn:focus-visible, .verr-mail:focus-visible{ outline:2px solid #FAFAFA; outline-offset:3px; }
.verr-mail:focus-visible{ border-radius:3px; }
@media (max-width:560px){
  .verr-actions{ gap:10px; }
  .verr-btn{ min-height:44px; padding:6px 16px; font-size:15px; flex:1 1 auto; }
}
@media (prefers-reduced-motion: reduce){
  .verr-btn{ transition:none; }
  .verr-btn:active{ transform:none; }
  .verr-cta::before{ content:none; }
  .verr-cta:hover{ background:#E4E4E7; border-color:#E4E4E7; color:#0A0A0B; }
}
`;
