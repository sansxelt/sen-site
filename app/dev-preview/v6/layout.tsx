import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./_system/v6.css";
import "./_system/pagekit.css";
import { V6Shell } from "./_system/shell";
import { auth } from "@/auth";
import { V6_ORIGIN } from "./_system/meta";
import { META_TITLE, META_DESCRIPTION, OG_TITLE } from "./_system/positioning";
import { socialCard } from "@/lib/social-card";
import { stealthConfigured } from "@/lib/stealth";

const v6Public = process.env.NEXT_PUBLIC_VRAELIS_V6_PUBLIC === "1";

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
  // INDEXABLE ONLY WHEN PROMOTED. While V6 serves from /dev-preview/v6 it must stay out of the index: a
  // preview competing with the live site for the same queries is worse than either alone. Promoted, it IS
  // the live site, and a noindex would quietly remove the company from search the moment the flag flipped.
  // Same variable as the routing, so the two can never disagree about which site is public.
  // AND NOT WHILE THE CURTAIN IS DOWN. This flipped on the promotion flag alone, and because nested
  // segment metadata wins in Next, it overrode the root layout's stealth noindex: every page told crawlers
  // to index a document whose entire body was "Not open yet." The header set in proxy.ts is the catch-all;
  // this stops the meta tag itself from saying something untrue.
  robots: v6Public && !stealthConfigured()
    ? { index: true, follow: true }
    : { index: false, follow: false },
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
