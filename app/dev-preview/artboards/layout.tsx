import type { Metadata } from "next";
import type { ReactNode } from "react";
// Static art-direction gallery. No shell, no scroll narrative, no motion beyond CSS hover. The visual
// language must carry the quality as a still. Not indexed; the live site and app are untouched.
import "./_art/artboards.css";

export const metadata: Metadata = {
  title: "Vraelis, art-direction artboards",
  robots: { index: false, follow: false },
};

export default function ArtboardsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
