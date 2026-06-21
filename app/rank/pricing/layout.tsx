import type { ReactNode } from "react";
import { ogMeta } from "@/lib/og-meta";

export const metadata = ogMeta({
  title: "Pricing",
  description: "Plans include monthly credits. Top up anytime. 1 credit = 1 valid judgment. Free to start.",
  path: "/pricing",
});

export default function PricingLayout({ children }: { children: ReactNode }) {
  return children;
}
