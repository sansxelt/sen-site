"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { photograph } from "../_content/photography";
import { PRIMARY_SECTORS } from "../_content/sectors";
import { V6_BASE } from "@/lib/v6-routes";
import "./homepage-sections.css";

const AREAS = {
  defense: {
    title: "An external view of mission software.",
    description: "For engineering teams reviewing mission consoles and supplied platform reports. Trace the requested task, the intended asset and the state each system recorded.",
    image: "/home/menu/editorial/aviation.jpg", width: 1600, height: 900,
    subjects: "Mission consoles, platform software and task reports",
  },
  "public-sector": {
    title: "Software behind essential infrastructure.",
    description: "For teams responsible for equipment control software. Compare what a panel reports with supplied service and device records, including the evidence that is missing.",
    image: "/site/photography/power-grid.jpg", width: 2400, height: 1800,
    subjects: "Equipment controls, services and reported state",
  },
  fleets: {
    title: "The right task. The right robot.",
    description: "For robotics developers and integrators. Follow one task across control software and recorded device reports, then compare the same criteria after a change.",
    image: "/site/photography/robot-grinding.jpg", width: 2400, height: 1530,
    subjects: "Robotics software, task services and device reports",
  },
} as const;

function UpRight() {
  return <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true"><path d="M5 15 15 5M5 5h10v10" stroke="currentColor" strokeWidth="1.4" /></svg>;
}

export function PhysicalSystems() {
  const [selected, setSelected] = useState(0);
  const sector = PRIMARY_SECTORS[selected];
  const area = AREAS[sector.slug as keyof typeof AREAS];
  return <section id="physical-systems" className="home-areas" data-nav-theme="dark" aria-labelledby="home-areas-title">
    <div className="v6-wrap">
      <div className="home-section-head">
        <p className="home-eyebrow">Where software meets the physical world</p>
        <h2 id="home-areas-title">Built for the systems<br />people depend on.</h2>
      </div>
      <div className="home-areas__choices" role="group" aria-label="Explore Vraelis focus areas">
        {PRIMARY_SECTORS.map((item, index) => <button type="button" key={item.slug} aria-pressed={selected === index} onClick={() => setSelected(index)}>{item.label}</button>)}
      </div>
      <div className="home-areas__scene">
        <div className="home-areas__photographs" aria-hidden="true">
          {PRIMARY_SECTORS.map((item, index) => {
            const photo = AREAS[item.slug as keyof typeof AREAS];
            return <Image key={item.slug} src={photo.image} alt="" width={photo.width} height={photo.height} sizes="(max-width: 760px) 100vw, 90vw" loading="lazy" data-active={selected === index} />;
          })}
        </div>
        <div className="home-areas__copy" aria-live="polite" aria-atomic="true">
          <p className="home-eyebrow">{sector.label}</p>
          <h3>{area.title}</h3>
          <p>{area.description}</p>
          <Link href={sector.href}>Explore {sector.label.toLowerCase()} <span aria-hidden>→</span></Link>
        </div>
      </div>
      <div className="home-areas__caption"><span>{area.subjects}</span><a href="/home/editorial/CREDITS.md">Illustrative photography and sources <UpRight /></a></div>
    </div>
  </section>;
}

export function EngineeringEntry() {
  const documentation = photograph("hardwareInspection");
  const platform = photograph("networkEngineer");
  return <section className="home-engineering" data-nav-theme="dark" aria-labelledby="home-engineering-title">
    <div className="v6-wrap">
      <div className="home-section-head home-section-head--split">
        <h2 id="home-engineering-title">Start with the evidence<br />you already have.</h2>
        <p>Supported task reports stay in your browser. Review what should happen, examine the result and follow it back to the source events.</p>
      </div>
      <div className="home-engineering__links">
        <Link href={`${V6_BASE}/docs/recorded-reports`} className="home-resource">
          <div className="home-resource__image"><Image src={documentation.src} alt={documentation.alt} width={documentation.w} height={documentation.h} sizes="(max-width: 760px) 100vw, 45vw" loading="lazy" /></div>
          <div><p className="home-eyebrow">Documentation</p><h3>From recording to result.</h3><span>Formats, source mapping and the first review <UpRight /></span></div>
        </Link>
        <Link href={`${V6_BASE}/platform`} className="home-resource">
          <div className="home-resource__image"><Image src={platform.src} alt={platform.alt} width={platform.w} height={platform.h} sizes="(max-width: 760px) 100vw, 45vw" loading="lazy" /></div>
          <div><p className="home-eyebrow">The platform</p><h3>Know what the result means.</h3><span>Available workflows, evidence and boundaries <UpRight /></span></div>
        </Link>
      </div>
    </div>
  </section>;
}
