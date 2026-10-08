import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PreviewShell } from "./shell";
import "./preview.css";

export const metadata: Metadata = {
  title: "Vraelis design preview",
  description: "A Vraelis website design preview for review.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { colorScheme: "dark", themeColor: "#0b0b0b" };
export default function Layout({ children }: { children: ReactNode }) {
  return <PreviewShell>{children}</PreviewShell>;
}
