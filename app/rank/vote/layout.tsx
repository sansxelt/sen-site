import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ogMeta } from "@/lib/og-meta";
import { humanEvalEnabled } from "@/lib/v-entitlements";

export const metadata = ogMeta({
  title: "Evaluate & Earn",
  description: "Evaluate real creative candidates and earn credits for every valid judgment.",
  path: "/vote",
});

export default function VoteLayout({ children }: { children: ReactNode }) {
  // The evaluator supply side is demoted until we operate a panel; the voting page is hidden.
  if (!humanEvalEnabled()) redirect("/");
  return children;
}
