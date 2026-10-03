import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

import { cookies, headers } from "next/headers";
import { stealthConfigured, robotsMeta, verifyStealthCookie, STEALTH_COOKIE } from "../lib/stealth";
import { StealthScreen } from "./_components/stealth-screen";
import { socialCard, SOCIAL_TITLE, SOCIAL_DESCRIPTION } from "../lib/social-card";
import { entityJsonLd } from "../lib/entity";
import { META_DESCRIPTION } from "./dev-preview/v6/_system/positioning";
import { GROUND_CSS, type Ground } from "../lib/v6-routes";
import { GROUND_HEADER } from "../proxy";
import { PrivacyChoices } from "./_components/privacy-choices";
import { ConsentedMeasurement } from "./_components/consented-measurement";
import { LanguageController } from "@/components/language-controller";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_PARAM, READY_LOCALES } from "../lib/i18n/locales";
import { OPTIONAL_CATEGORIES, PRIVACY_COOKIE, PRIVACY_COOKIE_VERSION } from "../lib/privacy-choice";

// A PAGE IN ANOTHER LANGUAGE IS PAINTED ONCE IT IS TRANSLATED (2026-10-02). Pages are rendered in English and
// translated in the browser after they hydrate (components/language-controller.tsx). Painted first, the English
// then changed length under the reader: the hero sentence and the pricing plans moved, a layout shift of 0.02 to
// 0.09 on a phone against a budget of 0.01 (the 404 page and sign-in moved too). This script runs before the page
// paints. When the visit is in another language it hides the site's own pages (I18N_GUARDED) with a style element,
// which the controller removes as soon as they are translated, and starts fetching the catalogue, so the wait is as
// short as the hydration allows. The timer is the floor under it: if the controller never gets there (its script
// failed to load, say), the page shows anyway, in English. An English visit is never touched.
// The language is decided exactly as lib/i18n/client.ts readLocale() decides it: ?lang= first, then the remembered
// choice, which counts only where Preferences are allowed and the browser sends no GPC (lib/privacy-choice.ts),
// then English. "vraelis-locale" is LOCALE_STORAGE_KEY in lib/i18n/client.ts. A style element rather than an
// attribute on <html>: React compares <html>'s attributes when it hydrates, and an extra one is a mismatch. Every
// element inside is hidden, not only the outer one, because a few set visibility: visible themselves (the open tab
// panel). The console is not covered: it is out of this site's scope, and it keeps translating in place.
// The marketing shell (app/dev-preview/v6/_system/shell.tsx), the 404 page (app/not-found.tsx) and the sign-in and
// /auth frame (app/_components/auth-frame.tsx). The controller's SHELL is the same list.
const I18N_GUARDED = [".v6", ".v404", ".auth-split"];
const LANGUAGE_FIRST_PAINT = `(function (c) { try {
  var ok = function (v) { return c.ready.indexOf(v) >= 0; };
  var l = new URLSearchParams(location.search).get(c.param);
  if (!ok(l)) {
    l = null;
    var jar = {}, all = document.cookie.split(";");
    for (var i = 0; i < all.length; i++) {
      var eq = all[i].indexOf("=");
      if (eq < 0) continue;
      var n = all[i].slice(0, eq).trim();
      if (!(n in jar)) jar[n] = all[i].slice(eq + 1).trim();
    }
    var p = [];
    try { p = decodeURIComponent(jar[c.privacy] || "").split("."); } catch (e) {}
    var prefs = p[0] === c.version && p.indexOf("preferences") > 0 && navigator.globalPrivacyControl !== true;
    for (var j = 1; j < p.length; j++) if (c.categories.indexOf(p[j]) < 0 || p.indexOf(p[j]) !== j) prefs = false;
    if (prefs) {
      l = jar[c.cookie];
      if (!ok(l)) { try { l = localStorage.getItem(c.store); } catch (e) { l = null; } }
      if (!ok(l)) l = null;
    }
  }
  if (!l || l === c.def) return;
  var s = document.createElement("style");
  s.id = c.id;
  s.textContent = c.css;
  document.head.appendChild(s);
  setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, c.ms);
  window.__vraelisI18n = { locale: l, catalogue: fetch("/locales/" + l + ".json", { cache: "force-cache", priority: "low" })
    .then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }) };
} catch (e) {} })(${JSON.stringify({
  ready: READY_LOCALES, def: DEFAULT_LOCALE, param: LOCALE_PARAM, cookie: LOCALE_COOKIE, store: "vraelis-locale",
  privacy: PRIVACY_COOKIE, version: PRIVACY_COOKIE_VERSION, categories: OPTIONAL_CATEGORIES,
  // The id the controller removes (I18N_GUARD_ID there), the rule it lifts, and the longest the page stays hidden.
  id: "vraelis-i18n-pending", css: `${I18N_GUARDED.map((s) => `${s},${s} *`).join(",")}{visibility:hidden!important}`, ms: 2500,
})});`;

