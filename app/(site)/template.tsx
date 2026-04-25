import type { ReactNode } from "react";
import { PageTransition } from "@/components/page-transition";

export default function SiteTemplate({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
