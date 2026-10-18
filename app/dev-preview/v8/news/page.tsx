import Link from "next/link";
import { SITE_ORIGIN } from "@/lib/docs-host";
import { Wrap } from "../_kit/blocks";
import { v8meta } from "../_kit/meta";
import { href } from "../_kit/site";
import { ARTICLE_KINDS, ARTICLES, readingMinutes } from "../_content/articles";
import { formatDay } from "../_content/news";
import { NewsGrid } from "./client";
import { Cover } from "./picture";
import "./news.css";

const META = v8meta({
  title: "News",
  description: "Product updates, research and perspectives from Vraelis on AI security and model release integrity.",
  path: "/news",
});
export const metadata = { ...META, alternates: { ...META.alternates, types: { "application/rss+xml": [{ url: `${SITE_ORIGIN}/news/rss.xml`, title: "Vraelis News" }] } } };

const monthOf = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

// The newsroom (founder, 2026-10-18: a full, structured news section with its own fresh articles, after x.ai/news):
// the lead story, every article by category, the archive by month, and where press and feed readers go.
export default function News() {
  const [lead, ...rest] = ARTICLES;
  const months = [...new Set(ARTICLES.map((a) => monthOf(a.date)))];
  return (
    <div className="nws">
      <section className="v8-page-hero nws-hero">
        <Wrap>
          <div className="nws-hero__row">
            <div className="v8-head" style={{ maxWidth: 760 }}>
              <span className="v8-eyebrow">Newsroom</span>
              <h1 className="v8-h1">News</h1>
              <p className="v8-lead">Product updates, research and perspectives on AI security and model release integrity.</p>
            </div>
            <a className="nws-rss" href={href("/news/rss.xml")}>RSS feed</a>
          </div>
        </Wrap>
      </section>

      <section aria-label="Lead story">
        <Wrap>
          <Link href={href(`/news/${lead.slug}`)} className="nws-lead">
            <div className="nws-lead__media"><Cover a={lead} priority sizes="(max-width: 900px) 100vw, 720px" /></div>
            <div className="nws-lead__text">
              <p className="nws-meta"><span>{lead.kind}</span><time dateTime={lead.date}>{formatDay(lead.date)}</time><span>{readingMinutes(lead)} min read</span></p>
              <h2 className="nws-lead__title">{lead.title}</h2>
              <p className="v8-lead">{lead.dek}</p>
              <span className="nws-read">Read the story<span className="v8-arrow" aria-hidden="true" /></span>
            </div>
          </Link>
        </Wrap>
      </section>

      <section className="v8-section v8-section--tight" aria-labelledby="nws-all">
        <Wrap>
          <h2 id="nws-all" className="v8-h2 nws-sec-title">All stories</h2>
          <NewsGrid kinds={ARTICLE_KINDS} cards={rest.map((a) => ({
            slug: a.slug, kind: a.kind, date: a.date, day: formatDay(a.date), title: a.title, minutes: readingMinutes(a),
            cover: <Cover a={a} sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 420px" />,
          }))} />
        </Wrap>
      </section>

      <section className="v8-section v8-rule" aria-labelledby="nws-archive">
        <Wrap>
          <div className="nws-archive">
            <h2 id="nws-archive" className="v8-h2">Archive</h2>
            <div className="nws-archive__months">
              {months.map((m) => (
                <div key={m} className="nws-archive__month">
                  <h3>{m}</h3>
                  <ul>
                    {ARTICLES.filter((a) => monthOf(a.date) === m).map((a) => (
                      <li key={a.slug}>
                        <time dateTime={a.date}>{formatDay(a.date)}</time>
                        <Link href={href(`/news/${a.slug}`)}>{a.title}</Link>
                        <span>{a.kind}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </Wrap>
      </section>

      <section className="v8-section v8-rule" aria-labelledby="nws-press">
        <Wrap>
          <div className="nws-press">
            <div>
              <h2 id="nws-press" className="v8-h2">Press and media</h2>
              <p className="v8-lead">For interviews, background or questions about a story, write to us through the contact form.</p>
            </div>
            <div className="nws-press__links">
              <Link className="v8-btn v8-btn--solid" href={href("/contact")}>Contact us<span className="v8-arrow" aria-hidden="true" /></Link>
              <Link className="v8-btn v8-btn--soft" href={href("/changelog")}>Changelog</Link>
            </div>
          </div>
        </Wrap>
      </section>
    </div>
  );
}
