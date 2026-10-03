import Link from "next/link";
import { V6_BASE, V6_HOME, GROUND_CSS } from "@/lib/v6-routes";
import type { Metadata } from "next";
import { robotsMeta } from "@/lib/stealth";

// A NOT-FOUND RESPONSE MUST NEVER BE INDEXABLE, AND THE FRAMEWORK'S OWN GUARD DOES NOT SURVIVE HERE.
//
// notFound() is documented to inject <meta name="robots" content="noindex" /> precisely because Next
// returns 200 rather than 404 for a STREAMED response (see the not-found file convention docs). That guard
// is a default, and an explicit metadata export outranks it: the root layout declares index/follow for the
// whole site, so every not-found response on this site was served as index, follow.
//
// Combined with the 200, that is an indexable junk surface. /docs/<anything> and /research/<anything> match
// a dynamic segment, stream, call notFound(), and answer 200 with a page that invites indexing. Measured on
// the live site the day it went public: /docs/nope and /research/nope both returned 200 with index, follow.
//
// robotsMeta rather than a literal, because this repo has fixed the same class of bug twice by insisting
// that one function decides indexing. With stealth off it returns the noindex asked for; with stealth on it
// returns noindex too, since the curtain exemption is only ever granted to the homepage.
//
// The title says what happened ("Page not found | Vraelis", through the root layout's template), so a tab or a
// history entry left on this page is not mistaken for a real one.
export const metadata: Metadata = { title: "Page not found", robots: robotsMeta(false) };


/* THE 404, IN DESIGN 06.
 *
 * It was the last surface still wearing the previous brand: warm paper, an emerald numeral, an italic serif
 * flourish on "exist", a green button, and a coloured bloom behind all of it. Every one of those is a thing
 * design 06 removed elsewhere, and this is the page a visitor lands on when something has already gone
 * wrong, so it is a poor place to look like a different company.
 *
 * IT PAINTS ITS OWN CANVAS. Every other route gets its ground from proxy.ts, which resolves it from the
 * route it is about to serve. A 404 by definition has no such route: the path matched nothing, so the proxy
 * falls through to the previous generation's cream and the document would flash pale behind a graphite page.
 * The rule that stopped the white flash everywhere else is the same one applied here, stated locally
 * because this is the one page the router cannot describe in advance.
 *
 * TWO WAYS OUT, THE WAY OUT FIRST (plan C, 2026-10-02): the white button goes home, and the ghost beside it
 * goes to how a check works on /platform, both at the site's large button size. Nothing else is on the page:
 * the giant "404" watermark that sat behind the text went with this pass, because the sentence already says it
 * and a decoration that faint (1.08:1) is clutter on the one page whose job is to send the reader on.
 *
 * The colour rule holds: nothing here is coloured, because nothing here is a state. A missing page is not a
 * failure the product detected, and dressing it in the red that means "a check found a problem" would spend
 * a signal on a typo.
 */
export default function NotFound() {
  const g = GROUND_CSS.paper;
  return (
    <main className="v404">
      <style>{`html, body { background: ${g.bg} !important; color-scheme: ${g.scheme} !important; }` + NF_CSS}</style>

      <div className="v404-stack">
        <p className="v404-kicker v404-in v404-d1">Vraelis</p>

        {/* One h1 carrying the whole meaning. */}
        <h1 className="v404-head v404-in v404-d2">This page does not exist.</h1>

        <p className="v404-body v404-in v404-d3">
          The link you followed is wrong, or it points at something Vraelis no longer has. Nothing is broken.
        </p>

        <div className="v404-actions v404-in v404-d4">
          <Link href={V6_HOME} className="v404-btn v404-cta">Back to Vraelis</Link>
          <Link href={`${V6_BASE}/platform#how`} className="v404-btn v404-ghost">See how it works</Link>
        </div>
      </div>
    </main>
  );
}

