import { redirect } from "next/navigation";
import type { Metadata } from "next";

// This was a public sample report for the RETIRED AI-output-checker product. It is orphaned and sells a
// product Vraelis no longer offers, so it redirects to the current product story. Kept as a route (not
// deleted) so any old external link resolves cleanly instead of 404-ing. noindex.
export const metadata: Metadata = {
  title: "Vraelis",
  robots: { index: false, follow: false },
};

export default function SampleCheckRedirect() {
  redirect("/how-it-works");
}
