import Link from "next/link";
import { JoinBand, Wrap } from "../_kit/blocks";
import { v8meta } from "../_kit/meta";
import { href } from "../_kit/site";
import { ARTICLES } from "../_content/articles";
import { formatDay } from "../_content/news";
import { ArticlePicture } from "./picture";
import "./news.css";

export const metadata = v8meta({
  title: "News",
  description: "Articles from Vraelis on AI security, model integrity and Vraelis Contour, newest first.",
  path: "/news",
});

// x.ai's news index: the newest article large, the rest as picture-first cards (founder, 2026-10-18: "news should be
// its own with its own fresh articles"). The dated record of changes stays on /changelog.
export default function News() {
  const [lead, ...rest] = ARTICLES;
  return (
    <div className="nws">
      <section className="v8-page-hero nws-hero">
        <Wrap>
          <div className="v8-head" style={{ maxWidth: 760 }}>
            <span className="v8-eyebrow">News</span>
            <h1 className="v8-h1">News from Vraelis.</h1>
          </div>
        </Wrap>
      </section>

      <section aria-label="Latest article">
        <Wrap>
          <Link href={href(`/news/${lead.slug}`)} className="nws-lead">
            <div className="nws-lead__media"><ArticlePicture image={lead.image} priority /></div>
            <div className="nws-lead__text">
              <p className="nws-meta"><span>{lead.kind}</span><time dateTime={lead.date}>{formatDay(lead.date)}</time></p>
              <h2 className="nws-lead__title">{lead.title}</h2>
              <p className="v8-lead">{lead.dek}</p>
              <span className="nws-read">Read article<span className="v8-arrow" aria-hidden="true" /></span>
            </div>
          </Link>
        </Wrap>
      </section>

      <section className="v8-section v8-section--tight" aria-label="More articles">
        <Wrap>
          <div className="nws-grid">
            {rest.map((a) => (
              <Link key={a.slug} href={href(`/news/${a.slug}`)} className="nws-card">
                <div className="nws-card__media"><ArticlePicture image={a.image} /></div>
                <p className="nws-meta"><span>{a.kind}</span><time dateTime={a.date}>{formatDay(a.date)}</time></p>
                <h3 className="nws-card__title">{a.title}</h3>
              </Link>
            ))}
          </div>
        </Wrap>
      </section>

      <JoinBand />
    </div>
  );
}
