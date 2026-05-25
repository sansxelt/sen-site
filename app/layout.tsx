import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { auth } from "../auth";
import { CommandPalette } from "../components/command-palette";
import { CopilotBar } from "../components/copilot-bar";
import { RevealOnScroll } from "../components/reveal-on-scroll";
import { InflightBackToChat } from "../components/inflight-back-to-chat";

const BASE = "https://www.vraelis.com";

export const metadata: Metadata = {
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);
  return (
    <html
      lang="en"
      data-theme="dark"
      style={{ colorScheme: "dark" }}
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-neutral-950 font-sans text-neutral-100">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Vraelis",
              url: "https://www.vraelis.ai",
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
                url: "https://www.vraelis.ai",
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
