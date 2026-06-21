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
    default: "Vraelis — test generated content with real users",
    template: "%s",
  },
  description:
    "Vraelis is a feedback network for AI apps and creative teams. Test generated options with real users, get clear reports on what wins, and turn feedback into revenue.",
  alternates: { canonical: "https://vraelis.com" },
  icons: { icon: "/vraelis/mark.jpg" },
  openGraph: {
    type: "website",
    url: "https://vraelis.com",
    siteName: "Vraelis",
    title: "Test generated content with real users",
    description: "Real people vote on your creative options. Vraelis tells you what wins before you launch.",
    images: [{ url: "/og", width: 1200, height: 630, alt: "Vraelis" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Test generated content with real users",
    description: "Real people vote on your creative options. Vraelis tells you what wins before you launch.",
    images: ["/og"],
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
        style={{ colorScheme: "light" }}
        className={`${GeistSans.variable} ${GeistMono.variable} h-full`}
      >
        <body className="min-h-full">
          {/* Vraelis stylesheets load for every vraelis request (marketing
              pages AND the shared /signin, /account flows) so the whole
              brand renders light + green. tokens before styles. */}
          {/* The brand's display/body faces (Bricolage Grotesque + Hanken
              Grotesk) — load them so styles.css's --font-display/--font-sans
              actually render instead of falling back to a system sans. */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..700&family=Hanken+Grotesk:wght@400;500;600;700&display=swap" />
          {/* ?v bust: bump on every CSS change so browsers don't serve a
              stale cached stylesheet (the static file URL is otherwise fixed). */}
          <link rel="stylesheet" href="/vraelis/tokens.css?v=12" />
          <link rel="stylesheet" href="/vraelis/styles.css?v=12" />
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
