"use client";

// Homepage: cinematic opening, application areas, photographic orbit and engineering resources.
import { useRef } from "react";
import { useHomeMotion } from "./_system/home-motion";
import { HomeSequence } from "./_system/home-sequence";
import { Orbit } from "./_system/orbit";
import { PhysicalSystems, EngineeringEntry } from "./_system/homepage-sections";
import { useMobileMotion } from "./_system/mobile-motion";
import { SecurityFields } from "./_system/security-fields";

export default function Home() {
  // Gives scroll-driven parts entry motion on screens where they unpin. scripts/mobile-motion-verify.ts
  // requires it, and it is a no-op for parts that are not present.
  useMobileMotion();
  const root = useRef<HTMLDivElement>(null);
  useHomeMotion(root);
  return (
    <div ref={root} className="home-page">
      <HomeSequence>
      <PhysicalSystems />
      <Orbit />
      <EngineeringEntry />
      </HomeSequence>
      <SecurityFields />
    </div>
  );
}
