import Link from "next/link";
import { SITE_ORIGIN } from "@/lib/docs-host";
import { Wrap } from "../_kit/blocks";
import { v8meta } from "../_kit/meta";
import { href } from "../_kit/site";
import { ARTICLE_KINDS, ARTICLES, readingMinutes, type Article } from "../_content/articles";
import { formatDay } from "../_content/news";
import { NewsIndex } from "./client";
import { Cover } from "./picture";
import "./news.css";

const META = v8meta({
  title: "News",
  description: "Product updates, research and perspectives from Vraelis on trusted AI in the physical world.",
  path: "/news",
});
export const metadata = { ...META, alternates: { ...META.alternates, types: { "application/rss+xml": [{ url: `${SITE_ORIGIN}/news/rss.xml`, title: "Vraelis News" }] } } };

const monthOf = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** A featured story: its cover with the category and headline set over it (Scale's blog, x.ai's news). */
function Feature({ a, size, priority }: { a: Article; size: "lead" | "wide" | "small"; priority?: boolean }) {
  return (
    <Link href={href(`/news/${a.slug}`)} className={`nws-feat nws-feat--${size}`}>
      <Cover a={a} priority={priority} sizes={size === "lead" ? "(max-width: 900px) 100vw, 760px" : "(max-width: 900px) 100vw, 520px"} />
      <span className="nws-feat__chip">{a.kind}</span>
      <span className="nws-feat__text">
        <time dateTime={a.date}>{formatDay(a.date)}</time>
        <b>{a.title}</b>
        {size === "lead" ? <span>{a.dek}</span> : null}
      </span>
    </Link>
  );
}

// The newsroom (founder, 2026-10-18: a full, structured news section with its own fresh stories and imagery; study
// scale.com and x.ai). Featured mosaic, then every story by category and search, then press and the feed.
export default function News() {
  const [lead, second, third, fourth] = ARTICLES;
  return (
    <div className="nws">
      <section className="v8-page-hero nws-hero">
        <Wrap>
          <div className="nws-hero__row">
            <div className="v8-head" style={{ maxWidth: 760 }}>
              <span className="v8-eyebrow">Newsroom</span>
              <h1 className="v8-h1">News</h1>
              <p className="v8-lead">Product updates, research and perspectives on trusted AI in the physical world.</p>
            </div>
            <a className="nws-rss" href={href("/news/rss.xml")}>RSS feed</a>
          </div>
        </Wrap>
      </section>

      <section aria-label="Featured stories">
        <Wrap>
          <div className="nws-mosaic">
            <Feature a={lead} size="lead" priority />
            <Feature a={second} size="wide" />
            <Feature a={third} size="small" />
            <Feature a={fourth} size="small" />
          </div>
        </Wrap>
      </section>

      <section className="v8-section" aria-labelledby="nws-all">
        <Wrap>
          <h2 id="nws-all" className="v8-h2 nws-sec-title">All stories</h2>
          <NewsIndex kinds={ARTICLE_KINDS} rows={ARTICLES.map((a) => ({
            slug: a.slug, kind: a.kind, date: a.date, day: formatDay(a.date), month: monthOf(a.date), title: a.title, dek: a.dek, minutes: readingMinutes(a),
          }))} />
        </Wrap>
      </section>

      <section className="v8-section v8-rule" aria-labelledby="nws-press">
        <Wrap>
          <div className="nws-press">
            <div>
              <h2 id="nws-press" className="v8-h2">Press and media</h2>
              <p className="v8-lead">For interviews, background or questions about a story, write to us through the contact form. Follow new stories by RSS.</p>
            </div>
            <div className="nws-press__links">
              <Link className="v8-btn v8-btn--solid" href={href("/contact")}>Contact us<span className="v8-arrow" aria-hidden="true" /></Link>
              <a className="v8-btn v8-btn--soft" href={href("/news/rss.xml")}>RSS feed</a>
            </div>
          </div>
        </Wrap>
      </section>
    </div>
  );
}
