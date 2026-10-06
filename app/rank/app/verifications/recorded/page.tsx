import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getSignInPath } from "@/lib/auth-ui";
import localFont from "next/font/local";
import { RecordedWorkspace } from "./recorded-workspace";
import "./recorded.css";

export const metadata: Metadata = { title: "Recorded verification", robots: { index: false, follow: false } };
const font = localFont({ src: "../../../../fonts/manrope/Manrope-Variable.ttf", variable: "--font-recorded", display: "swap", weight: "200 800" });

export const dynamic = "force-dynamic";
export default async function RecordedPage() {
  const session = await auth();
  if (!session?.user?.email) redirect(getSignInPath("/verifications/recorded"));
  return <div className={font.variable}><RecordedWorkspace /></div>;
}
