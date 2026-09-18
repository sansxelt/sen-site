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
  ["Partner", "Reddit"],
  ["Established", "September 14, 2026"],
  ["Focus", "Audience reach through Reddit Ads"],
] as const;

export default function RedditPartnershipPage() {
  return (
    <main className="v6-pr">
      <div className="v6-wrap">
        <header className="v6-pr__mast">
          <p className="v6-pr__index">Partnership record</p>
          <p className="v6-pr__date">September 14, 2026</p>
        </header>

        <section className="v6-pr__hero" aria-labelledby="partnership-title">
          <div className="v6-pr__identity">
            <p className="v6-pr__overline">Vraelis and Reddit</p>
            <h1 id="partnership-title">A partnership built around reaching the right audiences.</h1>
          </div>

          <div className="v6-pr__introduction">
            <p>
              Vraelis partnered with Reddit to build its presence and connect with relevant audiences through Reddit Ads.
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
        </section>

        <dl className="v6-pr__facts">
          {FACTS.map(([term, value], index) => (
            <div className="v6-pr__fact" key={term}>
              <dt><span>{String(index + 1).padStart(2, "0")}</span>{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <section className="v6-pr__record" aria-labelledby="record-heading">
          <p className="v6-pr__record-label">The record</p>
          <div className="v6-pr__record-copy">
            <h2 id="record-heading">What the relationship covers.</h2>
            <p>
              The partnership supports Vraelis&apos;s audience development and advertising work on Reddit. Public campaign work and measured outcomes will be added here when they exist.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
