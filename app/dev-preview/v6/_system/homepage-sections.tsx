"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { MediaReadyFallback, useMediaReady } from "./media-ready";
import { photograph } from "../_content/photography";
import { PRIMARY_SECTORS } from "../_content/sectors";
import { V6_BASE } from "@/lib/v6-routes";
import "./homepage-sections.css";

const AREAS = {
  defense: {
    line: "AI security for mission systems.",
    image: "/home/menu/editorial/aviation.jpg", width: 1600, height: 900,
  },
  "public-sector": {
    line: "Protect AI-enabled operational boundaries.",
    image: "/site/photography/power-grid.jpg", width: 2400, height: 1800,
  },
  fleets: {
    line: "Scope authority around models and equipment.",
    image: "/site/photography/robot-grinding.jpg", width: 2400, height: 1530,
  },
} as const;

function UpRight() {
  return <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true"><path d="M5 15 15 5M5 5h10v10" stroke="currentColor" strokeWidth="1.4" /></svg>;
}

export function PhysicalSystems() {
  const root = useRef<HTMLElement>(null);
  useMediaReady(root);
  return <section ref={root} id="physical-systems" className="home-areas" data-nav-theme="dark" aria-labelledby="home-areas-title" data-media-ready="pending">
    <MediaReadyFallback/>
    <div className="v6-wrap">
      <div className="home-section-head" data-media-copy="">
        <p className="home-eyebrow">Our application areas</p>
        <h2 id="home-areas-title">AI security in the physical world.</h2>
      </div>
      <div className="home-areas__grid">
        {PRIMARY_SECTORS.map((sector, index) => {
          const area = AREAS[sector.slug as keyof typeof AREAS];
          const titleId = `home-area-${sector.slug}`;
          return <Link key={sector.slug} href={sector.href} className="home-area" data-lead={index === 0 || undefined} aria-labelledby={titleId} data-media-ready="pending">
            <span className="home-area__media" aria-hidden="true">
              <Image src={area.image} alt="" width={area.width} height={area.height} sizes="(max-width: 760px) 100vw, 60vw" loading="lazy" />
            </span>
            <div className="home-area__caption" data-media-copy="">
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
  const root = useRef<HTMLElement>(null);
  useMediaReady(root);
  const documentation = photograph("hardwareInspection");
  const platform = photograph("networkEngineer");
  return <section ref={root} className="home-engineering" data-nav-theme="dark" aria-labelledby="home-engineering-title" data-media-ready="pending">
    <MediaReadyFallback/>
    <div className="v6-wrap">
      <div className="home-section-head home-section-head--split" data-media-copy="">
        <h2 id="home-engineering-title">Define the boundary.<br />Build the control.</h2>
        <p>Understand the AI workload, the resources it can reach and the evidence needed to investigate its behavior.</p>
      </div>
      <div className="home-engineering__links">
        <Link href={`${V6_BASE}/zero-trust`} className="home-resource" data-media-ready="pending">
          <div className="home-resource__image"><Image src={documentation.src} alt={documentation.alt} width={documentation.w} height={documentation.h} sizes="(max-width: 760px) 100vw, 45vw" loading="lazy" /></div>
          <div data-media-copy=""><p className="home-eyebrow">Zero trust</p><h3>Authority must be explicit.</h3><span>Identity, permissions and separate approval <UpRight /></span></div>
        </Link>
        <Link href={`${V6_BASE}/platform`} className="home-resource" data-media-ready="pending">
          <div className="home-resource__image"><Image src={platform.src} alt={platform.alt} width={platform.w} height={platform.h} sizes="(max-width: 760px) 100vw, 45vw" loading="lazy" /></div>
          <div data-media-copy=""><p className="home-eyebrow">The product direction</p><h3>The work behind the controls.</h3><span>Private foundations and the next integrations <UpRight /></span></div>
        </Link>
      </div>
    </div>
  </section>;
}
