import type { ReactNode } from "react";
import { ogMeta } from "@/lib/og-meta";

export const metadata = ogMeta({
  title: "Vote & earn — Vraelis",
  description: "Vote on real creative tests and earn credits for valid feedback. Help AI apps and creative teams learn what people prefer.",
  path: "/vote",
});

export default function VoteLayout({ children }: { children: ReactNode }) {
  return children;
}