const NF_CSS = `
/* Design 06, written out. This page renders from the ROOT layout, which never loads the v6 stylesheet, so the
   values are restated here: the black ground and text greys, the h1 tier of the type scale, and the large
   button with its wipe (plan A3 and A5). Keep in step with _system/v6.css by hand. */
.v404{
  position:relative; min-height:100svh;
  display:flex; align-items:center; justify-content:center;
  overflow:hidden; isolation:isolate;
  padding:clamp(40px,8vw,96px) clamp(20px,5vw,64px);
  background:#0A0A0B; color:#C9CBD1;
  font-family:var(--font-brand-sans),-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;
}

/* Left-set, like every other design 06 opening: the sentence is the message. */
.v404-stack{ position:relative; z-index:1; width:100%; max-width:640px; }

.v404-kicker{
  margin:0 0 16px; font-size:14px; font-weight:500; line-height:1.3;
  letter-spacing:0; color:#A1A3A9;
}
/* The h1 tier: 56 at 1440, 36 on a phone, weight 500. */
.v404-head{
  margin:0; max-width:20ch; font-weight:500; letter-spacing:-.022em; line-height:1.06;
  font-size:clamp(2.25rem,3.9vw,3.5rem); color:#FAFAFA; text-wrap:balance;
}
:is(:lang(ja),:lang(zh),:lang(ko)) .v404-head{ max-width:16em; letter-spacing:0; line-height:1.16; }
:lang(ja) .v404-head{ word-break:auto-phrase; }
:lang(hi) .v404-head{ line-height:1.22; }
.v404-body{
  margin:20px 0 0; max-width:52ch;
  font-size:clamp(1.0625rem,1.39vw,1.25rem); line-height:1.5; color:#C9CBD1; text-wrap:pretty;
}

/* Two buttons at the large size, the white one first. They wrap rather than squeeze (German labels run long),
   and on a phone each takes its share of the line. */
.v404-actions{ display:flex; flex-wrap:wrap; align-items:center; gap:12px; margin-top:32px; }
.v404-btn{
  position:relative; isolation:isolate; overflow:hidden;
  display:inline-flex; align-items:center; justify-content:center; box-sizing:border-box;
  min-height:52px; padding:8px 26px; border-radius:8px; border:1px solid transparent;
  font-family:inherit; font-size:16px; font-weight:600; letter-spacing:-.005em; line-height:1.2; text-align:center;
  text-decoration:none; cursor:pointer;
  transition:transform 130ms cubic-bezier(0,0,.2,1), background-color 160ms ease, border-color 160ms ease;
}
.v404-btn:active{ transform:scale(.985); }
.v404-btn:focus-visible{ outline:2px solid #FAFAFA; outline-offset:3px; }
/* Primary: white, its label #0A0A0B in every state (the site-wide a:hover colour must not reach it), and a 10%
   black wipe from the left on hover. */
.v404-cta{ background:#FAFAFA; border-color:#FAFAFA; color:#0A0A0B; }
.v404-cta::before{
  content:""; position:absolute; inset:-1px; z-index:-1; pointer-events:none; border-radius:inherit;
  background:rgba(10,10,11,.10); clip-path:inset(0 101% 0 0); transition:clip-path 420ms cubic-bezier(0,0,.2,1);
}
.v404-cta:hover::before{ clip-path:inset(0 0 0 0); }
.v404-cta:hover, .v404-cta:focus-visible{ background:#FAFAFA; color:#0A0A0B; }
/* Ghost: the line lights and the ground lifts 5% on hover; the label stays white. */
.v404-ghost{ background:transparent; border-color:rgba(255,255,255,.24); color:#FAFAFA; }
.v404-ghost:hover, .v404-ghost:focus-visible{ background:rgba(255,255,255,.05); border-color:#FAFAFA; color:#FAFAFA; }

@media (max-width:560px){
  .v404-actions{ gap:10px; }
  .v404-btn{ min-height:44px; padding:6px 16px; font-size:15px; flex:1 1 auto; }
}

.v404-in{ animation:v404-rise .52s cubic-bezier(.22,1,.36,1) both; }
.v404-d1{ animation-delay:60ms; }
.v404-d2{ animation-delay:120ms; }
.v404-d3{ animation-delay:180ms; }
.v404-d4{ animation-delay:240ms; }
@keyframes v404-rise{ from{ opacity:0; transform:translateY(12px); } to{ opacity:1; transform:none; } }

@media (prefers-reduced-motion: reduce){
  .v404-in{ animation:none !important; opacity:1; transform:none; }
  .v404-btn{ transition:none; }
  .v404-btn:active{ transform:none; }
  .v404-cta::before{ content:none; }
  .v404-cta:hover{ background:#E4E4E7; border-color:#E4E4E7; color:#0A0A0B; }
}
`;
