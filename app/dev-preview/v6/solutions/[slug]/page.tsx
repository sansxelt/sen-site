import Infrastructure, { metadata as infrastructureMetadata } from "../../infrastructure/page";
import type { Metadata } from "next";
import { v6meta } from "../../_system/meta";
import { SectorPageView } from "../../_system/sector";
import { SOLUTION_SLUGS } from "../../_content/sectors";
import { sectorPage } from "../../_content/sector-pages";
import { robotsMeta } from "@/lib/stealth";

// THE SEVEN SECTOR PAGES (plan S1 and S2, template T2): /solutions/<slug>, one per solution slug in
// _content/sectors.ts. The copy is _content/sector-pages.ts and the layout is _system/sector.tsx; this file only
// routes. Every page is built at build time, and any other slug is a 404 (dynamicParams = false). Enterprise is
// in the registry too, but its page is /enterprise, so SOLUTION_SLUGS leaves it out.

export const dynamicParams = false;

export function generateStaticParams() {
  return SOLUTION_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (slug === "public-sector") return infrastructureMetadata;
  const page = sectorPage(slug);
  // An unknown slug never reaches here in a build (dynamicParams is false); in dev it must not invite indexing.
  if (!page) return { title: "Not found", robots: robotsMeta(false) };
  return v6meta({ title: page.meta.title, description: page.meta.description, path: `/solutions/${page.slug}` });
}

export default async function SectorRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === "public-sector") return <Infrastructure />;
  return <SectorPageView slug={slug} />;
}
