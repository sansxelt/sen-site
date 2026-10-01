"use client";

// Homepage, rebuilt 2026-10-01 from the founder's notes, with scale.com's homepage as the structural
// reference (adapted, not copied) and anduril.com and palantir.com for the black ground and the film.
//
//   1 the film       one video, full bleed: a board, the drone through four real places, a real catch, the
//                    controller, Vraelis on a laptop, a truck, a plane (_system/hero.tsx)
//   2 how it works   one pinned scene, four chapters, every panel the product's own output for one recorded
//                    run (_system/scroll-story.tsx)
//   3 the statement  one sentence, revealed as it crosses the screen (_system/home-bands.tsx)
//   4 the orbit      what it checks, circling "Know your ___ works." (_system/orbit.tsx)
//   5 real runs      the four recorded runs, replayed (_system/run-window.tsx inside home-bands' Proof)
//   6 agents         the CLI and the MCP tools, in their own words (home-bands.tsx)
//   7 closing        one statement, two actions (_system/close.tsx)
//
// One line of text per section, about what scale.com carries. Every positioning string is in
// _system/positioning.ts or beside the section that says it. Steps (_system/steps.tsx) and the coverage list
// (_system/coverage.tsx) left this page; the coverage list is on /platform#coverage, linked from the orbit.
import { Hero } from "./_system/hero";
import { ScrollStory } from "./_system/scroll-story";
import { Statement, AgentsBand, Proof } from "./_system/home-bands";
import { Orbit } from "./_system/orbit";
import { RunWindow } from "./_system/run-window";
import { ClosingScene } from "./_system/close";
import { useMobileMotion } from "./_system/mobile-motion";

export default function Home() {
  // Gives scroll-driven parts entry motion on screens where they unpin. scripts/mobile-motion-verify.ts
  // requires it, and it is a no-op for parts that are not present.
  useMobileMotion();
  return (
    <>
      <Hero />
      <ScrollStory />
      <Statement />
      <Orbit />
      <Proof><RunWindow /></Proof>
      <AgentsBand />
      <ClosingScene />
    </>
  );
}
