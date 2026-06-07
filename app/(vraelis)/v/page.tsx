import type { Metadata } from "next";
import { HomeContent } from "../_components/vraelis-ui";

export const metadata: Metadata = {
  title: "Vraelis — Turn missed leads into booked calls",
  description:
    "Vraelis is the AI lead follow-up agent that replies in under a minute, qualifies the lead, chases until they answer, and books the call on your calendar.",
};

export default function VraelisHomePage() {
  return <HomeContent />;
}
