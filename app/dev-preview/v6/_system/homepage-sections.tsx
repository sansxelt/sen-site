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
            </div>
          </Link>;
        })}
      </div>
      <div className="home-areas__sources"><a href="/home/editorial/CREDITS.md">Illustrative photography · Sources</a></div>
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
          <div data-media-copy=""><p className="home-eyebrow">Zero trust</p><h3>Authority must be explicit.</h3><p>Zero trust informs how we are building AI security: verify identity, limit permissions and reassess authority at the boundary where an action occurs.</p></div>
        </Link>
        <Link href={`${V6_BASE}/platform`} className="home-resource" data-media-ready="pending">
          <div className="home-resource__image"><Image src={platform.src} alt={platform.alt} width={platform.w} height={platform.h} sizes="(max-width: 760px) 100vw, 45vw" loading="lazy" /></div>
          <div data-media-copy=""><p className="home-eyebrow">The product direction</p><h3>The work behind the controls.</h3><p>We are developing cybersecurity for AI-enabled defense, infrastructure and robotics. Explicit authority, controlled changes and evidence engineers can investigate.</p></div>
        </Link>
      </div>
    </div>
  </section>;
}

export function ApplicationAreaLinks() {
  const root = useRef<HTMLDivElement>(null);
  useMediaReady(root);
  return <div ref={root} className="home-engineering__links">
    <MediaReadyFallback/>
    {PRIMARY_SECTORS.map(sector => <Link key={sector.slug} href={sector.href} className="home-resource" data-media-ready="pending">
      <div className="home-resource__image"><Image src={sector.pics.card1610} alt="" width={2400} height={1800} sizes="(max-width:760px) 100vw,45vw"/></div>
      <div data-media-copy=""><h2>{sector.label}</h2><p>{sector.line}</p></div>
    </Link>)}
  </div>;
}
