import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { v6meta } from "../../_system/meta";
import { DocShell, Blocks, dslug } from "../../_content/docs-ui";
import { DOCS, getDoc, adjacentDocs, docHeadings } from "../../_content/docs";

const BASE = "/dev-preview/v6";

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) return {};
  return v6meta({ title: doc.title, description: doc.summary, path: `/docs/${doc.slug}`, type: "article" });
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();
  const { prev, next } = adjacentDocs(slug);
  const headings = docHeadings(doc);
  return (
    <section className="v6-sec" style={{ paddingTop: "clamp(40px,5vw,72px)" }}>
      <DocShell activeSlug={slug}>
        <article className="v6-prose">
          <div className="v6-docs__meta"><span className="v6-kicker">{doc.group}</span></div>
          <h1 className="v6-dl">{doc.title}</h1>
          <p className="v6-lead" style={{ marginTop: 14 }}>{doc.summary}</p>
          <div className="v6-note" style={{ marginTop: 22 }}><b>Outcome</b>{doc.outcome}</div>
          {headings.length ? (
            <nav aria-label="On this page" style={{ marginTop: 26 }}>
              <p className="v6-docs__toc">On this page</p>
              <ul>{headings.map((h) => <li key={h}><a href={`#${dslug(h)}`}>{h}</a></li>)}</ul>
            </nav>
          ) : null}
          <Blocks blocks={doc.blocks} />
          {doc.related?.length ? (
            <>
              <h2 style={{ marginTop: 46 }}>Related</h2>
              <ul>{doc.related.map((r) => { const rd = getDoc(r); return rd ? <li key={r}><Link href={`${BASE}/docs/${rd.slug}`}>{rd.title}</Link></li> : null; })}</ul>
            </>
          ) : null}
          <div className="v6-docs__nav">
            {prev ? <Link href={`${BASE}/docs/${prev.slug}`}><span className="l">Previous</span><span className="t">{prev.title}</span></Link> : <span />}
            {next ? <Link className="is-next" href={`${BASE}/docs/${next.slug}`}><span className="l">Next</span><span className="t">{next.title}</span></Link> : <span />}
          </div>
        </article>
      </DocShell>
    </section>
  );
}
