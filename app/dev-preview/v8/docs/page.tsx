import Link from "next/link";
import { Band } from "../_kit/blocks";
import { v8meta } from "../_kit/meta";
import { CONTOUR } from "../_kit/site";
import { DOCS_ORIGIN } from "@/lib/docs-host";
import { OBSERVATION_2 } from "../_content/evidence";
import { START_HERE, TABS, getPage, navLabel, tabGroups, tabPages } from "./_data/pages";
import { dl, loadDocsHost } from "./_data/host";
import { CodeBlock } from "./_ui/blocks";
import { SearchPill } from "./_ui/search";

const meta = v8meta({
  title: "Documentation",
  description: "How Vraelis Contour connects an approved model release to the runtime state it reports, what the reference experiment records, and where it stops. With research guides and earlier implementation references.",
  path: "/docs",
});
// The docs' own address is docs.vraelis.com (lib/docs-host.ts); /docs on the main host serves the same page.
export const metadata = { ...meta, alternates: { canonical: `${DOCS_ORIGIN}/` }, openGraph: { ...meta.openGraph, url: `${DOCS_ORIGIN}/` } };

// The docs home, after x.ai's: a hero card with a real recorded observation beside it, a short path for a
// first reading, the three sections, and every page by section. No sidebar here; each section has its own.
export default async function DocsHome() {
  await loadDocsHost();
  const start = START_HERE.map((s) => getPage(s)!);
  return (
    <div className="v8-wrap v8-wrap--frame">
      <div className="v8-docs-home">
        <section className="v8-docs-hero" aria-labelledby="docs-title">
          <div className="v8-docs-hero__text">
            <h1 id="docs-title" className="v8-docs-hero__title">Documentation<span>for {CONTOUR.name} and our research</span></h1>
            <p className="v8-docs-hero__lead">How {CONTOUR.name} links an approved release to its reported runtime state, and where it stops.</p>
            <div className="v8-docs-hero__actions">
              <Link className="v8-btn v8-btn--solid" href={dl("/docs/overview")}>Read the overview<span className="v8-arrow" aria-hidden="true" /></Link>
              <SearchPill size="lg" />
            </div>
          </div>
          <figure className="v8-docs-hero__code">
            <CodeBlock label="observation 02, reload pending" code={OBSERVATION_2} lang="json" className="v8-docs-code--hero" />
            <figcaption>Recorded in the controlled ONNX reference experiment, unchanged.</figcaption>
          </figure>
        </section>

        <section className="v8-docs-home__sec" aria-labelledby="start-here">
          <h2 id="start-here" className="v8-docs-home__h">Start here</h2>
          <ol className="v8-docs-path">
            {start.map((p, i) => (
              <li key={p.slug}>
                <Link href={dl(`/docs/${p.slug}`)}>
                  <span className="n">{String(i + 1).padStart(2, "0")}</span>
                  <b>{p.title}</b>
                  <span className="d">{p.description}</span>
                  <i className="v8-arrow" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <section className="v8-docs-home__sec" aria-labelledby="sections">
          <h2 id="sections" className="v8-docs-home__h">Explore the documentation</h2>
          <div className="v8-docs-tabs">
            {TABS.map((t) => {
              const pages = tabPages(t.id);
              return (
                <div key={t.id} className="v8-docs-tabcard" data-tab={t.id}>
                  <Link href={dl(`/docs/${pages[0].slug}`)} className="v8-docs-tabcard__head">
                    <h3>{t.label}</h3>
                    <p>{t.line}</p>
                    <span className="v8-docs-tabcard__count">{pages.length} pages<i className="v8-arrow" aria-hidden="true" /></span>
                  </Link>
                  {t.id === "earlier" ? (
                    <ul className="v8-docs-tabcard__list">
                      {tabGroups(t.id).map((g) => (
                        <li key={g.group}><Link href={dl(`/docs/${g.pages[0].slug}`)}>{g.group}<small>{g.pages.length} {g.pages.length === 1 ? "page" : "pages"}</small></Link></li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="v8-docs-tabcard__list">
                      {pages.map((p) => <li key={p.slug}><Link href={dl(`/docs/${p.slug}`)}>{navLabel(p)}</Link></li>)}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="v8-docs-home__sec v8-docs-home__machine" aria-labelledby="markdown">
          <h2 id="markdown" className="v8-docs-home__h">Markdown for AI assistants</h2>
          <p>Every page has a Markdown twin: use Copy for LLM or View as Markdown.</p>
          <a className="v8-link" href={dl("/docs/md/index.md")} target="_blank" rel="noopener">Open the index as Markdown<span className="v8-arrow" aria-hidden="true" /></a>
        </section>

        {/* The kit's JoinBand, with links that also hold on the docs host. */}
        <Band title="Talk to us about model release security." lead="If you release models into systems others operate, we want to hear how."
          actions={<>
            <Link className="v8-btn v8-btn--solid" href={dl("/contact?topic=contour")}>Join us<span className="v8-arrow" aria-hidden="true" /></Link>
            <Link className="v8-btn v8-btn--soft" href={dl("/contour/status")}>Development status</Link>
          </>} />
      </div>
    </div>
  );
}
