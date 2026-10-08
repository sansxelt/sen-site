"use client";

// Company scope, audiences and the first product each have a distinct chapter.
import { useRef } from "react";
import { useHomeMotion } from "./_system/home-motion";
import { HomeSequence } from "./_system/home-sequence";
import { PhysicalSystems } from "./_system/homepage-sections";
import { CompanyStory, ContourSpotlight } from "./_system/company-story";
import { useMobileMotion } from "./_system/mobile-motion";
import { ResourceCollection } from "./_system/resource-collection";

export default function Home() {
  // Gives scroll-driven parts entry motion on screens where they unpin. scripts/mobile-motion-verify.ts
  // requires it, and it is a no-op for parts that are not present.
  useMobileMotion();
  const root = useRef<HTMLDivElement>(null);
  useHomeMotion(root);
  return (
    <div ref={root} className="home-page">
      <HomeSequence>
        <CompanyStory />
        <PhysicalSystems />
        <ContourSpotlight />
      </HomeSequence>
      <ResourceCollection />
    </div>
  );
}
