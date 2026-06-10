import type { Metadata } from "next";
import { HomeContent } from "../_components/vraelis-ui";

export const metadata: Metadata = {
  title: "Vraelis — Turn interested leads into paying customers",
  description:
    "Vraelis is the revenue platform for high-ticket sellers. It engages every lead, qualifies, follows up, books the call, and collects payment — so your $2k–$10k offers actually close. Free to start; we only earn when you get paid.",
};

export default function VraelisHomePage() {
  return <HomeContent />;
}
