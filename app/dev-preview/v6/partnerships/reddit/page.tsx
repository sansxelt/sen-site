import { v6meta } from "../../_system/meta";
import "./partnership.css";

export const metadata = v6meta({
  title: "Reddit partnership",
  description:
    "The public record of Vraelis's 2026 advertising partnership with Reddit, focused on reaching and engaging audiences through Reddit Ads.",
  path: "/partnerships/reddit",
  type: "website",
  ogTitle: "Vraelis × Reddit",
  ogDescription: "A 2026 advertising partnership focused on audience reach through Reddit Ads.",
});

const FACTS = [
  ["Relationship", "Advertising partnership"],
  ["Focus", "Audience reach through Reddit Ads"],
  ["Record", "Established September 14, 2026"],
] as const;

export default function RedditPartnershipPage() {
  return (
    <main className="v6-pr" data-nav-dark data-nav-theme="dark">
      <div className="v6-pr__wrap">
        <header className="v6-pr__mast">
          <p className="v6-pr__index">Partnership record · 01</p>
          <p className="v6-pr__date">Vraelis / Reddit / 2026</p>
        </header>

        <section className="v6-pr__hero" aria-labelledby="partnership-title">
          <div className="v6-pr__identity">
            <p className="v6-pr__overline">Audience and advertising</p>
            <h1 id="partnership-title">Vraelis <span>×</span> Reddit</h1>
            <p className="v6-pr__statement">A partnership for reaching the right audiences.</p>
            <p className="v6-pr__introduction">
              Vraelis partnered with Reddit to develop its presence and connect with relevant communities through Reddit Ads.
            </p>
            <div className="v6-pr__links" aria-label="Partnership links">
              <a href="https://www.reddit.com/" target="_blank" rel="noopener noreferrer">
                Visit Reddit <span aria-hidden="true">↗</span>
              </a>
              <a href="https://www.business.reddit.com/" target="_blank" rel="noopener noreferrer">
                Reddit for Business <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>

          <aside className="v6-pr__date-card" aria-label="Partnership established September 14, 2026">
            <div className="v6-pr__orbit" aria-hidden="true">
              <span>V</span>
              <i>×</i>
              <span>R</span>
            </div>
            <div className="v6-pr__date-lockup">
              <p>Established</p>
              <strong>09.14</strong>
              <span>2026</span>
            </div>
          </aside>
        </section>

        <dl className="v6-pr__facts">
          {FACTS.map(([term, value], index) => (
            <div className="v6-pr__fact" key={term}>
              <dt><span>{String(index + 1).padStart(2, "0")}</span>{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

      </div>
    </main>
  );
}
