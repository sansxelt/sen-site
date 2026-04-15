import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
    default: "sansxel — From Thought to Thing",
    template: "%s | sansxel",
  },
  description:
    "sansxel is the universal AI that materializes your ideas into polished, visual outputs. Bring anything — get something better back. Free to start.",
  keywords: [
    "sansxel",
    "sansxel ai",
    "AI materializer",
    "visual AI",
    "AI output",
    "AI workspace",
    "AI productivity",
    "idea to output",
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
    title: "sansxel — From Thought to Thing",
    description:
      "The universal AI that materializes your ideas into polished, visual outputs. Bring anything — get something better back.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "sansxel" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "sansxel — From Thought to Thing",
    description:
      "The universal AI that materializes your ideas into polished, visual outputs. Bring anything — get something better back.",
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
                "sansxel is the universal AI that materializes ideas into polished, visual outputs.",
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
      </body>
    </html>
  );
}
