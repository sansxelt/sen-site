"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { V6_BASE } from "@/lib/v6-routes";
import "./audience-bar.css";

// Intended audiences, not a list of customers or supported integrations.
const audiences = [
  { name: "Robotics suppliers", href: "/solutions/fleets" },
  { name: "Autonomy developers", href: "/solutions/fleets" },
  { name: "System integrators", href: "/integrators" },
  { name: "Defense engineering teams", href: "/solutions/defense" },
  { name: "Industrial automation teams", href: "/infrastructure" },
  { name: "Utility operators", href: "/infrastructure" },
  { name: "Transport operators", href: "/infrastructure" },
] as const;

export function AudienceBar() {
  const root = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(false);
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const sync = () => setEligible(visible && !document.hidden && !reduced.matches);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(element);
    reduced.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => { observer.disconnect(); reduced.removeEventListener("change", sync); document.removeEventListener("visibilitychange", sync); };
  }, []);

  return <aside ref={root} className="audience-bar" aria-label="Intended audiences" data-running={eligible && !paused}>
    <div className="audience-bar__heading"><p>Who we’re building for</p><button type="button" className="audience-bar__toggle" aria-label={paused ? "Resume audience rotation" : "Pause audience rotation"} aria-pressed={paused} onClick={() => setPaused(value => !value)}><svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">{paused ? <path d="m4 2 6 4-6 4Z" /> : <path d="M3 2h2v8H3zm4 0h2v8H7z" />}</svg></button></div>
    <div className="audience-bar__viewport"><div className="audience-bar__track">
      {[false, true].map(duplicate => <ul className="audience-bar__group" key={String(duplicate)} aria-hidden={duplicate || undefined} data-duplicate={duplicate || undefined}>{audiences.map(audience => <li key={audience.name}><Link href={`${V6_BASE}${audience.href}`} tabIndex={duplicate ? -1 : undefined}>{audience.name}<svg aria-hidden="true" width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M4 12 12 4M4 4h8v8" stroke="currentColor" /></svg></Link></li>)}</ul>)}
    </div></div>
  </aside>;
}
