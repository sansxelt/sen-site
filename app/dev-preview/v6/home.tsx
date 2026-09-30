"use client";

// Homepage, tightened 2026-09-29.
//
// The founder's call: the idea is general, so the page is short, it does not rest the whole product on its
// three answers (Verified, Failed, Blocked), and it gets SPECIFIC as the reader scrolls. Six sections:
//
//   1 opening         graphite   say what should work; Vraelis checks it on the live app; partnerships
//   2 for example     paper      pinned: one concrete example per scroll step, a kind of product, the
//                                sentence, what the browser does, what it catches (_system/examples.tsx)
//   3 real runs       graphite   production runs replayed with their own screenshots and timings
//                                (_system/demos.tsx); never a scripted run
//   4 devices         sunk       connected devices through their web control panels; device-level is Next
//   5 how it works    paper      four cards: sentence, approval, live run, fix and re-check (_system/how.tsx)
//   6 closing         graphite   one statement, two actions
//
// REMOVED FROM THE HOMEPAGE that day, still in _system/chapters.tsx and still used or restorable:
// Authority and Gap (the argument for an independent check), Product (the terminal and its exit codes),
// Standard (the four refusals and "Verified is the most dangerous word"), Loop (the five-screen walk
// through a run, now the four cards) and Reach (the four ways in, now named in the first card). The page
// explained the argument before showing anything; now it shows, and /platform, /method, /agents and /docs
// carry the explanation for a reader who asks for it.
//
// Every positioning string comes from _system/positioning.ts.
import { Hero } from "./_system/hero";
import { Devices } from "./_system/chapters";
import { ClosingScene } from "./_system/close";
import { Demos } from "./_system/demos";
import { Examples } from "./_system/examples";
import { HowItWorks } from "./_system/how";
import { useMobileMotion } from "./_system/mobile-motion";

export default function Home() {
  // Gives the scroll chapters' parts entry motion on screens where they unpin. Kept mounted even though
  // most of those chapters left this page: scripts/mobile-motion-verify.ts requires it, and it is a no-op
  // for parts that are not present.
  useMobileMotion();
  return (
    <>
      <Hero />
      <Examples />
      <Demos />
      <Devices />
      <HowItWorks />
      <ClosingScene />
    </>
  );
}
