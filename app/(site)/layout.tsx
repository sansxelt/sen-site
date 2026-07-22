import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteShell } from "@/components/site-shell";

// Defense-in-depth backstop. This entire route group is the RETIRED sansxel "Vraelis AI" generation (glasses,
// voice, workshop, learn) and is redirected home by proxy.ts. Unlike the other retired groups it previously
// had NO robots meta, so it was de-indexed by the redirect alone — one typo in the SANSXEL list away from
// being crawlable. Noindex it at the group layout so a page here can never be indexed even if the redirect is
// bypassed. The whole group is scheduled for removal; this holds the line until then.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