// THE TYPE. IBM Plex Sans for everything people read, IBM Plex Mono for machine text (IDs, URLs, code).
// Replaced Geist, Inter Tight and Instrument Serif on 2026-09-30: that trio is the default look of a generated
// site, and the founder read it as exactly that. Both faces are SIL OFL (app/fonts/OFL.txt), and the Latin
// files are COMMITTED in app/fonts rather than pulled through next/font/google: that loader downloads from
// Google during the build, and a failed download fails the whole production build. Local files cannot.
// Every stylesheet reads the two variables below and nothing names a family directly, so changing the face
// again is an edit to these two calls only.
const brandSans = localFont({
  src: "./fonts/ibm-plex-sans-latin-var.woff2",
  weight: "100 700",
  style: "normal",
  variable: "--font-brand-sans",
  display: "swap",
});
const brandMono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-latin-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-latin-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-mono-latin-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-brand-mono",
  display: "swap",
});

// There used to be a second brand here (an AI-memory chatbot) with its own metadata and JSON-LD, selected
// per request. isVraelisRequest() has returned a constant true for a long time, so none of it was ever
// served: it was unreachable code that described a different company under this name. Removed rather than
// rewritten, because dead metadata is a landmine that only goes off when someone flips a flag and
// accidentally tells search engines Vraelis is a chatbot.
//
// Note: app/icon.png and app/apple-icon.png are auto-detected by Next.js 16 and served at hashed URLs
// (e.g. /icon?abc123) so the browser cache busts on every change. Manually overriding `icons` here would
// force a non-hashed path and break that; leave it unset and let the file convention do its job.
// The one shared link preview, resolved once. socialCard owns the sentence and the image; the only thing
// this surface chooses is its title.
const CARD = socialCard("Say what should work. Vraelis checks it on the live app.");

const vraelisMetadata: Metadata = {
  metadataBase: new URL("https://vraelis.com"),
  title: {
    default: "Vraelis",
    template: "%s | Vraelis",
  },
  // The same description the homepage uses (positioning.ts), so a page without its own metadata does not
  // describe the product in the retired verdict-first wording.
  description: META_DESCRIPTION,
  alternates: { canonical: "https://vraelis.com" },
  // Favicon + apple icon come from app/icon.tsx and app/apple-icon.tsx (the Vraelis mark), auto-detected
  // by Next and served at hashed URLs so the tab icon cache-busts on change. Do NOT set `icons` here —
  // a manual path overrides that convention and pins a stale non-hashed file.
  // THE EMBED COMES FROM ONE PLACE. This block used to write its own, and it was the site-wide fallback, so
  // it set the preview for every page without more specific metadata.
  //
  // Two things were wrong with it. It carried a three-sentence description where every other surface carries
  // one, and it carried NO image at all — deliberately, to escape LinkedIn hard-caching a stale rendered
  // headline card across several ?v bumps. That workaround made sense against artwork with copy baked into
  // it. It stopped making sense once the only embed image became the square Vraelis mark, which says the
  // same thing under every positioning this company will ever have and therefore never goes stale.
  //
  // So the fallback is now the same card as everything else: one sentence, the mark, a small summary. The
  // long description above stays, because that is the page's own meta description and what a search result
  // shows, which is a different job from a link preview.
  ...CARD,
  openGraph: { ...CARD.openGraph, type: "website", url: "https://vraelis.com" },
  robots: robotsMeta(true),
};

