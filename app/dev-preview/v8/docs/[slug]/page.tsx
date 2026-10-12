import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { v8meta } from "../../_kit/meta";
import { DOCS_ORIGIN, SITE_ORIGIN } from "@/lib/docs-host";
import { ALIASES, PAGES, getPage, tabOf } from "../_data/pages";
import { dl, loadDocsHost } from "../_data/host";
import { Article } from "../_ui/article";
import { robotsMeta } from "@/lib/stealth";

// Every page and every moved slug (which redirects) is known at build time; anything else is a 404 at routing.
export const dynamicParams = false;

export function generateStaticParams() {
  return [...PAGES.map((p) => ({ slug: p.slug })), ...Object.keys(ALIASES).map((slug) => ({ slug }))];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = getPage(slug);
  // An unknown slug must not invite indexing: metadata comes from this segment, not from not-found.
  if (!page) return { title: "Not found", robots: robotsMeta(false) };
  const meta = v8meta({ title: page.title, description: page.description, path: `/docs/${page.slug}`, index: page.tab !== "earlier" });
  const url = `${DOCS_ORIGIN}/${page.slug}`; // the docs' own address; /docs/<slug> on the main host is the same page
  return { ...meta, alternates: { canonical: url }, openGraph: { ...meta.openGraph, url }, title: { absolute: `${page.title} | ${tabOf(page.tab).label} | Vraelis docs` } };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await loadDocsHost();
  if (ALIASES[slug]) permanentRedirect(dl(`/docs/${ALIASES[slug]}`));
  const page = getPage(slug);
  if (!page) notFound();
  const url = `${DOCS_ORIGIN}/${page.slug}`;
  const structured = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        "@id": `${url}#article`,
        headline: page.title,
        description: page.description,
        url,
        mainEntityOfPage: url,
        ...(page.updated ? { dateModified: page.updated } : {}),
        inLanguage: "en",
        publisher: { "@id": `${SITE_ORIGIN}/#organization` },
        isPartOf: { "@id": `${DOCS_ORIGIN}/#website` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Vraelis docs", item: `${DOCS_ORIGIN}/` },
          { "@type": "ListItem", position: 2, name: page.title, item: url },
        ],
      },
    ],
  };
  return <>
    {page.tab !== "earlier" && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} />}
    <Article page={page} />
  </>;
}
