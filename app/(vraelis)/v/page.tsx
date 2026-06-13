import type { Metadata } from "next";
import { HomeContent } from "../_components/vraelis-ui";

export const metadata: Metadata = {
  title: "Vraelis — The AI agent that follows up, books leads, and collects payment",
  description:
    "Vraelis is the AI agent that answers every lead, qualifies serious buyers, follows up on its own, books the call, and collects payment for you. Free to start; Vraelis only earns when your agent gets you paid.",
};

export default function VraelisHomePage() {
  return <HomeContent />;
}
