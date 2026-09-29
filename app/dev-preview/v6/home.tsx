"use client";

// Homepage, design 06 phase 2R.
//
// Full-screen chapters, each with one dominant idea and one dominant visual. Backgrounds alternate at every
// boundary so the page reads as changes of atmosphere rather than as stacked modules:
//
//   1 opening        graphite   headline, one line, one action
//   2 the authority  graphite   the absence the company exists inside: five seals, one that never closes
//   3 the gap        stone      one word at full scale, losing its authority
//   4 the product    graphite   the real CLI: one command, three exit codes, no false green. THIS IS THE
//                               RUN ON THE PAGE: Product in _system/chapters.tsx shows one check going from
//                               sentence to approval to a Failed answer with its evidence.
//   5 the standard   graphite   what Verified has to mean: four refusals closing a ring
//     devices        sunk       connected devices through their web control panels; device-level is Next
//   6 the loop       graphite   sentence, approval, live run, answer, fix and re-check, with who acts
//   7 reach          stone      the four ways in (console, CLI, CI and API, AI assistants) and where the
//                               answer lands
//   8 closing        graphite   one statement, one line, two actions
//
// The Direction chapter (Compile, Challenge, Accumulate, and a durable graph of guarantees) and the
// illustrative business-guarantee register were removed on 2026-09-28, when the public story was locked on
// one function: a sentence about a deployed web app, checked on the live app, answered with evidence.
//
// Explanation deliberately does NOT live here. /platform, /agents, /method, /research and /docs carry it.
// Every positioning string comes from _system/positioning.ts.
import { Hero } from "./_system/hero";
import { Authority, Gap, Standard, Product, Devices, Loop, Reach } from "./_system/chapters";
import { ClosingScene } from "./_system/close";
import { Demos } from "./_system/demos";
import { useMobileMotion } from "./_system/mobile-motion";

export default function Home() {
  // Below 900px every chapter above unpins and freezes, so a phone was shown the finished frames of an
  // argument the desktop watches being made. This gives those same parts entry motion, which is the form
  // a phone can afford: no pinning, no scroll listener, each part animating once on its way in.
  useMobileMotion();
  return (
    <>
      <Hero />
      {/* REAL RUNS, FIRST. The founder asked for real product demos: what it is for, shown working. These are
          production verification records replayed step by step with the runs' own screenshots and timings
          (_content/demos.ts), so the first thing below the promise is the product keeping it. Never add a
          scripted run here; a demo that did not happen is the one thing this section cannot contain. */}
      <Demos />
      {/* THE ONE CHAPTER THAT ARGUES ABOUT THE WORLD RATHER THAN ABOUT THE PRODUCT, and the reason it sits
          here rather than deeper: everything below this line is a mechanism, and a mechanism only reads as
          groundbreaking if the reader already knows what is missing. It names the absence (every serious
          discipline has an authority that is not the builder; ordinary software never had one, because the
          builder was a person who could be held to it) and it deliberately does NOT resolve it.
          Gap resolves it, one chapter down, with the line it already had. Do not let a resolution appear in
          both: if one is ever written into Authority, delete it from Gap rather than carrying two. */}
      <Authority />
      {/* REORDERED so the reader reaches something concrete sooner.
          Gap is now a single-beat BRIDGE rather than three scenes: it kept the line that names Vraelis
          ("So something independent has to answer it") and the other two travellers are commented out in
          chapters.tsx, restorable. It stays in position 2 on purpose — it is the page's only light chapter,
          and its last stretch resolves paper -> graphite, which is what hands the reader into the graphite
          run below. Moving it later would have left five dark screens with no tonal break.
          Product (the CLI: one command, three answers) moves AHEAD of Standard so the first thing after
          the bridge is proof rather than more argument. Nothing else moved, and no copy changed. */}
      <Gap />
      {/* THE RUN. Product is the one chapter that shows a check happening end to end, and it stays exactly
          here, straight after the bridge, so the first thing after the argument is proof. */}
      <Product />
      <Standard />
      {/* A named area, not the identity: connected devices through their web control panels, with the
          device-level line marked Next. Light, between two graphite chapters. */}
      <Devices />
      <Loop />
      <Reach />
      <ClosingScene />
    </>
  );
}
