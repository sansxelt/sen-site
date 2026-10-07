"use client";

import Link from "next/link";
import { PRIMARY_SECTORS } from "../_content/sectors";
import { V6_BASE } from "@/lib/v6-routes";
import "./homepage-sections.css";

const AREAS = {
  defense: "For engineering and security teams developing AI-enabled mission systems. Explicit authority, controlled model changes and traceable security decisions.",
  "public-sector": "For utilities, transport and industrial operations introducing AI into their systems. Define access, protect configuration boundaries and investigate reported behavior.",
  fleets: "For teams building AI-enabled robots and autonomous equipment. Constrain model access and proposed actions while keeping the available device evidence inspectable.",
} as const;

export function PhysicalSystems() {
  return <section id="physical-systems" className="home-areas" data-nav-theme="dark" aria-labelledby="home-areas-title">
    <div className="v6-wrap">
      <div className="home-section-head">
        <p className="home-eyebrow">Our application areas</p>
        <h2 id="home-areas-title">AI security in the physical world.</h2>
      </div>
      <div className="home-areas__list">
        {PRIMARY_SECTORS.map(sector => <Link key={sector.slug} href={sector.href} className="home-area">
          <h3>{sector.label}</h3><p>{AREAS[sector.slug as keyof typeof AREAS]}</p>
        </Link>)}
      </div>
    </div>
  </section>;
}

export function EngineeringEntry() {
  return <section className="home-engineering" data-nav-theme="dark" aria-labelledby="home-engineering-title">
    <div className="v6-wrap">
      <div className="home-section-head home-section-head--split">
        <h2 id="home-engineering-title">Define the boundary.<br />Build the control.</h2>
        <p>Understand the AI workload, the resources it can reach and the evidence needed to investigate its behavior.</p>
      </div>
      <div className="home-engineering__links">
        <Link href={`${V6_BASE}/zero-trust`} className="home-resource">
          <p className="home-eyebrow">Zero trust</p><h3>Authority must be explicit.</h3>
          <p>Zero trust informs how we are building AI security: verify identity, limit permissions and reassess authority at the boundary where an action occurs.</p>
        </Link>
        <Link href={`${V6_BASE}/platform`} className="home-resource">
          <p className="home-eyebrow">The product direction</p><h3>The work behind the controls.</h3>
          <p>We are developing cybersecurity for AI-enabled defense, infrastructure and robotics. Explicit authority, controlled changes and evidence engineers can investigate.</p>
        </Link>
      </div>
    </div>
  </section>;
}
