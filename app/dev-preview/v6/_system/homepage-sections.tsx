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
    line: "Model integrity and machine trust for robotics.",
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
        <h2 id="home-engineering-title">Independent software.<br />System-specific security.</h2>
        <p>We are developing security around AI models, data and machine identities. The controls must fit the system, its threats and its operating constraints.</p>
      </div>
      <div className="home-engineering__links">
        <Link href={`${V6_BASE}/research`} className="home-resource" data-media-ready="pending">
          <div className="home-resource__image"><Image src={documentation.src} alt={documentation.alt} width={documentation.w} height={documentation.h} sizes="(max-width: 760px) 100vw, 45vw" loading="lazy" /></div>
          <div data-media-copy=""><p className="home-eyebrow">Research</p><h3>Start with a threat you can test.</h3><p>Model tampering, manipulated inputs and unauthorized actions need distinct evaluations. Measure protection alongside missed attacks, false alarms and operating cost.</p></div>
        </Link>
        <Link href={`${V6_BASE}/contour`} className="home-resource" data-media-ready="pending">
          <div className="home-resource__image"><Image src={platform.src} alt={platform.alt} width={platform.w} height={platform.h} sizes="(max-width: 760px) 100vw, 45vw" loading="lazy" /></div>
          <div data-media-copy=""><p className="home-eyebrow">Vraelis Contour</p><h3>Know what you are releasing.</h3><p>Model release security for robotics suppliers and system integrators. Explore our first product direction and its private engineering foundation.</p></div>
        </Link>
      </div>
    </div>
  </section>;
}

export function ApplicationAreaLinks() {
  const root = useRef<HTMLDivElement>(null);
  useMediaReady(root);
  return <div ref={root} className="application-area-cards">
    <MediaReadyFallback/>
    {PRIMARY_SECTORS.map(sector => <Link key={sector.slug} href={sector.href} className="home-resource application-area-card" data-media-ready="pending">
      <div className="home-resource__image"><Image src={sector.pics.card1610} alt="" width={2400} height={1800} sizes="(max-width:760px) 100vw,45vw"/></div>
      <div className="application-area-card__caption" data-media-copy=""><h2>{sector.label}</h2><p>{sector.line}</p></div>
    </Link>)}
  </div>;
}
