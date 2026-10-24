import { GENERAL_INBOX } from "@/lib/contact-routing";
import Link from "next/link";
import type { ReactNode } from "react";
import { CONTOUR, PROMPTO } from "../../_kit/site";
import { dl } from "../_data/host";
import { adjacent, crumbs, navLabel, outline } from "../_data/pages";
import { pageMarkdown } from "../_data/text";
import { MARKDOWN_ID, type Page } from "../_data/types";
import { AskInline } from "./ask-button";
import { Blocks } from "./blocks";
import { CopyForLLM, Toc } from "./client";

// One docs article, after x.ai's: a small breadcrumb, the page's one h1, Copy for LLM and View as Markdown, the two
// pills (Join us, and the accent outline to Vraelis Contour on the main site), the lead, the body, "Last updated",
// previous and next. Beside it "On this page", with Copy for LLM, Ask AI and Share feedback at its foot. The
// sidebar is the docs layout's, so it stays put between pages.

const formatDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Feedback goes to the address the contact page uses for general inquiries. */
export const feedbackHref = (title: string) => `mailto:${GENERAL_INBOX}?subject=${encodeURIComponent(`Docs feedback: ${title}`)}`;

function DocIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}
export function FeedbackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12Z" />
    </svg>
  );
}

/** A link that leaves the docs host goes as a plain anchor; inside the docs, through the router. */
function A({ to, className, children, rel }: { to: string; className?: string; children: ReactNode; rel?: string }) {
  const at = dl(to);
  return /^https?:/.test(at) ? <a className={className} href={at} rel={rel}>{children}</a> : <Link className={className} href={at} rel={rel}>{children}</Link>;
}

export function Article({ page }: { page: Page }) {
  const toc = outline(page);
  const { prev, next } = adjacent(page.slug);
  const md = pageMarkdown(page);
  const twin = dl(`/docs/md/${page.slug}.md`);
  const trail = crumbs(page);
  return (
    <div className="v8-docs-page">
      <article className="v8-docs-article" data-rv-kids>
        {page.banner ? (
          <div className="v8-docs-banner" role="note">
            <b>{page.banner.label}</b> <span>{page.banner.text}</span>
          </div>
        ) : null}
        <nav className="v8-docs-crumbs" aria-label="Breadcrumb">
          <ol>
            {trail.map((c, i) => (
              <li key={c.label}>
                {c.to && i < trail.length - 1 ? <Link href={dl(c.to)}>{c.label}</Link> : <span>{c.label}</span>}
              </li>
            ))}
          </ol>
        </nav>
        <h1 className="v8-docs-h1">{page.title}</h1>
        <div className="v8-docs-utils">
          <CopyForLLM />
          <span className="v8-docs-utils__rule" aria-hidden="true" />
          <a className="v8-docs-util" href={twin} target="_blank" rel="noopener"><DocIcon /><span>View as Markdown</span></a>
        </div>
        {page.tab !== "earlier" ? (
          <div className="v8-docs-ctas">
            <A to="/contact?topic=contour" className="v8-btn v8-btn--solid v8-btn--sm">Join Us<span className="v8-chev" aria-hidden="true" /></A>
            {/* Prompto's pages point to its product page and downloads; every other page to Contour. */}
            <A to={page.section === PROMPTO.name ? "/prompto" : "/contour"} className="v8-docs-meet">{page.section === PROMPTO.name ? `Get ${PROMPTO.name}` : `Meet ${CONTOUR.name}`}<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 2.5h6v6M9.5 2.5l-7 7" /></svg></A>
          </div>
        ) : null}
        <p className="v8-docs-lead">{page.lead ?? page.description}</p>
        <div className="v8-docs-body" data-rv-kids>
          <Blocks blocks={page.blocks} />
        </div>
        {page.updated ? <p className="v8-docs-updated">Last updated: {formatDay(page.updated)}</p> : null}
        {prev || next ? (
          <nav className="v8-docs-pager" aria-label="Previous and next page">
            {prev ? (
              <Link href={dl(`/docs/${prev.slug}`)} rel="prev"><span className="l">Previous</span><span className="t">{navLabel(prev)}</span></Link>
            ) : <span />}
            {next ? (
              <Link href={dl(`/docs/${next.slug}`)} rel="next" className="is-next"><span className="l">Next</span><span className="t">{navLabel(next)}</span></Link>
            ) : <span />}
          </nav>
        ) : null}
      </article>

      <aside className="v8-docs-toc" aria-label="On this page and page actions">
        {toc.length >= 2 ? <Toc items={toc} /> : null}
        <div className={toc.length >= 2 ? "v8-docs-toc__foot" : "v8-docs-toc__foot v8-docs-toc__foot--only"}>
          <CopyForLLM />
          <AskInline />
          <a className="v8-docs-util" href={feedbackHref(page.title)}><FeedbackIcon /><span>Share feedback</span></a>
        </div>
      </aside>

      {/* The page as Markdown, once, for both Copy for LLM buttons. "<" is escaped so the JSON cannot end the tag. */}
      <script type="application/json" id={MARKDOWN_ID} dangerouslySetInnerHTML={{ __html: JSON.stringify(md).replace(/</g, "\\u003c") }} />
    </div>
  );
}
