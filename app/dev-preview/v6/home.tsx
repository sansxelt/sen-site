"use client";

// Homepage: cinematic opening, three focus areas,
// the app replay, engineering resources.
import { Opening } from "./_system/opening";
import { StrikeStory } from "./_system/strike-story";
import { STRIKE, STRIKE_CHAPTERS, STRIKE_CAPTION } from "./_content/strike";
import { PhysicalSystems, EngineeringEntry } from "./_system/homepage-sections";
import { useMobileMotion } from "./_system/mobile-motion";

export default function Home() {
  // Gives scroll-driven parts entry motion on screens where they unpin. scripts/mobile-motion-verify.ts
  // requires it, and it is a no-op for parts that are not present.
  useMobileMotion();
  return (
    <div className="home-page">
      <Opening />
      <PhysicalSystems />
      <StrikeStory record={STRIKE} chapters={STRIKE_CHAPTERS} caption={STRIKE_CAPTION} />
      <EngineeringEntry />
    </div>
  );
}
