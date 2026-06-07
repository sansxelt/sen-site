import type { Metadata } from "next";
import { AutomatesContent } from "../../_components/vraelis-ui";

export const metadata: Metadata = {
  title: "What it automates — Vraelis",
  description:
    "Instant replies, qualifying questions, follow-ups, booking and reminders, owner handoff, and pipeline tracking — the lead chasing you keep meaning to do.",
};

export default function VraelisAutomatesPage() {
  return <AutomatesContent />;
}
