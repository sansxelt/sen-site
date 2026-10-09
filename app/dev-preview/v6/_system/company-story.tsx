"use client";

import Link from "next/link";
import { V6_BASE } from "@/lib/v6-routes";
import { COMPANY_SECURITY_AREAS as scope } from "../_content/company-direction";
import { ContourComparison } from "./contour-comparison";
import { ScopePreview } from "./scope-preview";
import "./company-story.css";

export function StoryArrow() {
  return <svg className="story-arrow" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>;
}

const scopeLines = [
  "Trace a model’s source and changes.",
  "Test how manipulated inputs affect a model.",
  "Define allowed resources and actions.",
  "Connect findings to observations and gaps.",
] as const;

export function CompanyStory() {
  return <section id="company-scope" className="company-story v6-wrap" aria-labelledby="company-story-title">
    <header className="company-story__head">
      <div><p className="home-eyebrow">The company</p><h2 id="company-story-title">Security for the AI<br />inside critical systems.</h2></div>
      <div><p>Vraelis is developing cybersecurity software for AI systems in defense, critical infrastructure and robotics.</p><Link className="story-link" href={`${V6_BASE}/company`}>About Vraelis <StoryArrow /></Link></div>
    </header>
    <div className="company-story__cards">
      {scope.map((item, index) => <Link key={item.title} href={`${V6_BASE}${item.href}`} className="company-story__card">
        <ScopePreview kind={index} /><h3>{item.title}</h3><p>{scopeLines[index]}</p>
        <span className="company-story__card-end"><span>{["Trace the model", "Study the attack surface", "Define permissions", "Review the evidence"][index]}</span><StoryArrow /></span>
      </Link>)}
    </div>
    <p className="company-story__status">Illustrative research views. Contour is our first product, in private development.</p>
  </section>;
}

export function ContourSpotlight() {
  return <section id="first-product" className="contour-spotlight v6-wrap" aria-labelledby="contour-spotlight-title">
    <div className="contour-spotlight__intro">
      <p className="home-eyebrow">Our first product · Private development</p>
      <h2 id="contour-spotlight-title">Vraelis Contour</h2>
      <p className="contour-spotlight__line">Know what you<br />are releasing.</p>
      <p className="contour-spotlight__audience">Connect the approved model release to what the receiving service reports loading.</p>
      <p className="contour-spotlight__for">For robotics suppliers and system integrators.</p>
      <Link className="story-link story-link--button" href={`${V6_BASE}/contour`}>Explore Contour <StoryArrow /></Link>
    </div>
    <ContourComparison />
  </section>;
}
