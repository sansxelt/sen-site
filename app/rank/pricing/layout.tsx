import type { ReactNode } from "react";
import { ogMeta } from "@/lib/og-meta";

export const metadata = ogMeta({
  title: "Pricing",
  description: "Priced by the run, not the seat. Every verification includes real-browser execution, evidence, issue tracking, and an explainable launch decision. First verification free.",
  path: "/pricing",
});

export default function PricingLayout({ children }: { children: ReactNode }) {
  return children;
}
