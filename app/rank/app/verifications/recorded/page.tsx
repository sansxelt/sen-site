import type { Metadata } from "next";
import localFont from "next/font/local";
import { RecordedWorkspace } from "./recorded-workspace";
import "./recorded.css";

export const metadata: Metadata = { title: "Recorded verification", robots: { index: false, follow: false } };
const font = localFont({ src: "../../../../fonts/manrope/Manrope-Variable.ttf", variable: "--font-recorded", display: "swap", weight: "200 800" });

// Deliberately local and usable without an account: this route reads no customer DB rows,
// uploads no evidence and launches no device/browser/API action. The surrounding shell still
// provides sign-in for cloud workflows. Do not conflate this tool with cloud run history.
export default function RecordedPage() {
  return <div className={font.variable}><RecordedWorkspace /></div>;
}
