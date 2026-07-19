import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Inter_Tight } from "next/font/google";
import "./globals.css";

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});
import { auth } from "../auth";
import { CommandPalette } from "../components/command-palette";
import { CopilotBar } from "../components/copilot-bar";
import { RevealOnScroll } from "../components/reveal-on-scroll";
import { InflightBackToChat } from "../components/inflight-back-to-chat";
import { isVraelisRequest } from "../lib/site-host";

const BASE = "https://www.vraelis.com";

const sansxelMetadata: Metadata = {
  metadataBase: new URL(BASE),
  title: {
    default: "Vraelis, AI with persistent project memory",
    template: "%s | Vraelis",
  },
  description:
    "Stop re-explaining yourself to AI. Every chatbot forgets you between sessions. Vraelis remembers your projects, your context, your goals. Every session picks up where the last one left off.",
  keywords: [
    "Vraelis",
    "Vraelis ai",
    "ai with memory",
    "persistent memory ai",
    "ai project memory",
    "ai workshop",
    "ai for makers",
    "ai for indie devs",
    "ai for creators",
    "ai chat with voice",
    "ai with web search",
    "multimodal ai",
  ],
  authors: [{ name: "Vraelis", url: BASE }],
  creator: "Vraelis",
  publisher: "Vraelis",
  alternates: { canonical: BASE },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: BASE,
    siteName: "Vraelis",
    title: "Stop re-explaining yourself to AI.",
    description:
      "Every chatbot forgets you between sessions. Vraelis remembers your projects, your context, your goals. Every session picks up where the last one left off.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Vraelis" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Stop re-explaining yourself to AI.",
    description:
      "Vraelis remembers your projects, context, and goals. Every session picks up where the last one left off.",
    images: ["/og-image.png"],
    creator: "@vraelis",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
  },
  // Note: app/icon.png and app/apple-icon.png are auto-detected by
  // Next.js 16 and served at hashed URLs (e.g. /icon?abc123) so the
  // browser cache busts on every change. Manually overriding `icons`
  // here forces a non-hashed /icon.png path and breaks that, leave
  // it unset and let the file convention do its job.
};

// Vraelis is a separate brand served from this same project (split by
// host in proxy.ts). Its metadata must NOT inherit the sansxel title
// template / OG, so it's resolved per request.
const vraelisMetadata: Metadata = {
  metadataBase: new URL("https://vraelis.com"),
  title: {
    default: "Vraelis",
    template: "%s | Vraelis",
  },
  description:
    "Vraelis validates how AI-built systems behave before production. It turns production requirements into executable checks, runs them against exact builds and environments, and captures the evidence teams need before they ship. Web and API verification are live.",
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
    title: "AI can build it. Vraelis proves it works.",
    description: "AI can build it. That is not proof it works in production. Vraelis takes the behavior a system is required to hold, runs it against the exact build in a real environment, and returns one truthful decision backed by evidence. Web and API verification are live.",
  },
  twitter: {
    card: "summary",
    title: "AI can build it. Vraelis proves it works.",
    description: "AI can build it. That is not proof it works in production. Vraelis runs the behavior a system is required to hold against the exact build, and returns one truthful decision backed by evidence. Web and API live.",
  },
  robots: { index: true, follow: true },
};

export async function generateMetadata(): Promise<Metadata> {
  return (await isVraelisRequest()) ? vraelisMetadata : sansxelMetadata;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [session, vraelis] = await Promise.all([auth(), isVraelisRequest()]);
  const signedIn = Boolean(session?.user?.email);

  // Vraelis owns its own light theme + chrome (nav/footer come from the
  // (vraelis) layout). Render a minimal shell with no sansxel overlays,
  // no dark body bg, and no sansxel JSON-LD so its stylesheet controls
  // the page entirely.
  if (vraelis) {
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
          <link rel="stylesheet" href="/vraelis/styles.css?v=50" />
          {children}
        </body>
      </html>
    );
  }

  return (
    <html
      lang="en"
      data-theme="dark"
      style={{ colorScheme: "dark" }}
      className={`${GeistSans.variable} ${GeistMono.variable} ${interTight.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-neutral-100">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Vraelis",
              url: "https://www.vraelis.com",
              applicationCategory: "ProductivityApplication",
              operatingSystem: "Windows, macOS",
              description:
                "AI with persistent project memory. Vraelis remembers your projects, context, and goals; every session picks up where the last one left off. Chat, voice, drag-drop, image generation, live web search, all in one workspace.",
              offers: {
                "@type": "AggregateOffer",
                lowPrice: "0",
                highPrice: "500",
                priceCurrency: "USD",
                offerCount: "6",
              },
              creator: {
                "@type": "Organization",
                name: "Vraelis",
                url: "https://www.vraelis.com",
              },
            }),
          }}
        />
        {children}
        <InflightBackToChat />
        <CommandPalette />
        <CopilotBar signedIn={signedIn} />
        <RevealOnScroll />
      </body>
    </html>
  );
}
