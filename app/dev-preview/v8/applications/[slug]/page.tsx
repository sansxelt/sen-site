import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { v8meta } from "../../_kit/meta";
import { APPLICATIONS, TAB_NAMES } from "../../_kit/site";
import { appPage } from "../content";
import { AppDetail } from "../detail";

export const dynamicParams = false;

export function generateStaticParams() {
  return APPLICATIONS.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = appPage(slug);
  if (!page) return { robots: { index: false, follow: false } };
  return v8meta({ title: page.metaTitle, description: page.description, path: `/applications/${slug}` , tab: TAB_NAMES[slug] ?? page.metaTitle });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = appPage(slug);
  if (!page) notFound();
  return <AppDetail page={page} />;
}