export async function generateMetadata(): Promise<Metadata> {
  // THE ONE SENTENCE THE CURTAIN HAS TO CARRY.
  //
  // This described the company as "Vraelis is in stealth." Machine-readably that is the company describing
  // itself as nothing, on the one page the curtain deliberately leaves indexable, while lib/entity.ts
  // publishes the real sentence as JSON-LD in the same document. entity.ts states the rule that breaks: a
  // company that describes itself differently in two machine-readable places has given the machine a reason
  // to prefer its own summary. It did. A search for "vraelis" returns a World of Warcraft character and an
  // indexed /signin still carrying the RETIRED product's headline, because the live site offered nothing to
  // replace it with. Saying nothing was not neutral: it left the stale answer standing as the best one.
  //
  // Same string as the JSON-LD and the link preview, from the one file that owns it, so the three cannot
  // drift. It gives away nothing that the visible curtain does not already say.
  //
  // robots goes through robotsMeta rather than a literal. A hardcoded robots object here is what overrode
  // the homepage exemption, and two places deciding indexing is the defect this repo has now fixed twice.
  if (stealthConfigured()) {
    return {
      title: SOCIAL_TITLE,
      description: SOCIAL_DESCRIPTION,
      robots: robotsMeta(false),
    };
  }
  return vraelisMetadata;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // STEALTH: checked before anything else and returned before `children` is touched, so while the curtain
  // is down the real tree is never rendered and never reaches the browser in any form. Cheap cookie read;
  // no session lookup, no DB. The cookie is HMAC-verified rather than string-compared, so one typed into a
  // cookie editor does not open anything.
  // Which ground this request renders on, resolved by proxy.ts from the route it is serving. Absent (a
  // direct hit that skipped the proxy) falls back to the previous site's cream, which is what every
  // unmapped legacy path is.
  const g = (await headers()).get(GROUND_HEADER);
  const ground: Ground = g === "console" || g === "graphite" || g === "paper" ? g : "cream";

  if (stealthConfigured() && !verifyStealthCookie((await cookies()).get(STEALTH_COOKIE)?.value)) {
    return (
      // The curtain is black, like the rest of the product since 2026-10-01, so the canvas is painted black
      // too; the overscroll gutter and the strip below a short viewport match the screen.
      <html lang="en" data-theme="dark" style={{ colorScheme: "dark", background: "#0A0A0B" }} className={`${brandSans.variable} ${brandMono.variable} h-full`}>
        <body className="min-h-full" style={{ background: "#0A0A0B" }}>
          <link rel="stylesheet" href="/vraelis/tokens.css?v=23" />
          <link rel="stylesheet" href="/vraelis/styles.css?v=57" />
          {/* THE CURTAIN IS THE ONLY THING MOST MACHINES EVER SEE, AND IT SAID NOTHING ABOUT THE COMPANY.
              This branch returned before the JSON-LD below, so every crawler and every AI summariser
              fetching vraelis.com got "Not open yet" and no structured self-description at all. Asked what
              Vraelis is, they answered from their pre-stealth index, which describes the human-evaluation
              product this company retired: "users submit options, collect valid judgments from real
              people". A stale answer beats no answer, so no answer is what has to stop.
              It does NOT change what is indexed. The curtain still sends X-Robots-Tag: noindex, nofollow
              and still shows nothing of the product. This is the one machine-readable sentence saying who
              this is, for anything that reads the page rather than its own cache. */}
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: entityJsonLd() }} />
          <StealthScreen />
        </body>
      </html>
    );
  }

  // One brand, one shell. Vraelis owns its own light theme and chrome (nav/footer come from the route
  // group layouts), so this renders a minimal document and lets the stylesheets control the page. The
  // second, dark shell that used to live below carried JSON-LD describing an AI-memory chatbot and was
  // unreachable; it is gone rather than maintained.
  return (
      <html
        lang="en"
        data-theme={GROUND_CSS[ground].scheme}
        // styles.css sets `scroll-behavior: smooth` on <html> for in-page anchors. Through Next 15
        // that was neutralised during route transitions; Next 16 no longer does it unless this
        // attribute says to (see docs 02-guides/upgrading/version-16, "Scroll Behavior Override").
        // Without it a navigation ANIMATES back to the top instead of arriving there, which reads as
        // the new page sliding around on load and drags the nav's hide-on-scroll through every
        // intermediate position on the way. The attribute restores the instant jump and leaves
        // anchor links smooth.
        data-scroll-behavior="smooth"
        // THE FIRST FRAME. This is the only place early enough to decide what colour the browser paints
        // before it has parsed a single stylesheet, because it is on the opening <html> tag.
        //
        // It used to read a --canvas variable that authenticated.css set. That was too late by construction:
        // a linked stylesheet has not applied when the first frame is painted, so every arrival at a dark
        // surface showed a white frame, and the overscroll gutter past the end of a dark page stayed pale.
        // Screencasting a stalled load made it plain — the first painted frame was pure white.
        //
        // proxy.ts now resolves the ground per request from the route it is about to serve and forwards it
        // here, so <html> carries the right background AND colour scheme immediately. Colour scheme is the
        // half that actually caused the flash: it is what the browser uses for its own canvas, the
        // overscroll region and native controls, all before the page exists.
        style={{ colorScheme: GROUND_CSS[ground].scheme, background: GROUND_CSS[ground].bg }}
        className={`${brandSans.variable} ${brandMono.variable} h-full`}
      >
        <body className="min-h-full" style={{ background: GROUND_CSS[ground].bg }}>
          {/* First in the body, so it has run before any of the page is parsed (LANGUAGE_FIRST_PAINT, above). */}
          <script dangerouslySetInnerHTML={{ __html: LANGUAGE_FIRST_PAINT }} />
          {/* The public stylesheets load for every request. They define the LIGHT half of the brand; the
              product and the auth round-trip load public/vraelis/authenticated.css on top of these and
              resolve the same token names to graphite (see app/_components/product-surface.tsx). tokens
              before styles. */}
          {/* ?v bust: bump on every CSS change so browsers don't serve a
              stale cached stylesheet (the static file URL is otherwise fixed). */}
          <link rel="stylesheet" href="/vraelis/tokens.css?v=23" />
          <link rel="stylesheet" href="/vraelis/styles.css?v=57" />
          {/* WHO THIS IS, for machines. Emitted only when the site is actually public: publishing an
              identity graph on a page whose entire body reads "Not open yet." asks to be indexed as a
              company with no content, which is the impression this document already refuses to leave.
              It is JSON generated from lib/entity, not markup, so nothing here can be injected. */}
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: entityJsonLd() }} />
          {children}
          {/* REAL DEVICES, WHICH IS THE ONLY PLACE THE MOBILE QUESTION GETS SETTLED.
              The homepage motion work was measured on an emulated iPhone viewport, and an emulated
              viewport has a desktop CPU behind it. That is enough to prove what renders and useless for
              proving what a phone can render fast. Speed Insights reports field LCP, CLS and INP from
              the hardware people actually hold.
              Deliberately NOT inside the stealth branch above: the curtain is a static screen with no
              product on it, and measuring it would report the curtain's numbers as the site's.
              ONLY WITH CONSENT (2026-09-30): it loads once the person turns Analytics on in the privacy
              choices, and stops sending the moment they turn it off. See consented-measurement.tsx. */}
          <ConsentedMeasurement />
          {/* THE PRIVACY CHOICES, ONCE, FOR EVERY SURFACE: the site, the docs, sign-in and /auth, and the
              console on app.vraelis.com all render through this branch. Not in the curtain branch above,
              which shows nothing of the product and so has nothing to ask about. A blocking dialog until a
              choice exists, except on the legal pages, which get a bar so they can be read first. */}
          <PrivacyChoices />
          {/* ONE LANGUAGE, EVERYWHERE (2026-09-30): translates the page in the browser from
              public/locales/<code>.json when a language other than English is chosen, on every surface this
              branch renders. See components/language-controller.tsx and lib/i18n/locales.ts. */}
          <LanguageController />
        </body>
      </html>
  );
}

