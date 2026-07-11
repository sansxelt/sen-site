import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { humanEvalEnabled } from "@/lib/v-entitlements";

export const metadata: Metadata = { title: "New" };

export default function Layout({ children }: { children: ReactNode }) {
  // Human evaluation is demoted until an evaluator pool exists; "+ New" now means connecting an
  // application to the production layer, not running a legacy check.
  if (!humanEvalEnabled()) redirect("/app/apps/new");
  return children;
}
