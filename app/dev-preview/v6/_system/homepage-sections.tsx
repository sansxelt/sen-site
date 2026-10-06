"use client";

import Image from "next/image";
import Link from "next/link";
import { photograph } from "../_content/photography";
import { PRIMARY_SECTORS } from "../_content/sectors";
import { V6_BASE } from "@/lib/v6-routes";
import "./homepage-sections.css";

const AREAS = {
  defense: {
    line: "External review of mission software.",
    image: "/home/menu/editorial/aviation.jpg", width: 1600, height: 900,
  },
  "public-sector": {
    line: "Trace equipment tasks across systems.",
    image: "/site/photography/power-grid.jpg", width: 2400, height: 1800,
  },
  fleets: {
    line: "Follow the task to the intended robot.",
    image: "/site/photography/robot-grinding.jpg", width: 2400, height: 1530,
  },
} as const;

function UpRight() {
  return <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true"><path d="M5 15 15 5M5 5h10v10" stroke="currentColor" strokeWidth="1.4" /></svg>;
}

export function PhysicalSystems() {
  return <section id="physical-systems" className="home-areas" data-nav-theme="dark" aria-labelledby="home-areas-title">
    <div className="v6-wrap">
      <div className="home-section-head">
        <p className="home-eyebrow">External software review</p>
        <h2 id="home-areas-title">Built for the physical world.</h2>
      </div>
      <div className="home-areas__grid">
        {PRIMARY_SECTORS.map((sector, index) => {
          const area = AREAS[sector.slug as keyof typeof AREAS];
          const titleId = `home-area-${sector.slug}`;
          return <Link key={sector.slug} href={sector.href} className="home-area" data-lead={index === 0 || undefined} aria-labelledby={titleId}>
            <span className="home-area__media" aria-hidden="true">
              <Image src={area.image} alt="" width={area.width} height={area.height} sizes="(max-width: 760px) 100vw, 60vw" loading="lazy" />
            </span>
            <div className="home-area__caption">
              <div><h3 id={titleId}>{sector.label}</h3><p>{area.line}</p></div>
              <UpRight />
            </div>
          </Link>;
        })}
      </div>
      <div className="home-areas__sources"><a href="/home/editorial/CREDITS.md">Illustrative photography · Sources <UpRight /></a></div>
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
