import { notFound } from "next/navigation";
import Link from "next/link";
import { v6meta } from "../../_system/meta";
import { CTA, EditorialLink, Prose } from "../../_system/ui";
import { CrossLinks, MediaPanel } from "../../_system/kit";
import { ClosingScene } from "../../_system/close";
import { SUPPORT } from "../../_system/positioning";
import { RESEARCH_FIGURES, type ResearchFigure } from "../../_content/research-figures";
import { V6_BASE, v6SignInPath } from "@/lib/v6-routes";
import {
  articleBySlug, relatedArticles, publishedArticles, readingMinutes, formatDate,
  type Block,
} from "@/app/rank/research/_articles";
import { robotsMeta } from "@/lib/stealth";
import "../../_system/read.css";

/* THE RESEARCH ARTICLE, IN DESIGN 06 (plan T9, 2026-10-02).
 *
 * THE CONTENT IS NOT COPIED. Everything here reads app/rank/research/_articles, which stays the single
 * registry. Forking the prose to re-skin it would have created two versions of an authoritative document
 * that must not drift, and that file says exactly why: a reader forgives a landing page for being
 * enthusiastic, they do not forgive a research note for being wrong. So this route is a renderer and
 * nothing else, and `published: false` still means the article does not exist.
 *
 * What the page adds around the prose, and only around it: the read layout (_system/read.css), a contents list
 * built from the article's own headings, one recorded screenshot where _content/research-figures.ts places one,
 * the note that research is not a product description, two related articles, the product step and the closing.
 * Nothing on this page is wrapped in Reveal: the first screen of an article is the article, shown at once.
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

// Account creation is the sign-in screen in its sign-up mode, as the closing scene and the bar use it.
const SIGNUP = `${v6SignInPath()}&mode=signup`;

/** A heading's anchor: its own words, lower case, joined by dashes. */
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "section";

type Item = { kind: "block"; b: Block; id?: string } | { kind: "figure"; f: ResearchFigure };

/** The body as the page renders it: every block in the registry's order, each h2 with a unique id, and the figure
 *  after the last block of the section it names (or at the end when that heading is not there). */
function layout(body: Block[], fig: ResearchFigure | undefined): { items: Item[]; toc: { id: string; text: string }[] } {
  const used = new Set<string>();
  const toc: { id: string; text: string }[] = [];
  const items: Item[] = body.map((b) => {
    if (b.t !== "h2") return { kind: "block", b };
    let id = slugify(b.text);
    for (let n = 2; used.has(id); n++) id = `${slugify(b.text)}-${n}`;
    used.add(id);
    toc.push({ id, text: b.text });
    return { kind: "block", b, id };
  });
  if (fig) {
    const at = body.findIndex((b) => b.t === "h2" && b.text === fig.after);
    let end = body.length;
    if (at >= 0) { end = at + 1; while (end < body.length && body[end].t !== "h2") end++; }
    items.splice(end, 0, { kind: "figure", f: fig });
  }
  return { items, toc };
}

/** The block renderer. The registry stores structured blocks rather than raw markup precisely so the page
 *  owns typography and no article can inject HTML; every block becomes a React element here, so there is no
 *  path from article content to the DOM that bypasses escaping. Each case maps onto a shape .v6-prose
 *  already styles. */
function BlockView({ b, id }: { b: Block; id?: string }) {
  switch (b.t) {
    case "h2": return <h2 id={id}>{b.text}</h2>;
    case "p": return <p>{b.text}</p>;
    case "quote": return <blockquote>{b.text}</blockquote>;
    case "list": return <ul>{b.items.map((it, i) => <li key={i}>{it}</li>)}</ul>;
    // The page kit's reference block (plan A5, "Code block"): a 40px bar with the label in mono, then the text.
    // It is evidence quoted from a run, not a command, so it has no Copy button. tabIndex, as the shared Code block
    // has it: a line wider than a phone scrolls sideways, and a keyboard must be able to reach and scroll it (axe
    // scrollable-region-focusable). read.css draws its focus ring inside the block, where the panel cannot clip it.
    case "code": return (
      <div className="v6-code">
        {b.label ? <div className="v6-code__bar"><span className="v6-code__lang">{b.label}</span></div> : null}
        <pre tabIndex={0}><code>{b.text}</code></pre>
      </div>
    );
    // A note QUALIFIES the claim around it. It keeps its own surface so a limit cannot be skimmed past as
    // though it were more body copy.
    case "note": return <p className="v6-note"><b>Note</b>{b.text}</p>;
  }
}

