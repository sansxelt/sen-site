import type { ReactNode } from "react";
import { auth } from "@/auth";
import { VraelisShell } from "./_components/vraelis-ui";
import { AnalyticsScripts } from "./_components/analytics-scripts";

// Vraelis zone layout. Loads the standalone vraelis stylesheets (kept
// as plain CSS under /public/vraelis so they bypass the sansxel
// Tailwind pipeline) and wraps every vraelis route in the shared
// nav/footer shell. Session is read here once and handed to the
// client nav so signed-in users see their account link.
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
