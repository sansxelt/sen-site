import type { Metadata } from "next";
import { redirect } from "next/navigation";

// Public shared-report viewer for the RETIRED AI-output-checker product ("AI output check", per-criterion
// scores, the version to ship). The current Vraelis product does not share via /r/c/ — those links came only
// from the retired checker. Rather than render retired positioning to the public (and leak it into social
// previews), any /r/c/<token> link now redirects to the current product story. Existing bookmarked links
// resolve cleanly instead of showing a retired check report. noindex; neutral on-brand preview.
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Vraelis",
    description: "Production validation for AI-built systems.",
    robots: { index: false, follow: false },
    openGraph: { title: "Vraelis", description: "Production validation for AI-built systems.", images: ["https://vraelis.com/og?v=4"] },
    twitter: { card: "summary_large_image", title: "Vraelis", description: "Production validation for AI-built systems.", images: ["https://vraelis.com/og?v=4"] },
  };
}

export default function SharedCheckRedirect() {
  redirect("/how-it-works");
}