/** One recorded figure: each shot at its own size (never wider than 640), the caption as whole sentences, the run
 *  ids after it in mono, and the use-case record that tells the whole check. */
function Figure({ f }: { f: ResearchFigure }) {
  return (
    <div className="v6-read__fig">
      {f.shots.map((s) => (
        <div key={s.src} className="v6-read__shot" style={{ maxWidth: s.w + 18 }}>
          <MediaPanel src={s.src} alt={s.alt} w={s.w} h={s.h} evidence sizes={`(max-width: ${s.w + 60}px) 100vw, ${s.w}px`}
            bar={{ left: s.address, right: s.label }} />
        </div>
      ))}
      <p className="v6-read__cap">
        <span>{f.caption}</span>
        {f.runs.map((r) => <span key={r} className="v6-read__run" data-no-translate>{r}</span>)}
      </p>
      <div className="v6-read__figlink"><EditorialLink href={`${V6_BASE}${f.record.href}`}>{f.record.label}</EditorialLink></div>
    </div>
  );
}

export default async function V6Article({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = articleBySlug(slug);
  // An unpublished article is indistinguishable from one that does not exist. articleBySlug enforces that;
  // this just honours it.
  if (!a) notFound();

  const related = relatedArticles(a.slug, 2);
  const mins = readingMinutes(a);
  const { items, toc } = layout(a.body, RESEARCH_FIGURES[a.slug]);
  const hasToc = toc.length >= 3;

  return (
    <>
      <article className="v6-read" aria-labelledby="read-h1">
        <div className="v6-wrap">
          <div className="v6-read__grid" data-toc={hasToc ? "" : undefined}>
            <header className="v6-read__head">
              <nav className="v6-read__crumb" aria-label="Breadcrumb">
                <Link href={`${V6_BASE}/research`}>Research</Link>
                <span className="v6-read__crumb-sep" aria-hidden>/</span>
                <span>{a.category}</span>
              </nav>
              <p className="v6-read__meta">
                <time dateTime={a.date}>{formatDate(a.date)}</time>
                <span>{`${mins} min read`}</span>
                <span>Vraelis research</span>
              </p>
              <h1 id="read-h1" className="v6-read__h1">{a.title}</h1>
              <p className="v6-read__deck">{a.summary}</p>
            </header>

            <div className="v6-read__body">
              <Prose>
                {items.map((it, i) => it.kind === "figure"
                  ? <Figure key={`fig-${i}`} f={it.f} />
                  : <BlockView key={i} b={it.b} id={it.id} />)}
              </Prose>
              {/* Research explains why the check is needed; it does not describe the product. The sentence is
                  whole, and the way to what the product does today follows it. */}
              <div className="v6-read__note">
                <p>Research explains why outcome verification is needed. It is not a description of the product.</p>
                <EditorialLink href={`${V6_BASE}/limitations`}>What Vraelis cannot do today</EditorialLink>
              </div>
            </div>

            {hasToc ? (
              <nav className="v6-read__toc" aria-labelledby="read-toc-h">
                <p id="read-toc-h" className="v6-read__tochead">On this page</p>
                <ol className="v6-read__toclist">
                  {toc.map((t) => (
                    <li key={t.id}><a href={`#${t.id}`}>{t.text}</a></li>
                  ))}
                </ol>
              </nav>
            ) : null}
          </div>
        </div>
      </article>

      <section className="v6-sec v6-read-end">
        <div className="v6-wrap">
          <div className="v6-read-end__in">
            {related.length ? (
              <CrossLinks heading="Keep reading" links={related.map((r) => ({ title: r.title, body: r.summary, href: `${V6_BASE}/research/${r.slug}` }))} />
            ) : null}
            <aside className="v6-read__step" aria-labelledby="read-step-h">
              <div>
                <h2 id="read-step-h" className="v6-read__steph">Check one claim on your own app</h2>
                <p>{SUPPORT}</p>
              </div>
              {/* A ghost: the closing's white button is in the same screen, and a view carries one white button. */}
              <div className="v6-actions"><CTA ghost href={SIGNUP}>Start free</CTA></div>
            </aside>
          </div>
        </div>
      </section>

      <ClosingScene title="Read what is built today" action={{ label: "What is built", href: `${V6_BASE}/platform#current` }} />
    </>
  );
}
