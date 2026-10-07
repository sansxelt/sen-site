"use client";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { V6_BASE } from "@/lib/v6-routes";
import { MediaReadyFallback, useMediaReady } from "./media-ready";
import "./security-home.css";

export function SecurityFocus() {
  return <section className="security-home" aria-labelledby="security-home-focus" data-nav-theme="dark">
    <div className="v6-wrap">
      <div className="home-section-head home-section-head--split">
        <div><p className="home-eyebrow">The security boundary</p><h2 id="security-home-focus">An AI output<br />is a proposal.</h2></div>
        <p>What it may access or change needs a separate security decision. We are building around explicit authority, model integrity and inspectable evidence.</p>
      </div>
      <div className="security-home__controls">
        {[
          ["01", "Authority", "Who is requesting access, to which resource, for which action?", "/zero-trust"],
          ["02", "Integrity", "Does the workload match the reviewed model and configuration?", "/problems"],
          ["03", "Evidence", "What supports the decision, and what remains unobserved?", "/recorded-evidence"],
        ].map(([number, title, body, href]) => <Link key={title} href={`${V6_BASE}${href}`}>
          <span>{number}</span><h3>{title}</h3><p>{body}</p>
        </Link>)}
      </div>
    </div>
  </section>;
}

export function SecurityDevelopment() {
  const root = useRef<HTMLElement>(null);
  useMediaReady(root);
  return <section ref={root} className="security-home security-home--development" aria-labelledby="security-home-development" data-nav-theme="dark" data-media-ready="pending">
    <MediaReadyFallback />
    <div className="v6-wrap security-home__split">
      <div className="security-home__photo"><Image src="/site/photography/hardware-inspection.jpg" alt="A technician inspecting a printed circuit board. Illustrative photography." width={2400} height={1600} sizes="(max-width:760px) 100vw, 48vw" loading="lazy" /></div>
      <div data-media-copy="">
        <p className="home-eyebrow">Private development</p>
        <h2 id="security-home-development">Build the control.<br />Prove the boundary.</h2>
        <p>A tested policy core and recorded-evidence evaluator form the current foundation. Trusted identity, artifact verification and live enforcement are the next integration work.</p>
        <Link href={`${V6_BASE}/beta`}>Development status</Link>
      </div>
    </div>
  </section>;
}
