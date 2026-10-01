"use client";

// Loads the orbit stage in the browser only (WebGL and WebCodecs).
import dynamic from "next/dynamic";

const OrbitStage = dynamic(() => import("./orbit-stage").then((m) => m.OrbitStage), { ssr: false });

export function OrbitClient() {
  return <OrbitStage />;
}
