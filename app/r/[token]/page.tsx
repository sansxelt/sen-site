import type { Metadata } from "next";
import { redirect } from "next/navigation";

// Public shared-report viewer for the RETIRED human-evaluation product (voting reports with per-judgment
// results and a recommended winner). The current Vraelis product does not share via /r/ — those links came
// only from the retired tests/legacy-checks surfaces. Rather than render retired positioning to the public
// (and leak it into social previews), any /r/<token> link now redirects to the current product story.
// Existing bookmarked links resolve cleanly instead of showing a retired report. noindex, and the neutral
// on-brand social card is served for any scrape (see app/og/r/route.tsx).
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Vraelis",
    description: "Production validation for AI-built systems.",
    robots: { index: false, follow: false },
    openGraph: { title: "Vraelis", description: "Production validation for AI-built systems.", images: ["https://vraelis.com/og/r"] },
    twitter: { card: "summary_large_image", title: "Vraelis", description: "Production validation for AI-built systems.", images: ["https://vraelis.com/og/r"] },
  };
}

export default function PublicReportRedirect() {
  redirect("/how-it-works");
}
