import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
// THE ORDER OF THESE SIX IS PART OF THE CASCADE. nav.css, docs.css, changelog.css and legal.css were cut out
// of v6.css and pagekit.css (2026-10-02) so each surface can be rebuilt in its own file, and their rules still
// override the system and the page kit at equal specificity exactly as they did in place. Keep v6.css first,
// nav.css right after it, then the page kit, then the docs, the changelog and the legal pages. (The served
// layout chunk puts the client components' sheets, close.css and language-switcher.css, ahead of all six.)
import "./_system/v6.css";
import "./_system/nav.css";
import "./_system/pagekit.css";
import "./_system/page-entrance.css";
import "./_system/docs.css";
import "./_system/changelog.css";
import "./_system/legal.css";
import "./_system/picture-plate.css";
import { V6Shell } from "./_system/shell";
import { EntryNavigation } from "./_system/entry-navigation";
import { auth } from "@/auth";
import { V6_ORIGIN } from "./_system/meta";
import { META_TITLE, META_DESCRIPTION, OG_TITLE } from "./_system/positioning";
import { socialCard } from "@/lib/social-card";
import { robotsMeta } from "@/lib/stealth";

const v6Public = process.env.NEXT_PUBLIC_VRAELIS_V6_PUBLIC === "1";

// Root metadata for the design-06 public rebuild. Every positioning string here is imported, not written in
// place: the positioning was locked on 2026-09-28, and changing it must still be one edit in
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
    "physical systems", "control software", "task reports", "robotics software",
    "defense software", "infrastructure software", "recorded evidence",
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
  // this stops the meta tag itself from saying something untrue. The stealth veto lives in robotsMeta, not
  // here: writing it out a second time is how the per-page helper came to disagree with this layout.
  robots: robotsMeta(v6Public),
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
  return (
    <>
      {/* CONTENT THAT DOES NOT DEPEND ON SCRIPTING HAVING RUN.
          Reach's seven surfaces default to opacity:0 and are released by a data attribute React sets after
          an observer fires, so with scripting off the chapter keeps its headline and three bare labels and
          loses everything underneath them. chapters.css answers this with @media (scripting: none), which is
          the right declaration and is not supported everywhere; this is the mechanism that is. Both are
          inert while scripting runs -- verified: with JS on, (scripting: none) does not match and the
          figures stay at opacity 0 until the reveal releases them. */}
      <noscript>
        <style>{".v6-rx__f{opacity:1;transform:none}.v6-tm__exits .v6-tm__ex{opacity:1}"}</style>
      </noscript>
      <EntryNavigation authed={!!session?.user?.email}>
        <V6Shell authed={!!session?.user?.email}>{children}</V6Shell>
      </EntryNavigation>
    </>
  );
}
