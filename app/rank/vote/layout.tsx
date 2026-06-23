import type { ReactNode } from "react";
import { ogMeta } from "@/lib/og-meta";

export const metadata = ogMeta({
  title: "Evaluate & earn",
  description: "Evaluate real creative candidates and earn credits for every valid judgment.",
  path: "/vote",
});

export default function VoteLayout({ children }: { children: ReactNode }) {
  return children;
}
