import type { Metadata } from "next";
import { PricingContent } from "../../_components/vraelis-ui";

export const metadata: Metadata = {
  title: "Pricing — Vraelis",
  description:
    "Costs less than one lost job. Start free, upgrade once Vraelis is booking more work than it costs you.",
};

export default function VraelisPricingPage() {
  return <PricingContent />;
}
