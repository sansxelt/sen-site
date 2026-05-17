import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Product",
};

export default function ProductLayout({ children }: { children: ReactNode }) {
  return children;
}
