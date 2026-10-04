import { notFound } from "next/navigation";
import { RecordedApp } from "./recorded-app";
export const metadata = { title: "Recorded check replay", robots: { index: false, follow: false } };
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <RecordedApp />;
}
