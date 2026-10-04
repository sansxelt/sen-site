"use client";

// The actual Larkspur record, presented as editorial copy and real pictures.
// Photography describes the subject; evidence is the run's unaltered screenshot.
import { useEffect, useRef } from "react";
import { EditorialLink } from "./ui";
import { PicturePlate } from "./picture-plate";
import { MissionDemo } from "./mission-demo";
import { STRIKE_LINKS, type StrikeRecord, type StrikeStep } from "../_content/strike-links";
import { SOLUTIONS_HREF } from "../_content/sectors";
import "./strike-story.css";
export { STRIKE_LINKS };
export type { StrikeRecord, StrikeStep };
type Chapter = { eyebrow: string; t: string; d: string; link?: { href: string; label: string } };

export function StrikeStory({ record: r, chapters }: { record: StrikeRecord; chapters: Chapter[]; caption: string }) {
  const run = r.run;
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rows = el.querySelectorAll(".v6-story__chapter");
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.setAttribute("data-entered", "true"); observer.unobserve(entry.target); } });
    }, {threshold: .12});
    el.dataset.motion = "true";
    rows.forEach(row => observer.observe(row));
    return () => observer.disconnect();
  }, []);
  return (
    <section ref={root} id="how-a-check-works" className="v6-story v6-dark" aria-labelledby="v6-story-h" data-nav-dark data-nav-theme="dark">
      <div className="v6-wrap">
        <div className="v6-story__heading">
          <h2 id="v6-story-h" className="v6-story__label">One confirmation.<br />Two contacts cleared.</h2>
          <p className="v6-story__intro">Vraelis checked a simulated drone mission console. Confirming T-1 also cleared a civilian contact. The browser caught it.</p>
        </div>
        <MissionDemo />
        <ol className="v6-story__chapters">
          {chapters.map((c) => <li className="v6-story__chapter" key={c.eyebrow}>
            <div className="v6-story__text">
              <h3>{c.t}</h3>
              <p>{c.d}</p>
              {c.link ? <EditorialLink href={c.link.href}>{c.link.label}</EditorialLink> : null}
            </div>
          </li>)}
        </ol>
        {run && <details className="v6-story__evidence">
          <summary>Open the original evidence <span aria-hidden>↗</span></summary>
          <p>A recorded check of Larkspur on <time>{run.recorded}</time>. The film above reproduces its confirmation step in the current simulation.</p>
          <div className="v6-story__proof">
            <PicturePlate src={run.shots.run} alt="Original mission-console screenshot from the recorded check." evidence />
            <PicturePlate src={run.shots.failure} alt="Original contact list: the civilian bus T-3 also shows Cleared to engage." evidence />
          </div>
          <p><a href="/home/systems-film-sources.txt">Homepage film sources</a></p>
          <p className="v6-story__record" data-no-translate>{run.id}</p>
        </details>}
        <div className="v6-story__foot"><EditorialLink href={SOLUTIONS_HREF}>See every sector</EditorialLink></div>
      </div>
    </section>
  );
}
