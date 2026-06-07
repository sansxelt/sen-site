import type { Metadata } from "next";
import { HowContent } from "../../_components/vraelis-ui";

export const metadata: Metadata = {
  title: "How it works — Vraelis",
  description:
    "Set it up once: connect your forms, inbox, and calendar. Vraelis answers every lead in seconds, qualifies them, follows up, and books the call.",
};

export default function VraelisHowPage() {
  return <HowContent />;
}
