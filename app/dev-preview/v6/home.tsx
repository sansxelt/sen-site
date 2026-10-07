"use client";

// Homepage: cinematic opening, application areas, photographic orbit and engineering resources.
import { useRef } from "react";
import { useHomeMotion } from "./_system/home-motion";
import { HomeSequence } from "./_system/home-sequence";
import { Orbit } from "./_system/orbit";
import { PhysicalSystems, EngineeringEntry } from "./_system/homepage-sections";
import { useMobileMotion } from "./_system/mobile-motion";
import { PhotoStory } from "./_system/photo-story";
import { V6_BASE } from "@/lib/v6-routes";

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
      <PhotoStory content={{
        photo:"robotCell", eyebrow:"The product direction", title:"Control the action, not just the answer.",
        paragraphs:[
          "An AI assistant may need to read operational data. Changing a model, configuration or device is a different permission, with different consequences.",
          "We are building around that distinction: scoped access, independent approval and a record connecting the decision to what the system reports. The first integration is being developed for a controlled test environment.",
        ],
        link:{label:"Explore the product direction",href:`${V6_BASE}/platform`},
      }} />
    </div>
  );
}
