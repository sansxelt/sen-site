import { notFound } from "next/navigation";
import Link from "next/link";
import { v6meta } from "../../_system/meta";
import { Reveal, Prose, EditorialLink, ProseLink } from "../../_system/ui";
import { V6_BASE } from "@/lib/v6-routes";
import {
  articleBySlug, relatedArticles, publishedArticles, readingMinutes, formatDate,
  type Block,
} from "@/app/rank/research/_articles";
import { robotsMeta } from "@/lib/stealth";

/* THE RESEARCH ARTICLE, IN DESIGN 06.
 *
 * These five articles were the last thing on the site still rendering in the PREVIOUS generation. They were
 * indexed and listed in the sitemap, and design 06's /research is a thesis page with anchors rather than an
 * index, so nothing linked to them: a reader arriving from search landed inside the old company, complete
 * with the old navigation, and had no way back into the new site except the logo.
 *
 * THE CONTENT IS NOT COPIED. Everything here reads app/rank/research/_articles, which stays the single
 * registry. Forking the prose to re-skin it would have created two versions of an authoritative document
 * that must not drift, and that file says exactly why: a reader forgives a landing page for being
 * enthusiastic, they do not forgive a research note for being wrong. So this route is a renderer and
 * nothing else, and `published: false` still means the article does not exist.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return publishedArticles().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = articleBySlug(slug);
  // AN UNRESOLVED SLUG MUST NOT INVITE INDEXING.
  //
  // The component below calls notFound(), and Next answers 200 rather than 404 for a STREAMED response.
  // Metadata is resolved from THIS segment, not from app/not-found.tsx, so the noindex added there never
  // reached these: /docs/<anything> and /research/<anything> answered 200 with index, follow and a
  // not-found body. That is an unbounded indexable surface under two prefixes.
  if (!a) return { title: "Not found", robots: robotsMeta(false) };
  return v6meta({ title: a.title, description: a.summary, path: `/research/${a.slug}`, type: "article" });
}

/** The block renderer. The registry stores structured blocks rather than raw markup precisely so the page
 *  owns typography and no article can inject HTML; every block becomes a React element here, so there is no
 *  path from article content to the DOM that bypasses escaping. Each case maps onto a shape .v6-prose
 *  already styles. */
function BlockView({ b }: { b: Block }) {
  switch (b.t) {
    case "h2": return <h2>{b.text}</h2>;
    case "p": return <p>{b.text}</p>;
    case "quote": return <blockquote>{b.text}</blockquote>;
    case "list": return <ul>{b.items.map((it, i) => <li key={i}>{it}</li>)}</ul>;
    case "code": return (
      <figure>
        {b.label ? <figcaption className="v6-kicker" style={{ marginBottom: 8 }}>{b.label}</figcaption> : null}
        <pre className="v6-code"><code>{b.text}</code></pre>
      </figure>
    );
    // A note QUALIFIES the claim around it. It keeps its own surface so a limit cannot be skimmed past as
    // though it were more body copy.
    case "note": return <p className="v6-note"><b>Note</b>{b.text}</p>;
  }
}

export default async function V6Article({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = articleBySlug(slug);
  // An unpublished article is indistinguishable from one that does not exist. articleBySlug enforces that;
  // this just honours it.
  if (!a) notFound();

  const related = relatedArticles(a.slug, 2);
  const mins = readingMinutes(a);

  return (
    <>
      {/* ONE READING COLUMN, not a hero above a body.
          PageHero sets its heading on the 1200 grid while a reading section is 720 and centred, so using it
          here put the title at x=91 and the first paragraph at x=331. That jog is tolerable on /method,
          where the hero introduces a landing page. On a long-form article the title, the standfirst and the
          prose are one column of text and have to share an edge, which is what the legal pages already do. */}
      <section className="v6-sec v6-phero" data-nav-theme="light">
        <div className="v6-wrap v6-wrap--read">
          <p className="v6-eyebrow v6-phero__k">{`${a.category} / ${formatDate(a.date)} / ${mins} min read`}</p>
          <h1>{a.title}</h1>
          <p className="v6-phero__lead">{a.summary}</p>
        </div>
      </section>

      <section className="v6-sec v6-sec--tight" style={{ paddingTop: 0 }}>
        <div className="v6-wrap v6-wrap--read">
          <Reveal>
            <Prose>
              {a.body.map((b, i) => <BlockView key={i} b={b} />)}
            </Prose>
          </Reveal>

          <Reveal>
            <hr className="v6-rule" style={{ margin: "48px 0 26px" }} />
            <p className="v6-note" style={{ maxWidth: "72ch" }}>
              Written by {a.author}. Research explains why outcome verification is necessary; it is not a
              description of the product. What Vraelis can and cannot do today is on{" "}
              <ProseLink href={`${V6_BASE}/limitations`}>limitations</ProseLink>.
            </p>
          </Reveal>

          {related.length ? (
            <Reveal>
              <div style={{ marginTop: 44 }}>
                <p className="v6-eyebrow">Keep reading</p>
                <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
                  {related.map((r) => (
                    <Link key={r.slug} href={`${V6_BASE}/research/${r.slug}`} className="v6-elink">
                      <span className="v6-elink__t">{r.title}</span>
                      <span className="v6-arw" aria-hidden>&rarr;</span>
                    </Link>
                  ))}
                </div>
              </div>
            </Reveal>
          ) : null}

          <Reveal>
            <p style={{ marginTop: 34 }}>
              <ProseLink href={`${V6_BASE}/research`}>All research</ProseLink>
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
