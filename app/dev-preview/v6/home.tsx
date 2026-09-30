"use client";

// Homepage, rebuilt 2026-09-30.
//
// The founder's read of the page before this: the first screen had too much text and no product, and the
// rest was too much text, not enough actual UI, and not cool enough (references: Vanta, Gusto, axiom). So
// the page now SHOWS the product and says very little:
//
//   1 opening     a tinted band: one headline, one line, the address field, the two partnership records,
//                 and a console window replaying the real production runs (_system/hero.tsx, run-window.tsx)
//   2 surfaces    tinted cards, each one line and a working piece of the product: web apps, devices through
//                 their control panel, the AI agent tools, plan approval, the terminal, and readiness (Next)
//                 (_system/surfaces.tsx)
//   3 coverage    every kind of thing Vraelis is for, each labelled Live, Next or Not covered, read from
//                 _content/coverage.ts (_system/coverage.tsx)
//   4 closing     one statement, two actions
//
// REMOVED that day and still in the tree: Examples (_system/examples.tsx), Real runs (_system/demos.tsx, now
// the hero window), Devices (_system/chapters.tsx, now a card) and HowItWorks (_system/how.tsx). /platform,
// /method, /agents and /docs carry the explanation for a reader who asks for it.
//
// Every positioning string comes from _system/positioning.ts.
import { Hero } from "./_system/hero";
import { Surfaces } from "./_system/surfaces";
import { ClosingScene } from "./_system/close";
import { Coverage } from "./_system/coverage";
import { useMobileMotion } from "./_system/mobile-motion";

export default function Home() {
  // Gives the scroll chapters' parts entry motion on screens where they unpin. Kept mounted even though
  // those chapters left this page: scripts/mobile-motion-verify.ts requires it, and it is a no-op for parts
  // that are not present.
  useMobileMotion();
  return (
    <>
      <Hero />
      <Surfaces />
      <Coverage />
      <ClosingScene />
    </>
  );
}
