import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { OrbitClient } from "./orbit-client";

// The drone orbit for the homepage film (orbit-stage.tsx): the drone holds in the air while the camera
// circles it and real places sweep in behind it. A development tool that renders frame by frame and hands
// back an MP4. Production never serves it.
export const metadata: Metadata = { title: "Film: orbit", robots: { index: false, follow: false } };

export default function OrbitPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <OrbitClient />;
}
