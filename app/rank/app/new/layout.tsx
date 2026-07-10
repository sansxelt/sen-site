import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { humanEvalEnabled } from "@/lib/v-entitlements";

export const metadata: Metadata = { title: "New evaluation" };

export default function Layout({ children }: { children: ReactNode }) {
  // Human evaluation is demoted until an evaluator pool exists; its entry point sends users to the check.
  if (!humanEvalEnabled()) redirect("/app/checks/new");
  return children;
}
