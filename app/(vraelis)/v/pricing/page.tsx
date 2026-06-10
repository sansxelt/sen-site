import type { Metadata } from "next";
import { PricingContent } from "../../_components/vraelis-ui";

export const metadata: Metadata = {
  title: "Pricing — Vraelis",
  description:
    "No software fee. Vraelis is free to start and only earns a small cut when it collects a payment for you. We win when you get paid.",
};

export default function VraelisPricingPage() {
  return <PricingContent />;
}
