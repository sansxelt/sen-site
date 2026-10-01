"use client";

// Loads the film stage in the browser only (WebGL and WebCodecs).
import dynamic from "next/dynamic";

const FilmStage = dynamic(() => import("./film-stage").then((m) => m.FilmStage), { ssr: false });

export function FilmClient() {
  return <FilmStage />;
}
