import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { v8meta } from "../../_kit/meta";
import { RESEARCH } from "../../_kit/site";
import { researchPage } from "../content";
import { ResearchDetail } from "../detail";

export const dynamicParams = false;

export function generateStaticParams() {
  return RESEARCH.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = researchPage(slug);
  if (!page) return { robots: { index: false, follow: false } };
  return v8meta({ title: page.metaTitle, description: page.description, path: `/research/${slug}` });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = researchPage(slug);
  if (!page) notFound();
  return <ResearchDetail page={page} />;
}
