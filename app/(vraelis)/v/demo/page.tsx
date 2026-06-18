import type { Metadata } from "next";
import { DemoContent } from "../../_components/vraelis-ui";

export const metadata: Metadata = {
  title: "See it work — Vraelis",
  description:
    "Watch the Vraelis agent in action: it answers a lead in seconds, qualifies serious buyers, follows up on its own, books the call, and collects payment — all from one dashboard.",
};

export default function VraelisDemoPage() {
  return <DemoContent />;
}
