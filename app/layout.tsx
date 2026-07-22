import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

import { cookies } from "next/headers";
import { stealthConfigured, verifyStealthCookie, STEALTH_COOKIE } from "../lib/stealth";
import { StealthScreen } from "./_components/stealth-screen";

// There used to be a second brand here (an AI-memory chatbot) with its own metadata and JSON-LD, selected
// per request. isVraelisRequest() has returned a constant true for a long time, so none of it was ever
// served: it was unreachable code that described a different company under this name. Removed rather than
// rewritten, because dead metadata is a landmine that only goes off when someone flips a flag and
// accidentally tells search engines Vraelis is a chatbot.
//
// Note: app/icon.png and app/apple-icon.png are auto-detected by Next.js 16 and served at hashed URLs
// (e.g. /icon?abc123) so the browser cache busts on every change. Manually overriding `icons` here would
// force a non-hashed path and break that; leave it unset and let the file convention do its job.
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
  // No og:image on the homepage on purpose: LinkedIn hard-caches a domain's OG image and would not let
  // go of a stale headline render across several ?v bumps. A text-only card (title + description + url)
  // sidesteps that entirely and always shows the current copy. The dynamic /og card still exists for
  // pages/surfaces that want it; the homepage just does not advertise one.
  openGraph: {
    type: "website",
    url: "https://vraelis.com",
    siteName: "Vraelis",
    title: "AI says it is done. Vraelis proves it.",
    description: "Verifies software built with AI actually works. Give Vraelis a deployed app and the outcome that should be true, and it independently checks the live result in a real browser, then returns the evidence behind its decision. Starting with deployed web applications.",
  },
  twitter: {
    card: "summary",
    title: "AI says it is done. Vraelis proves it.",
    description: "Verifies software built with AI actually works. Give Vraelis a deployed app and the outcome that should be true, and it independently checks the live result in a real browser, then returns the evidence behind its decision. Starting with deployed web applications.",
  },
  robots: { index: true, follow: true },
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
  if (stealthConfigured() && !verifyStealthCookie((await cookies()).get(STEALTH_COOKIE)?.value)) {
    return (
      <html lang="en" data-theme="light" style={{ colorScheme: "light", background: "#FAF8F4" }} className={`${GeistSans.variable} ${GeistMono.variable} h-full`}>
        <body className="min-h-full" style={{ background: "#FAF8F4" }}>
          <link rel="stylesheet" href="/vraelis/tokens.css?v=20" />
          <link rel="stylesheet" href="/vraelis/styles.css?v=51" />
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
        data-theme="light"
        // Paint the warm-paper floor (--bg-0) inline so the canvas is cream from the
        // first frame. The Vraelis palette is set by external stylesheets loaded below
        // (and a legacy dark tokens.css loads first), so without this the bare canvas
        // flashes dark on every navigation (the site uses <a href> full reloads).
        style={{ colorScheme: "light", background: "#FAF8F4" }}
        className={`${GeistSans.variable} ${GeistMono.variable} h-full`}
      >
        <body className="min-h-full" style={{ background: "#FAF8F4" }}>
          {/* Vraelis stylesheets load for every vraelis request (marketing
              pages AND the shared /signin, /account flows) so the whole
              brand renders light + green. tokens before styles. */}
          {/* Display + body render in Geist (self-hosted via next/font, so no
              external font fetch and nothing to fail at load). tokens.css still
              pulls JetBrains Mono + Instrument Serif from Google for code/accents. */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          {/* ?v bust: bump on every CSS change so browsers don't serve a
              stale cached stylesheet (the static file URL is otherwise fixed). */}
          <link rel="stylesheet" href="/vraelis/tokens.css?v=20" />
          <link rel="stylesheet" href="/vraelis/styles.css?v=51" />
          {children}
        </body>
      </html>
  );
}

