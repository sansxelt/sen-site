import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { v8meta } from "../../_kit/meta";
import { href } from "../../_kit/site";
import { ALIASES, PAGES, getPage, tabOf } from "../_data/pages";
import { Article } from "../_ui/article";
import { robotsMeta } from "@/lib/stealth";

export function generateStaticParams() {
  return PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = getPage(slug);
  // An unknown slug must not invite indexing: metadata comes from this segment, not from not-found.
  if (!page) return { title: "Not found", robots: robotsMeta(false) };
  const meta = v8meta({ title: page.title, description: page.description, path: `/docs/${page.slug}`, index: page.tab !== "earlier" });
  return { ...meta, title: { absolute: `${page.nav ?? page.title} | ${tabOf(page.tab).label} | Vraelis docs` } };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (ALIASES[slug]) permanentRedirect(href(`/docs/${ALIASES[slug]}`));
  const page = getPage(slug);
  if (!page) notFound();
  return <Article page={page} />;
}
