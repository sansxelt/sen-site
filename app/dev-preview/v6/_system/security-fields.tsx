"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { V6_BASE } from "@/lib/v6-routes";
import { photograph, type PhotographKey } from "../_content/photography";
import { MediaReadyFallback, useMediaReady } from "./media-ready";
import "./security-fields.css";

// Areas of development and research, illustrated with licensed photographs.
// These are not product screenshots, benchmark results or deployment evidence.
const fields: { title:string; body:string; href:string; photo:PhotographKey }[] = [
  { title:"Model integrity", body:"Investigate model provenance, unauthorized changes and the software supporting a deployed workload.", href:"/model-integrity", photo:"networkEngineer" },
  { title:"Adversarial threats", body:"Study manipulated inputs and poisoned data against the model, sensor and conditions involved.", href:"/adversarial-security", photo:"robotDetail" },
  { title:"Machine trust", body:"Establish workload identity and explicit permissions at the resource and action boundary.", href:"/zero-trust", photo:"serverRack" },
  { title:"Security evidence", body:"Connect findings to source observations, reviewed criteria and the limits of the available recording.", href:"/recorded-evidence", photo:"groundstation" },
];

export function SecurityFields() {
  const root = useRef<HTMLElement>(null);
  useMediaReady(root);
  return <section ref={root} className="security-fields v6-wrap" aria-labelledby="security-fields-title" data-media-ready="pending">
    <MediaReadyFallback />
    <header className="home-section-head" data-media-copy="">
      <p className="home-eyebrow">Our work</p>
      <h2 id="security-fields-title">Security around the intelligence.</h2>
      <p className="security-fields__intro">Four connected areas of private development and research. Each has a distinct threat, a control to investigate and a result to test.</p>
    </header>
    <div className="security-fields__grid">
      {fields.map(field => {
        const photo = photograph(field.photo);
        return <Link key={field.href} href={`${V6_BASE}${field.href}`} className="security-fields__card" data-media-ready="pending">
          <div className="security-fields__image"><Image src={photo.src} alt={photo.alt} width={photo.w} height={photo.h} sizes="(max-width:700px) 100vw, (max-width:1100px) 45vw, 23vw" loading="lazy" /></div>
          <div className="security-fields__copy" data-media-copy=""><h3>{field.title}</h3><p>{field.body}</p><span>Explore this area</span></div>
        </Link>;
      })}
    </div>
    <p className="security-fields__credit">Illustrative photography · <a href="/site/photography/CREDITS.md">Sources</a></p>
  </section>;
}
