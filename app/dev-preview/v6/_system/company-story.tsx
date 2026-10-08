"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { V6_BASE } from "@/lib/v6-routes";
import { SUPPORT } from "./positioning";
import { COMPANY_SECURITY_AREAS as scope, COMPANY_SCOPE_STATUS } from "../_content/company-direction";
import "./company-story.css";

export function StoryArrow() {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 19 19 5M5 5h14v14" /></svg>;
}

/** Editorial scope navigation, not a product interface or a claim of deployed coverage. */
export function CompanyStory() {
  const [selected, setSelected] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (index + 1) % scope.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = (index + scope.length - 1) % scope.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = scope.length - 1;
    else return;
    event.preventDefault();
    setSelected(next);
    tabs.current[next]?.focus();
  };
  return <section id="company-scope" className="company-story v6-wrap" aria-labelledby="company-story-title">
    <noscript><style>{`
      .company-story__tabs { display:none!important; }
      .company-story__panels { display:block!important; }
      @layer base { .company-story__panels>[role=tabpanel] { display:block!important; margin-bottom:28px; } }
    `}</style></noscript>
    <header className="company-story__head">
      <div><p className="home-eyebrow">Vraelis</p><h2 id="company-story-title">Independent software.<br />System-specific security.</h2></div>
      <div><p>{SUPPORT}</p><Link className="story-link" href={`${V6_BASE}/company`}>About <span><StoryArrow /></span></Link></div>
    </header>
    <div className="company-story__scope">
      <div className="company-story__tabs" role="tablist" aria-label="Security areas">
        {scope.map((item, index) => <button key={item.title} ref={element => { tabs.current[index] = element; }} type="button" role="tab" id={`scope-tab-${index}`} aria-controls={`scope-panel-${index}`} aria-selected={selected === index} tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={event => move(event, index)}>
          <span className="company-story__number" aria-hidden="true">0{index + 1}</span><span>{item.title}</span><span className="company-story__arrow"><StoryArrow /></span>
        </button>)}
      </div>
      <div className="company-story__panels">
        {scope.map((item, index) => <div key={item.title} role="tabpanel" id={`scope-panel-${index}`} aria-labelledby={`scope-tab-${index}`} hidden={selected !== index} tabIndex={0}>
          <p className="home-eyebrow">{item.phase}</p><p className="company-story__detail">{item.body}</p>
          <Link className="story-link" href={`${V6_BASE}${item.href}`}>Explore this area <span><StoryArrow /></span></Link>
        </div>)}
      </div>
    </div>
    <p className="company-story__status">{COMPANY_SCOPE_STATUS}</p>
  </section>;
}

export const RELEASE_SCOPE = [
  { title: "The exact release", body: "Model artifact, preprocessing and configuration." },
  { title: "The right authority", body: "Approval bound to the release and its destination." },
  { title: "The receiving runtime", body: "Compatibility checks and the version the managed service reports loading." },
  { title: "The acceptance record", body: "Accepted, failed or uncertain activation, with recovery evidence." },
] as const;

export function ContourSpotlight() {
  return <section id="first-product" className="contour-spotlight v6-wrap" aria-labelledby="contour-spotlight-title">
    <div className="contour-spotlight__intro">
      <p className="home-eyebrow">Our first product / Private development</p>
      <h2 id="contour-spotlight-title">Vraelis Contour</h2>
      <p className="contour-spotlight__line">Know what you are releasing.</p>
      <p className="contour-spotlight__audience">For release, platform and security engineers at robotics suppliers and system integrators.</p>
      <Link className="story-link story-link--button" href={`${V6_BASE}/contour`}>Explore Vraelis Contour <span><StoryArrow /></span></Link>
    </div>
    <div className="contour-spotlight__scope">
      <p className="home-eyebrow">Development scope</p>
      <ol>{RELEASE_SCOPE.map((item, index) => <li key={item.title}><span aria-hidden="true">0{index + 1}</span><div><h3>{item.title}</h3><p>{item.body}</p></div></li>)}</ol>
    </div>
  </section>;
}
