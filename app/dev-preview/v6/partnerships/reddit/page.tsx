import { v6meta } from "../../_system/meta";
import { MARK_PATH, MARK_VIEWBOX } from "@/lib/brand-mark";
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

function VraelisMark() {
  return <svg viewBox={MARK_VIEWBOX} role="img" aria-label="Vraelis"><path d={MARK_PATH} fill="currentColor" /></svg>;
}

function RedditMark() {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="Reddit">
      <path d="M42.5 18.5 45 8l8.5 2.25" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="55" cy="11" r="4" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M14.5 27.5c4-6.5 10-9.5 17.5-9.5s13.5 3 17.5 9.5c5.5-.75 9.5 2.25 9.5 7 0 3-1.75 5.25-4.5 6.5.25 1 .5 2 .5 3 0 10-10.25 18-23 18S9 54 9 44c0-1 .25-2 .5-3-2.75-1.25-4.5-3.5-4.5-6.5 0-4.75 4-7.75 9.5-7Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="23" cy="39" r="3" fill="currentColor" />
      <circle cx="41" cy="39" r="3" fill="currentColor" />
      <path d="M22 49c3 2.5 6.25 3.75 10 3.75S39 51.5 42 49" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function RedditPartnershipPage() {
  return (
    <main className="v6-pr" data-nav-dark data-nav-theme="dark">
      <div className="v6-pr__wrap">
        <header className="v6-pr__mast">
          <p className="v6-pr__index">Partnership record</p>
          <p className="v6-pr__date">September 14, 2026</p>
        </header>

        <section className="v6-pr__hero" aria-labelledby="partnership-title">
          <div className="v6-pr__identity">
            <div className="v6-pr__marks" aria-label="Vraelis and Reddit">
              <span><VraelisMark /></span>
              <i aria-hidden="true">×</i>
              <span><RedditMark /></span>
            </div>
            <h1 id="partnership-title">Vraelis <span>×</span> Reddit</h1>
          </div>

          <div className="v6-pr__story">
            <p className="v6-pr__overline">Audience and advertising</p>
            <h2>A direct path to relevant communities.</h2>
            <p>
              Vraelis partnered with Reddit to develop its presence and reach engaged audiences through Reddit Ads.
            </p>
            <div className="v6-pr__links" aria-label="Partnership links">
              <a href="https://www.reddit.com/" target="_blank" rel="noopener noreferrer">Visit Reddit <span aria-hidden="true">↗</span></a>
              <a href="https://www.business.reddit.com/" target="_blank" rel="noopener noreferrer">Reddit for Business <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </section>

        <footer className="v6-pr__foot">
          <p>Advertising partnership for audience reach through Reddit Ads.</p>
          <time dateTime="2026-09-14">Established September 14, 2026</time>
        </footer>

      </div>
    </main>
  );
}
