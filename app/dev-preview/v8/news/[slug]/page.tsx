import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TextLink, Wrap } from "../../_kit/blocks";
import { v8meta } from "../../_kit/meta";
import { href } from "../../_kit/site";
import { ARTICLES, articleBySlug } from "../../_content/articles";
import { formatDay } from "../../_content/news";
import { ArticlePicture } from "../picture";
import "../news.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = articleBySlug(slug);
  if (!a) return { title: { absolute: "Error | Vraelis" }, robots: { index: false, follow: false } };
  return v8meta({ title: a.title, description: a.dek, path: `/news/${slug}`, tab: "News" });
}

/** One article: headline, date, picture, body, then where to go next and the other articles. */
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = articleBySlug(slug);
  if (!a) notFound();
  const more = ARTICLES.filter((x) => x.slug !== a.slug).slice(0, 3);
  return (
    <div className="nws">
      <article>
        <header className="v8-page-hero nws-article__head">
          <Wrap size="text">
            <p className="nws-meta"><Link href={href("/news")}>News</Link><span>{a.kind}</span><time dateTime={a.date}>{formatDay(a.date)}</time></p>
            <h1 className="v8-h1 nws-article__title">{a.title}</h1>
            <p className="v8-lead">{a.dek}</p>
          </Wrap>
        </header>
        <Wrap>
          <div className="nws-article__media"><ArticlePicture image={a.image} priority /></div>
        </Wrap>
        <Wrap size="text">
          <div className="nws-article__body">
            {a.body.map((p) => <p key={p}>{p}</p>)}
            {a.links?.length ? <div className="nws-article__links">{a.links.map((l) => <TextLink key={l.to} to={l.to}>{l.label}</TextLink>)}</div> : null}
          </div>
        </Wrap>
      </article>

      <section className="v8-section v8-rule" aria-label="More news">
        <Wrap>
          <div className="v8-head--row v8-head" style={{ marginBottom: 22 }}>
            <h2 className="v8-h2">More news</h2>
            <TextLink to="/news" muted>All news</TextLink>
          </div>
          <div className="nws-grid">
            {more.map((x) => (
              <Link key={x.slug} href={href(`/news/${x.slug}`)} className="nws-card">
                <div className="nws-card__media"><ArticlePicture image={x.image} /></div>
                <p className="nws-meta"><span>{x.kind}</span><time dateTime={x.date}>{formatDay(x.date)}</time></p>
                <h3 className="nws-card__title">{x.title}</h3>
              </Link>
            ))}
          </div>
        </Wrap>
      </section>
    </div>
  );
}
