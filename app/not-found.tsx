import Link from "next/link";
import { PUBLIC_HOW_IT_WORKS, GROUND_CSS } from "@/lib/v6-routes";
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
export const metadata: Metadata = { robots: robotsMeta(false) };


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
 * The colour rule holds: nothing here is coloured, because nothing here is a state. A missing page is not a
 * failure the product detected, and dressing it in the red that means "this verification failed" would spend
 * a signal on a typo.
 */
export default function NotFound() {
  const g = GROUND_CSS.graphite;
  return (
    <main className="v404">
      <style>{`html, body { background: ${g.bg} !important; color-scheme: ${g.scheme} !important; }` + NF_CSS}</style>

      <div className="v404-stack">
        <p className="v404-kicker v404-in v404-d1">Vraelis</p>

        {/* One h1 carrying the whole meaning. The numeral is decorative and hidden from assistive tech, so
            a screen reader hears the sentence rather than "four zero four" followed by it. */}
        <h1 className="v404-head v404-in v404-d2">This page does not exist.</h1>

        <p className="v404-body v404-in v404-d3">
          The link you followed is wrong, or it points at something Vraelis no longer has. Nothing is broken.
        </p>

        <div className="v404-actions v404-in v404-d4">
          <Link href="/" className="v404-cta">Back to Vraelis</Link>
          <Link href={PUBLIC_HOW_IT_WORKS} className="v404-link">See how it works</Link>
        </div>
      </div>

      <span className="v404-num" aria-hidden>404</span>
    </main>
  );
}

const NF_CSS = `
/* Design 06, written out. This page renders from the ROOT layout, which never loads the v6 stylesheet, so
   the values are restated here the same way the stealth curtain restates them. Keep in step by hand. */
.v404{
  position:relative; min-height:100svh;
  display:flex; align-items:center; justify-content:center;
  overflow:hidden; isolation:isolate;
  padding:clamp(40px,8vw,96px) clamp(20px,5vw,64px);
  background:#0A0A0B; color:#C4C5C9;
}

/* Left-set, like every other design 06 opening. The numeral sits behind the text as a quiet mark of scale
   rather than as the headline: the sentence is the message, and a giant numeral competing with it is what
   made the old page read as decoration first. */
.v404-stack{ position:relative; z-index:1; width:100%; max-width:640px; }

.v404-kicker{
  margin:0 0 18px; font-size:13px; font-weight:500;
  letter-spacing:.14em; text-transform:uppercase; color:#8E9095;
}
.v404-head{
  margin:0; font-weight:600; letter-spacing:-.032em; line-height:1.02;
  font-size:clamp(2.3rem,4.6vw,3.6rem); color:#FAFAFA; text-wrap:balance;
}
.v404-body{
  margin:20px 0 0; max-width:52ch;
  font-size:clamp(1rem,1.2vw,1.08rem); line-height:1.6; color:#C4C5C9; text-wrap:pretty;
}

.v404-actions{ display:flex; flex-wrap:wrap; align-items:center; gap:22px; margin-top:34px; }
/* Contrast, not hue: the primary action is white on graphite, the way it is everywhere else now. */
.v404-cta{
  display:inline-flex; align-items:center; justify-content:center;
  background:#FAFAFA; color:#0A0A0B; text-decoration:none;
  font-size:15px; font-weight:550; letter-spacing:-.01em;
  padding:12px 22px; border-radius:11px;
  transition:background 140ms cubic-bezier(0,0,.2,1);
}
.v404-cta:hover{ background:#FFFFFF; }
.v404-link{
  font-size:14.5px; color:#C4C5C9; text-decoration:none;
  border-bottom:1px solid rgba(255,255,255,.22); padding-bottom:2px;
  transition:color 140ms ease, border-color 140ms ease;
}
.v404-link:hover{ color:#FAFAFA; border-color:rgba(255,255,255,.5); }

/* The numeral, as a watermark. Sized off the viewport and clipped by the page, so it reads as scale rather
   than as content. Hidden from assistive tech; the h1 already says it. */
.v404-num{
  position:absolute; z-index:0; pointer-events:none; user-select:none;
  right:clamp(-28px,-2vw,0px); bottom:clamp(-40px,-4vw,-12px);
  font-weight:600; letter-spacing:-.06em; line-height:.75;
  font-size:clamp(11rem,34vw,30rem);
  color:rgba(255,255,255,.038);
}
@media (max-width:760px){ .v404-num{ right:auto; left:50%; transform:translateX(-50%); bottom:-6vh; } }

.v404-in{ animation:v404-rise .58s cubic-bezier(.22,1,.36,1) both; }
.v404-d1{ animation-delay:60ms; }
.v404-d2{ animation-delay:130ms; }
.v404-d3{ animation-delay:200ms; }
.v404-d4{ animation-delay:270ms; }
@keyframes v404-rise{ from{ opacity:0; transform:translateY(12px); } to{ opacity:1; transform:none; } }

@media (prefers-reduced-motion: reduce){
  .v404-in{ animation:none !important; opacity:1; transform:none; }
}
`;
