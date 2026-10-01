import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FilmClient } from "./film-client";

// The drone film renderer (film-stage.tsx). A development tool: it renders the homepage film frame by frame
// and hands back an MP4. Production never serves it.
export const metadata: Metadata = { title: "Film", robots: { index: false, follow: false } };

export default function FilmPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <FilmClient />;
}
