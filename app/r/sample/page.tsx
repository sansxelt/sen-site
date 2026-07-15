import { redirect } from "next/navigation";
import type { Metadata } from "next";

// This was a public sample report for the RETIRED human-evaluation product ("qualified judgments",
// candidates, "validate on real people"). It is orphaned (no public page links to it) and its content sells
// a product Vraelis no longer offers, so it redirects to the current product story. Kept as a route (rather
// than deleted) so any old external link resolves cleanly instead of 404-ing. noindex.
export const metadata: Metadata = {
  title: "Vraelis",
  robots: { index: false, follow: false },
};

export default function SampleReportRedirect() {
  redirect("/how-it-works");
}
