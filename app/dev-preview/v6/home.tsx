"use client";

// Homepage, design 06 phase 2R.
//
// Seven chapters, each a full-screen scene with one dominant idea and one dominant visual. Backgrounds
// alternate at every boundary so the page reads as changes of atmosphere rather than as stacked modules:
//
//   1 opening        graphite   headline, one line, one action, one cropped visual
//   2 the authority  graphite   the absence the company exists inside: five seals, one that never closes
//   3 the gap        stone      one word at full scale, losing its authority
//   4 the standard   graphite   what Verified has to mean: four refusals closing a ring
//   5 the product    graphite   the real CLI: one command, three exit codes, no false green
//   6 the register   graphite   the zoom out: one guarantee becomes the whole operating surface
//   7 reach          stone      one result fanning into the stack a company runs
//     knowledge      sunk       the writing behind the product, as a publication
//   8 closing        graphite   one statement, one line, two actions
//
// Explanation deliberately does NOT live here. /platform, /agents, /method, /research and /docs carry it.
// The company category is unsettled and every positioning string comes from _system/positioning.ts.
import { Hero } from "./_system/hero";
import { Authority, Gap, Standard, Product, Register, Reach, Direction, Knowledge } from "./_system/chapters";
import { ClosingScene } from "./_system/close";
import { useMobileMotion } from "./_system/mobile-motion";

export default function Home() {
  // Below 900px every chapter above unpins and freezes, so a phone was shown the finished frames of an
  // argument the desktop watches being made. This gives those same parts entry motion, which is the form
  // a phone can afford: no pinning, no scroll listener, each part animating once on its way in.
  useMobileMotion();
  return (
    <>
      <Hero />
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
      <Product />
      <Standard />
      <Register />
      <Reach />
      <Direction />
      <Knowledge />
      <ClosingScene />
    </>
  );
}
