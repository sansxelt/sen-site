"use client";

import Link from "next/link";
import { V6_BASE } from "@/lib/v6-routes";
import { COMPANY_SECURITY_AREAS as scope } from "../_content/company-direction";
import { ContourComparison } from "./contour-comparison";
import "./company-story.css";

export function StoryArrow() {
  return <svg className="story-arrow" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>;
}

/** Concept diagrams illustrate research areas, not deployed coverage. */
function ScopeDiagram({ kind }: { kind: number }) {
  return <svg className="company-story__diagram" viewBox="0 0 240 88" fill="none" aria-hidden="true">
    {kind === 0 && <><path d="M30 18h49l12 12v40H30zM79 18v12h12M44 43h30M44 52h22" /><path d="M100 44h35" className="scope-line" /><rect x="144" y="18" width="58" height="52" rx="8" /><path d="m160 44 8 8 18-18" className="scope-emphasis" /></>}
    {kind === 1 && <><path d="M20 44h34l8-17 12 34 12-17h26" className="scope-line" /><rect x="122" y="18" width="32" height="52" rx="6" /><path d="M163 44h54M139 29v19m0 9v1" className="scope-emphasis" /></>}
    {kind === 2 && <><rect x="24" y="24" width="52" height="40" rx="8" /><circle cx="50" cy="44" r="7" /><path d="M86 44h48" className="scope-line" /><path d="m173 18 23 9v18c0 12-9 20-23 25-14-5-23-13-23-25V27zM163 44l7 7 14-15" className="scope-emphasis" /></>}
    {kind === 3 && <><path d="M35 19v50M42 25h40M42 44h59M42 63h40M116 44h23" className="scope-line" /><circle cx="35" cy="25" r="4" /><circle cx="35" cy="44" r="4" /><circle cx="35" cy="63" r="4" /><rect x="149" y="18" width="55" height="52" rx="6" /><path d="M162 32h28M162 44h28M162 56h17" /></>}
  </svg>;
}

const scopeQuestions = [
  "Where did the model come from, and what changed?",
  "How could manipulated inputs affect this system?",
  "Which resources and actions may the workload use?",
  "What do the observations establish—and what is missing?",
] as const;

export function CompanyStory() {
  return <section id="company-scope" className="company-story v6-wrap" aria-labelledby="company-story-title">
    <header className="company-story__head">
      <div><p className="home-eyebrow">The company</p><h2 id="company-story-title">AI security.<br />Physical consequences.</h2></div>
      <div><p>Vraelis is developing cybersecurity software for AI systems in defense, critical infrastructure and robotics.</p><Link className="story-link" href={`${V6_BASE}/company`}>About Vraelis <StoryArrow /></Link></div>
    </header>
    <div className="company-story__cards">
      {scope.map((item, index) => <Link key={item.title} href={`${V6_BASE}${item.href}`} className="company-story__card">
        <ScopeDiagram kind={index} /><h3>{item.title}</h3><p>{scopeQuestions[index]}</p>
        <span className="company-story__card-end"><span>Explore research</span><StoryArrow /></span>
      </Link>)}
    </div>
    <p className="company-story__status">Research and development scope. Contour is our first product.</p>
  </section>;
}

export function ContourSpotlight() {
  return <section id="first-product" className="contour-spotlight v6-wrap" aria-labelledby="contour-spotlight-title">
    <div className="contour-spotlight__intro">
      <p className="home-eyebrow">Our first product · Private development</p>
      <h2 id="contour-spotlight-title">Vraelis Contour</h2>
      <p className="contour-spotlight__line">Know what you<br />are releasing.</p>
      <p className="contour-spotlight__audience">Model release security for robotics suppliers and system integrators.</p>
      <Link className="story-link story-link--button" href={`${V6_BASE}/contour`}>Explore Contour <StoryArrow /></Link>
    </div>
    <ContourComparison />
  </section>;
}
