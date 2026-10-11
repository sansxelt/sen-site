import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { v8meta } from "../../_kit/meta";
import { DOCS_ORIGIN } from "@/lib/docs-host";
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
  return <Article page={page} />;
}
