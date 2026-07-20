import type { Metadata } from "next";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { VraelisShell } from "./_components/vraelis-ui";
import { AnalyticsScripts } from "./_components/analytics-scripts";

// Vraelis zone layout. Loads the standalone vraelis stylesheets (kept
// as plain CSS under /public/vraelis so they bypass the sansxel
// Tailwind pipeline) and wraps every vraelis route in the shared
// nav/footer shell. Session is read here once and handed to the
// client nav so signed-in users see their account link.
// RETIRED SURFACE. This describes a product Vraelis no longer is. The routes stay alive so existing links
// and stored data keep working, but they must not compete with the current product in search results or in
// a link preview, so everything under here is noindexed. robots.txt disallows the path as well; this tag is
// what keeps an already-indexed URL out, since a disallowed page can still be indexed from inbound links.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function VraelisLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);

  // The vraelis stylesheets are loaded once in the root layout's vraelis
  // branch (so /signin + /account get them too); here we just add the
  // nav/footer shell around the page content.
  return (
    <>
      <AnalyticsScripts />
      <VraelisShell signedIn={signedIn}>{children}</VraelisShell>
    </>
  );
}
