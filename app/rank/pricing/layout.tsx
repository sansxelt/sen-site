import type { ReactNode } from "react";
import { ogMeta } from "@/lib/og-meta";

export const metadata = ogMeta({
  title: "Pricing — Vraelis",
  description: "Simple plans that include monthly credits, plus custom credit top-ups. 1 credit = 1 valid human judgment. Free to start.",
  path: "/pricing",
});

export default function PricingLayout({ children }: { children: ReactNode }) {
  return children;
}
