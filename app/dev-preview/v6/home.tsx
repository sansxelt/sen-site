"use client";

// Homepage, design 06 phase 2R.
//
// Seven chapters, each a full-screen scene with one dominant idea and one dominant visual. Backgrounds
// alternate at every boundary so the page reads as changes of atmosphere rather than as stacked modules:
//
//   1 opening        graphite   headline, one line, one action, one cropped visual
//   2 the gap        stone      one word at full scale, losing its authority
//   3 the standard   graphite   what Verified has to mean: eight conditions closing a ring
//   4 the product    graphite   the real CLI: one command, three exit codes, no false green
//   5 the record     graphite   a composition assembled in front of the reader
//   6 reach          stone      one result fanning into the stack a company runs
//     knowledge      sunk       the writing behind the product, as a publication
//   7 closing        graphite   one statement, one line, two actions
//
// Explanation deliberately does NOT live here. /platform, /agents, /method, /research and /docs carry it.
// The company category is unsettled and every positioning string comes from _system/positioning.ts.
import { Hero } from "./_system/hero";
import { Gap, Standard, Product, Record, Reach, Knowledge } from "./_system/chapters";
import { ClosingScene } from "./_system/close";

export default function Home() {
  return (
    <>
      <Hero />
      <Gap />
      <Standard />
      <Product />
      <Record />
      <Reach />
      <Knowledge />
      <ClosingScene />
    </>
  );
}
