import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./_system/v6.css";
import "./_system/pagekit.css";
import { V6Shell } from "./_system/shell";
import { V6_ORIGIN } from "./_system/meta";

// Root metadata for the design-06 public rebuild. This is the "embed" replacement: the site is now framed as
// oversight for AI software agents, not deployment verification. Preview routes are noindex; the values are
// still real so the Discord / Slack / X / LinkedIn / browser previews can be inspected and approved.
export const metadata: Metadata = {
  metadataBase: new URL(V6_ORIGIN),
  title: {
    default: "Vraelis | Oversight for AI software agents",
    template: "%s | Vraelis",
  },
  description:
    "Vraelis follows AI software agents from assigned responsibility to trusted completion, surfacing uncertainty, evidence, decisions, repairs, and what the company learns.",
  applicationName: "Vraelis",
  category: "technology",
  keywords: [
    "AI agents", "AI oversight", "software agents", "agent supervision",
    "trusted completion", "AI software", "agent reliability", "verification",
  ],
  authors: [{ name: "Vraelis" }],
  creator: "Vraelis",
  publisher: "Vraelis",
  robots: { index: false, follow: false },
  alternates: { canonical: `${V6_ORIGIN}/` },
  openGraph: {
    type: "website",
    siteName: "Vraelis",
    url: `${V6_ORIGIN}/`,
    title: "Give AI agents responsibility without giving up control.",
    description:
      "Vraelis provides independent oversight for AI software work across planning, execution, review, repair, and trusted completion.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Give AI agents responsibility without giving up control.",
    description:
      "Vraelis provides independent oversight for AI software work across planning, execution, review, repair, and trusted completion.",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F7F4" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1319" },
  ],
};

export default function V6Layout({ children }: { children: ReactNode }) {
  return <V6Shell>{children}</V6Shell>;
}
