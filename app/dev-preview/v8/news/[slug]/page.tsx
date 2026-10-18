import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_ORIGIN } from "@/lib/docs-host";
import { TextLink, Wrap } from "../../_kit/blocks";
import { v8meta } from "../../_kit/meta";
import { href } from "../../_kit/site";
import { ARTICLES, articleBySlug, readingMinutes } from "../../_content/articles";
import { formatDay } from "../../_content/news";
import { CopyLink } from "../client";
import { Cover } from "../picture";
import "../news.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = articleBySlug(slug);
  if (!a) return { title: { absolute: "Error | Vraelis" }, robots: { index: false, follow: false } };
  const meta = v8meta({ title: a.title, description: a.dek, path: `/news/${slug}`, tab: "News" });
  // A shared story shows its own cover and dates, not the generic site card.
  const image = { url: `${SITE_ORIGIN}${a.cover.src}`, width: a.cover.w, height: a.cover.h, alt: a.cover.alt };
  return {
    ...meta,
    openGraph: { ...meta.openGraph, type: "article", publishedTime: a.date, section: a.kind, images: [image] },
    twitter: { ...meta.twitter, card: "summary_large_image", images: [image.url] },
  };
}

const anchor = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** One story: kicker, headline, byline row, cover, In short, the sections (with contents when there are several),
 *  what it does not claim, where to go next, then the neighbouring and related stories. */
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = articleBySlug(slug);
  if (!a) notFound();
  const i = ARTICLES.indexOf(a);
  const newer = ARTICLES[i - 1], older = ARTICLES[i + 1];
  const related = [...ARTICLES.filter((x) => x !== a && x.kind === a.kind), ...ARTICLES.filter((x) => x !== a && x.kind !== a.kind)].slice(0, 3);
  const headed = a.sections.filter((s) => s.heading);
  const ld = {
    "@context": "https://schema.org", "@type": "NewsArticle", headline: a.title, description: a.dek,
    datePublished: a.date, dateModified: a.date, image: [`${SITE_ORIGIN}${a.cover.src}`],
    author: { "@type": "Organization", name: "Vraelis", url: SITE_ORIGIN }, publisher: { "@type": "Organization", name: "Vraelis", url: SITE_ORIGIN },
    mainEntityOfPage: `${SITE_ORIGIN}/news/${a.slug}`, articleSection: a.kind,
  };
  return (
    <div className="nws">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <article>
        <header className="v8-page-hero nws-article__head">
          <Wrap size="text">
            <p className="nws-meta"><Link href={href("/news")}>News</Link><Link href={href(`/news?category=${a.kind}`)}>{a.kind}</Link></p>
            <h1 className="v8-h1 nws-article__title">{a.title}</h1>
            <p className="v8-lead">{a.dek}</p>
            <div className="nws-byline">
              <p className="nws-meta"><span>Vraelis</span><time dateTime={a.date}>{formatDay(a.date)}</time><span>{readingMinutes(a)} min read</span></p>
              <CopyLink />
            </div>
          </Wrap>
        </header>
        <Wrap>
          <div className="nws-article__media"><Cover a={a} priority sizes="(max-width: 1280px) 100vw, 1280px" /></div>
        </Wrap>
        <Wrap>
          <div className={headed.length >= 3 ? "nws-article__layout" : "nws-article__layout nws-article__layout--single"}>
            {headed.length >= 3 ? (
              <nav className="nws-toc" aria-label="In this story">
                <p>In this story</p>
                <ol>{headed.map((s) => <li key={s.heading}><a href={`#${anchor(s.heading!)}`}>{s.heading}</a></li>)}</ol>
              </nav>
            ) : null}
            <div className="nws-article__body">
              <aside className="nws-box" aria-label="In short">
                <p className="nws-box__title">In short</p>
                <ul>{a.inShort.map((l) => <li key={l}>{l}</li>)}</ul>
              </aside>
              {a.sections.map((s, k) => (
                <section key={s.heading ?? k} aria-labelledby={s.heading ? anchor(s.heading) : undefined}>
                  {s.heading ? <h2 id={anchor(s.heading)} className="nws-h2">{s.heading}</h2> : null}
                  {s.paras.map((p) => <p key={p}>{p}</p>)}
                </section>
              ))}
              {a.notClaimed?.length ? (
                <aside className="nws-box nws-box--quiet" aria-label="What this does not claim">
                  <p className="nws-box__title">What this does not claim</p>
                  <ul>{a.notClaimed.map((l) => <li key={l}>{l}</li>)}</ul>
                </aside>
              ) : null}
              {a.links?.length ? <div className="nws-article__links">{a.links.map((l) => <TextLink key={l.to} to={l.to}>{l.label}</TextLink>)}</div> : null}
            </div>
          </div>
        </Wrap>
      </article>

      <nav className="v8-rule" aria-label="Newer and older stories">
        <Wrap>
          <div className="nws-pager">
            {newer ? <Link href={href(`/news/${newer.slug}`)} className="nws-pager__item"><span>Newer</span><b>{newer.title}</b></Link> : <span />}
            {older ? <Link href={href(`/news/${older.slug}`)} className="nws-pager__item nws-pager__item--older"><span>Older</span><b>{older.title}</b></Link> : <span />}
          </div>
        </Wrap>
      </nav>

      <section className="v8-section v8-rule" aria-labelledby="nws-related">
        <Wrap>
          <div className="v8-head--row v8-head" style={{ marginBottom: 22 }}>
            <h2 id="nws-related" className="v8-h2">Related stories</h2>
            <TextLink to="/news" muted>All news</TextLink>
          </div>
          <div className="nws-grid">
            {related.map((x) => (
              <Link key={x.slug} href={href(`/news/${x.slug}`)} className="nws-card">
                <div className="nws-card__media"><Cover a={x} sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 420px" /></div>
                <p className="nws-meta"><span>{x.kind}</span><time dateTime={x.date}>{formatDay(x.date)}</time></p>
                <h3 className="nws-card__title">{x.title}</h3>
                <p className="nws-card__min">{readingMinutes(x)} min read</p>
              </Link>
            ))}
          </div>
        </Wrap>
      </section>
    </div>
  );
}
