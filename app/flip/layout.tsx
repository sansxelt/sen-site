import type { Metadata } from "next";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { FlipShell } from "./_components/flip-ui";

// Wraps every flip page in the shared shell (promo bar + nav + footer). The
// vraelis design stylesheets are already loaded by the root layout, so this
// group renders in the same light/green system as the whole site. Session is
// read once here so the nav can show Account vs Sign in.
// RETIRED SURFACE. This describes a product Vraelis no longer is. The routes stay alive so existing links
// and stored data keep working, but they must not compete with the current product in search results or in
// a link preview, so everything under here is noindexed. robots.txt disallows the path as well; this tag is
// what keeps an already-indexed URL out, since a disallowed page can still be indexed from inbound links.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function FlipLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);
  return <FlipShell signedIn={signedIn}>{children}</FlipShell>;
}
