"use client";

// Homepage: the existing film, editorial chapters with photographs and genuine evidence,
// the subject orbit, agent setup, dated releases and the closing action.
// Run evidence is never reconstructed as a product window.
import { Opening } from "./_system/opening";
import { StrikeStory } from "./_system/strike-story";
import { STRIKE, STRIKE_CHAPTERS, STRIKE_CAPTION } from "./_content/strike";
import { AgentsBand, ChangelogRow } from "./_system/home-bands";
import { Orbit } from "./_system/orbit";
import { ClosingScene } from "./_system/close";
import { useMobileMotion } from "./_system/mobile-motion";

export default function Home() {
  // Gives scroll-driven parts entry motion on screens where they unpin. scripts/mobile-motion-verify.ts
  // requires it, and it is a no-op for parts that are not present.
  useMobileMotion();
  return (
    <>
      <Opening />
      <StrikeStory record={STRIKE} chapters={STRIKE_CHAPTERS} caption={STRIKE_CAPTION} />
      <Orbit />
      <AgentsBand />
      <ChangelogRow />
      <ClosingScene />
    </>
  );
}
