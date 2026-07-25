"use client";

// Homepage, design 06 phase 2.
//
// The company category is NOT settled. Every high-level positioning string lives in _system/positioning.ts
// and is read from there by the opening, the closing, the footer, the metadata, and the OG image. No scene
// below restates the thesis: each one does one job, describes concrete behaviour that exists today, and says
// it once. That is what lets the category be replaced later without rewriting the page.
//
//   opening      what the product is, as one live environment
//   authority    why a claim of "complete" is not proof
//   lifecycle    one responsibility, followed across four states  (the signature scene)
//   control      the actual product structure
//   engine       the one capability that is working today, as a real run
//   distribution where a finished result already reaches
//   memory       what the company is left holding
//   knowledge    the writing behind the product
//   closing      the opening's responsibility, resolved
import "./_system/home.css";
import { Hero } from "./_system/hero";
import { Lifecycle } from "./_system/lifecycle";
import { Authority, ControlCenter, Engine, Distribution, Memory, Knowledge } from "./_system/scenes";
import { ClosingScene } from "./_system/close";

export default function Home() {
  return (
    <>
      <Hero />
      <Authority />
      <Lifecycle />
      <ControlCenter />
      <Engine />
      <Distribution />
      <Memory />
      <Knowledge />
      <ClosingScene />
    </>
  );
}
