import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PageTransition } from "../components/page-transition";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE = "https://www.sansxel.ai";

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: {
    default: "sansxel — Ambient AI Workspace Memory",
    template: "%s | sansxel",
  },
  description:
    "sansxel is an ambient AI workspace that turns your desktop activity into calm, searchable memory. Personal AI plans starting free — scale to Pro, Teams, and Enterprise.",
  keywords: [
    "sansxel",
    "sansxel ai",
    "ambient AI",
    "AI workspace",
    "desktop memory",
    "AI memory app",
    "personal AI assistant",
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
    title: "sansxel — Ambient AI Workspace Memory",
    description:
      "An ambient AI workspace that turns your desktop activity into calm, searchable memory. Free to start.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "sansxel" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "sansxel — Ambient AI Workspace Memory",
    description:
      "An ambient AI workspace that turns your desktop activity into calm, searchable memory.",
    images: ["/og-image.png"],
    creator: "@sansxel",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
  },
  icons: {
    apple: "/icon.png",
    icon: "/icon.png",
    shortcut: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
                "sansxel is an ambient AI workspace that turns desktop activity into calm, searchable memory.",
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
        <PageTransition>{children}</PageTransition>
      </body>
    </html>
  );
}
