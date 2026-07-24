import type { Metadata } from "next";
import type { ReactNode } from "react";
// The shared public-site system stylesheet (scoped under .sv1) and the one shell used by every site-v1 route.
import "./_system/system.css";
import { PublicShell } from "./_system/shell";

// Not indexable: an in-progress rebuild of the Vraelis public website as one coherent, white-first system in a
// preview namespace. The live site and the authenticated app are untouched; nothing here is merged.
export const metadata: Metadata = {
  title: "Vraelis, public-site system (site-v1)",
  robots: { index: false, follow: false },
};

export default function SiteV1Layout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
