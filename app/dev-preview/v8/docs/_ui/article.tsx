import Link from "next/link";
import { href } from "../../_kit/site";
import { adjacent, navLabel, outline, tabGroups } from "../_data/pages";
import { pageMarkdown } from "../_data/text";
import { MARKDOWN_ID, type Page } from "../_data/types";
import { Blocks } from "./blocks";
import { CopyForLLM, SideNav, Toc } from "./client";

// One docs article: the sidebar for its tab, the article (eyebrow, the page's one h1, the utility row, the
// content, the pager) and "On this page" with Copy for LLM in its footer.

const formatDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

function DocIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}

export function Sidebar({ page }: { page: Page }) {
  return (
    <SideNav current={navLabel(page)}>
      <nav aria-label="Documentation pages">
        {tabGroups(page.tab).map((g) => (
          <div key={g.group} className="v8-docs-side__group">
            <p className="v8-docs-side__label">{g.group}</p>
            <ul>
              {g.pages.map((p) => (
                <li key={p.slug}>
                  <Link href={href(`/docs/${p.slug}`)} aria-current={p.slug === page.slug ? "page" : undefined}>{navLabel(p)}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </SideNav>
  );
}

export function Article({ page }: { page: Page }) {
  const toc = outline(page);
  const { prev, next } = adjacent(page.slug);
  const md = pageMarkdown(page);
  const twin = href(`/docs/md/${page.slug}.md`);
  return (
    <div className="v8-wrap v8-wrap--frame v8-docs-frame">
      <aside className="v8-docs-side" aria-label="Documentation navigation"><Sidebar page={page} /></aside>

      <article className="v8-docs-article">
        {page.banner ? (
          <div className="v8-docs-banner" role="note">
            <b>{page.banner.label}</b> <span>{page.banner.text}</span>
          </div>
        ) : null}
        <p className="v8-docs-eyebrow">{page.eyebrow}</p>
        <h1 className="v8-docs-h1">{page.title}</h1>
        <div className="v8-docs-utils">
          <CopyForLLM />
          <span className="v8-docs-utils__rule" aria-hidden="true" />
          <a className="v8-docs-util" href={twin} target="_blank" rel="noopener"><DocIcon /><span>View as Markdown</span></a>
        </div>
        <p className="v8-docs-lead">{page.lead ?? page.description}</p>
        <div className="v8-docs-body">
          <Blocks blocks={page.blocks} />
        </div>
        {page.updated ? <p className="v8-docs-updated">Last updated {formatDay(page.updated)}</p> : null}
        {prev || next ? (
          <nav className="v8-docs-pager" aria-label="Previous and next page">
            {prev ? (
              <Link href={href(`/docs/${prev.slug}`)} rel="prev"><span className="l">Previous</span><span className="t">{navLabel(prev)}</span></Link>
            ) : <span />}
            {next ? (
              <Link href={href(`/docs/${next.slug}`)} rel="next" className="is-next"><span className="l">Next</span><span className="t">{navLabel(next)}</span></Link>
            ) : <span />}
          </nav>
        ) : null}
      </article>

      {toc.length >= 2 ? (
        <aside className="v8-docs-toc" aria-label="On this page and page actions">
          <Toc items={toc} />
          <div className="v8-docs-toc__foot"><CopyForLLM /></div>
        </aside>
      ) : null}

      {/* The page as Markdown, once, for both Copy for LLM buttons. "<" is escaped so the JSON cannot end the tag. */}
      <script type="application/json" id={MARKDOWN_ID} dangerouslySetInnerHTML={{ __html: JSON.stringify(md).replace(/</g, "\\u003c") }} />
    </div>
  );
}
