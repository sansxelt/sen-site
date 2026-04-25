import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { auth } from "../auth";
import { CommandPalette } from "../components/command-palette";
import { CopilotBar } from "../components/copilot-bar";
import { RevealOnScroll } from "../components/reveal-on-scroll";

const BASE = "https://www.sansxel.ai";

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: {
    default: "sansxel - Build something REAL.",
    template: "%s | sansxel",
  },
  description:
    "sansxel is an adaptive AI platform with a contextual interface that reshapes itself around how you actually work. Build something REAL.",
  keywords: [
    "sansxel",
    "sansxel ai",
    "adaptive ai",
    "contextual ui",
    "ai platform",
    "ai interface",
    "ai for developers",
    "ai for writers",
    "ai for students",
    "AI productivity",
  ],
  authors: [{ name: "sansxel", url: BASE }],
  creator: "sansxel",
  publisher: "sansxel",
  alternates: { canonical: BASE },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: BASE,
    siteName: "sansxel",
    title: "sansxel - Build something REAL.",
    description:
      "The adaptive AI platform. One AI, infinite shapes — a contextual interface that reshapes itself around how you actually work.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "sansxel" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "sansxel - Build something REAL.",
    description:
      "The adaptive AI platform. One AI, infinite shapes — a contextual interface that reshapes itself around how you actually work.",
    images: ["/og-image.png"],
    creator: "@sansxel",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
  },
  // Note: app/icon.png and app/apple-icon.png are auto-detected by
  // Next.js 16 and served at hashed URLs (e.g. /icon?abc123) so the
  // browser cache busts on every change. Manually overriding `icons`
  // here forces a non-hashed /icon.png path and breaks that — leave
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
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-neutral-950 font-sans text-neutral-100">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "sansxel",
              url: "https://www.sansxel.ai",
              applicationCategory: "ProductivityApplication",
              operatingSystem: "Windows, macOS",
              description:
                "sansxel is an adaptive AI platform with a contextual interface that reshapes itself around how you actually work.",
              offers: {
                "@type": "AggregateOffer",
                lowPrice: "0",
                highPrice: "500",
                priceCurrency: "USD",
                offerCount: "6",
              },
              creator: {
                "@type": "Organization",
                name: "sansxel",
                url: "https://www.sansxel.ai",
              },
            }),
          }}
        />
        {children}
        <CommandPalette />
        <CopilotBar signedIn={signedIn} />
        <RevealOnScroll />
      </body>
    </html>
  );
}
