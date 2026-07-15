import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { humanEvalEnabled } from "@/lib/v-entitlements";

// Retired human-evaluation surface. Gated behind the same flag as /vote and /new: when human evaluation is
// off (the default and current production state), this page is not part of the product a customer sees, so it
// redirects to the current dashboard. Code preserved for a future evaluator panel.
export default function Layout({ children }: { children: ReactNode }) {
  if (!humanEvalEnabled()) redirect("/app");
  return children;
}
