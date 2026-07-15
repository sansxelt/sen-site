import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { humanEvalEnabled } from "@/lib/v-entitlements";

// The evaluator supply side (human evaluation / creative candidate voting) is RETIRED positioning and stays
// hidden unless VRAELIS_HUMAN_EVAL is explicitly on. Do NOT advertise the retired product in metadata: when
// the surface is off (the default + current production state), a crawler/social scraper of /vote must not see
// "Evaluate & Earn / earn credits for judgments" in the <head>. Keep the title neutral + noindex so no
// retired positioning is indexed or previewed. Only when the flag is on does the real page metadata apply
// (set per-page below the layout).
export const metadata: Metadata = {
  title: "Vraelis",
  robots: { index: false, follow: false },
};

export default function VoteLayout({ children }: { children: ReactNode }) {
  // Retired: the whole voting surface redirects home unless the flag is explicitly enabled.
  if (!humanEvalEnabled()) redirect("/");
  return children;
}
