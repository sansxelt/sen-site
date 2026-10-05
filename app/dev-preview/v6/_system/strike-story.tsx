import { MissionDemo } from "./mission-demo";
import { STRIKE_LINKS, type StrikeRecord, type StrikeStep } from "../_content/strike-links";
import "./strike-story.css";
export { STRIKE_LINKS };
export type { StrikeRecord, StrikeStep };
type Chapter = { eyebrow: string; t: string; d: string; link?: { href: string; label: string } };

export function StrikeStory({ record }: { record: StrikeRecord; chapters: Chapter[]; caption: string }) {
  return (
    <section id="how-a-check-works" className="v6-story v6-dark" aria-labelledby="v6-story-h" data-nav-dark data-nav-theme="dark" data-record={record.run?.id}>
      <div className="v6-wrap">
        <div className="v6-story__heading">
          <h2 id="v6-story-h" className="v6-story__label">One confirmation.<br />Two contacts cleared.</h2>
          <p className="v6-story__intro">The browser workflow finds mistakes in an operator’s control panel. In this recorded simulation, confirming T-1 also cleared a civilian contact. It shows what the panel did; the recording workflow compares supplied reports across sources.</p>
        </div>
        <MissionDemo />
      </div>
    </section>
  );
}
