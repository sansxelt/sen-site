import type { Metadata } from "next";
import { HowContent } from "../../_components/vraelis-ui";

export const metadata: Metadata = {
  title: "How it works — Vraelis",
  description:
    "Set it up once. Vraelis engages every lead in seconds, qualifies serious buyers, follows up automatically, books the call, and collects the payment — turning interested leads into paying customers.",
};

export default function VraelisHowPage() {
  return <HowContent />;
}
