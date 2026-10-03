"use client";

// The actual Larkspur record, presented as editorial copy and real pictures.
// Photography describes the subject; evidence is the run's unaltered screenshot.
import { EditorialLink } from "./ui";
import { Photograph, PicturePlate } from "./picture-plate";
import { STRIKE_LINKS, type StrikeRecord, type StrikeStep } from "../_content/strike-links";
import { SOLUTIONS_HREF } from "../_content/sectors";
import "./strike-story.css";
export { STRIKE_LINKS };
export type { StrikeRecord, StrikeStep };
type Chapter = { eyebrow: string; t: string; d: string; link?: { href: string; label: string } };

export function StrikeStory({ record: r, chapters, caption }: { record: StrikeRecord; chapters: Chapter[]; caption: string }) {
  const run = r.run;
  return (
    <section id="how-a-check-works" className="v6-story v6-dark" aria-labelledby="v6-story-h" data-nav-dark data-nav-theme="dark">
      <div className="v6-wrap">
        <h2 id="v6-story-h" className="v6-story__label">How a check works</h2>
        <ol className="v6-story__chapters">
          {chapters.map((c, i) => <li className="v6-story__chapter" key={c.eyebrow}>
            <div className="v6-story__text">
              <p className="v6-story__eyebrow"><span data-no-translate>{String(i + 1).padStart(2, "0")}</span><span>{c.eyebrow}</span></p>
              <h3>{c.t}</h3>
              <p>{c.d}</p>
              {c.link ? <EditorialLink href={c.link.href}>{c.link.label}</EditorialLink> : null}
            </div>
            {i < 2 ? <Photograph name={i === 0 ? "groundstation" : "signup"} /> : run ? <PicturePlate
              src={i === 2 ? run.shots.run : run.shots.failure}
              alt={i === 2 ? "Larkspur's simulated mission console as captured by the real browser run." : "The contact list from the run: T-1 and the civilian bus T-3 both show Cleared to engage."}
              evidence
              caption={i === 2 ? "From a check of Larkspur, a simulated mission console Vraelis built itself." : "The contact list, cut from the run's own screenshot. T-3 is the civilian bus."}
              credit={<span data-no-translate>{run.id} / {run.recorded} UTC</span>}
            /> : null}
          </li>)}
        </ol>
        <div className="v6-story__foot"><p>{caption}</p><EditorialLink href={SOLUTIONS_HREF}>See every sector</EditorialLink></div>
      </div>
    </section>
  );
}
