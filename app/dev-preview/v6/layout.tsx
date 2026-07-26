import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./_system/v6.css";
import "./_system/pagekit.css";
import { V6Shell } from "./_system/shell";
import { auth } from "@/auth";
import { V6_ORIGIN } from "./_system/meta";
import { META_TITLE, META_DESCRIPTION, OG_TITLE } from "./_system/positioning";
import { socialCard } from "@/lib/social-card";

// Root metadata for the design-06 public rebuild. Every positioning string here is imported, not written in
// place: the company category is still being decided, and changing it must be one edit in
// _system/positioning.ts rather than a sweep across the site. Preview routes stay noindex; the values are
// real so the Discord / Slack / X / LinkedIn / browser previews can be inspected and approved.
export const metadata: Metadata = {
  metadataBase: new URL(V6_ORIGIN),
  title: {
    default: META_TITLE,
    template: "%s | Vraelis",
  },
  description: META_DESCRIPTION,
  applicationName: "Vraelis",
  category: "technology",
  keywords: [
    "AI agents", "AI-built software", "software agents", "agent supervision",
    "code review for AI", "AI software", "agent reliability", "verification",
  ],
  authors: [{ name: "Vraelis" }],
  creator: "Vraelis",
  publisher: "Vraelis",
  robots: { index: false, follow: false },
  alternates: { canonical: `${V6_ORIGIN}/` },
  ...socialCard(OG_TITLE),
  openGraph: {
    ...socialCard(OG_TITLE).openGraph,
    type: "website",
    url: `${V6_ORIGIN}/`,
  },
};

// dark, because the first thing every v6 route paints is a near-black chapter. With colorScheme light the
// browser painted its light default for a frame before the stylesheet applied, which showed as a white flash
// on load.
export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0A0A0B" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0B" },
  ],
};

// The session is resolved HERE, on the server, and handed to the shell as one boolean. The shell is a
// client component and cannot read it, which is why the bar previously offered "Sign in" to readers who
// were already signed in, on a page telling them so.
export default async function V6Layout({ children }: { children: ReactNode }) {
  const session = await auth();
  return <V6Shell authed={!!session?.user?.email}>{children}</V6Shell>;
}
