import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

import { cookies, headers } from "next/headers";
import { stealthConfigured, robotsMeta, verifyStealthCookie, STEALTH_COOKIE } from "../lib/stealth";
import { StealthScreen } from "./_components/stealth-screen";
import { socialCard } from "../lib/social-card";
import { entityJsonLd } from "../lib/entity";
import { GROUND_CSS, type Ground } from "../lib/v6-routes";
import { GROUND_HEADER } from "../proxy";
import { SpeedInsights } from "@vercel/speed-insights/next";

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
const CARD = socialCard("AI says it is done. Vraelis proves it.");

const vraelisMetadata: Metadata = {
  metadataBase: new URL("https://vraelis.com"),
  title: {
    default: "Vraelis",
    template: "%s | Vraelis",
  },
  description:
    "Verifies software built with AI actually works. Give Vraelis a deployed app and the outcome that should be true, and it independently checks the live result in a real browser, then returns the evidence behind its decision. Starting with deployed web applications.",
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
  // In stealth the only page that exists is the curtain, so tell crawlers not to index it. Otherwise the
  // first thing search engines learn about the domain is a page that says nothing, and that impression
  // outlives the launch.
  if (stealthConfigured()) {
    return {
      title: "Vraelis",
      description: "Vraelis is in stealth.",
      robots: { index: false, follow: false },
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
  const ground: Ground = g === "graphite" || g === "paper" ? g : "cream";

  if (stealthConfigured() && !verifyStealthCookie((await cookies()).get(STEALTH_COOKIE)?.value)) {
    return (
      // The curtain is graphite, so the canvas is painted graphite too. Left cream, the overscroll gutter
      // and the strip below a short viewport flashed warm paper around a near-black screen.
      <html lang="en" data-theme="dark" style={{ colorScheme: "dark", background: "#0A0A0B" }} className={`${GeistSans.variable} ${GeistMono.variable} h-full`}>
        <body className="min-h-full" style={{ background: "#0A0A0B" }}>
          <link rel="stylesheet" href="/vraelis/tokens.css?v=20" />
          <link rel="stylesheet" href="/vraelis/styles.css?v=53" />
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
        className={`${GeistSans.variable} ${GeistMono.variable} h-full`}
      >
        <body className="min-h-full" style={{ background: GROUND_CSS[ground].bg }}>
          {/* The public stylesheets load for every request. They define the LIGHT half of the brand; the
              product and the auth round-trip load public/vraelis/authenticated.css on top of these and
              resolve the same token names to graphite (see app/_components/product-surface.tsx). tokens
              before styles. */}
          {/* Display + body render in Geist (self-hosted via next/font, so no
              external font fetch and nothing to fail at load). tokens.css still
              pulls JetBrains Mono + Instrument Serif from Google for code/accents. */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          {/* ?v bust: bump on every CSS change so browsers don't serve a
              stale cached stylesheet (the static file URL is otherwise fixed). */}
          <link rel="stylesheet" href="/vraelis/tokens.css?v=20" />
          <link rel="stylesheet" href="/vraelis/styles.css?v=53" />
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
              product on it, and measuring it would report the curtain's numbers as the site's. */}
          <SpeedInsights />
        </body>
      </html>
  );
}

