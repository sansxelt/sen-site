import type { ReactNode } from "react";
import { ogMeta } from "@/lib/og-meta";

export const metadata = ogMeta({
  title: "Vote",
  description: "Vote on real creative tests and earn credits for valid feedback.",
  path: "/vote",
});

export default function VoteLayout({ children }: { children: ReactNode }) {
  return children;
}
