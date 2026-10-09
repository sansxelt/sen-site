"use client";

import { photograph, type PhotographKey } from "../_content/photography";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { V6_BASE } from "@/lib/v6-routes";

import { MediaReadyFallback, useMediaReady } from "./media-ready";
import { Reveal } from "./ui";
import "./resource-collection.css";

const resources: {key:string;eyebrow:string;title:string;body:string;href:string;photo:PhotographKey}[] = [
  {key:"research",eyebrow:"Research",title:"Understand the threats. Define the test.",body:"Explore the security questions shaping our development and the guidance behind them.",href:"/research",photo:"microscopeInspection"},
  {key:"documentation",eyebrow:"Documentation",title:"Read the engineering scope.",body:"Read the current scope, concepts and integration boundaries.",href:"/docs",photo:"codeReview"},
  {key:"development",eyebrow:"Development status",title:"See what is being built.",body:"Explore our development progress and the integration work ahead.",href:"/beta",photo:"runtimeServers"},
];

/** Public reading destinations, never simulated product output or customer proof. */
export function ResourceCollection({compact=false,exclude}:{compact?:boolean;exclude?:string}) {
  const root=useRef<HTMLElement>(null);
  useMediaReady(root);
  const visible=resources.filter(resource=>resource.key!==exclude);
  return <section ref={root} className="resource-collection v6-wrap" data-compact={compact||undefined} data-media-ready="pending" aria-labelledby="resource-collection-title">
    <MediaReadyFallback/>
    <Reveal><header className="resource-collection__head" data-media-copy=""><p className="home-eyebrow">Explore</p><h2 id="resource-collection-title">Research and engineering.</h2><p className="resource-collection__media-note">Editorial photography.</p></header></Reveal>
    <div className="resource-collection__grid" data-count={visible.length}>
      {visible.map((resource,index)=>{const photo=photograph(resource.photo);return <Reveal key={resource.key} i={index} media>
        <Link href={`${V6_BASE}${resource.href}`} className="resource-collection__card" data-media-ready="pending">
          <div className="resource-collection__photo"><Image src={photo.src} alt={photo.alt} width={photo.w} height={photo.h} sizes="(max-width:700px) 100vw, (max-width:1100px) 50vw, 40vw" loading="lazy"/></div>
          <div className="resource-collection__caption" data-media-copy=""><p>{resource.eyebrow}</p><h3>{resource.title}</h3></div>
          <p className="resource-collection__body" data-media-copy="">{resource.body}</p>
        </Link>
      </Reveal>})}
    </div>
  </section>;
}
