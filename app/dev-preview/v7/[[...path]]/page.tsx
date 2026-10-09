import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PUBLIC_SITE_PATHS } from "@/lib/public-site";
import { publicMetadata, pageJsonLd } from "../metadata";
import { ResourcesPage } from "../resources";
import { TrustPage, TRUST_ROUTES } from "../trust";
import { Applications, CompanyPreview, ContourPreview, DocumentationPreview, HomePreview, ResearchPreview, TechnologyPreview } from "../content";

import { ContactPreview, DevelopmentPreview, DIRECTION_ROUTES, ReadingPreview } from "../reading";

import { LandscapePreview } from "../landscape";

const routes = PUBLIC_SITE_PATHS.map(path => path === "/" ? "" : path.slice(1));
type Props = { params: Promise<{ path?: string[] }>; searchParams: Promise<{ topic?: string | string[] }> };
export function generateStaticParams() { return routes.map(s => ({ path: s ? s.split("/") : [] })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const path = (await params).path ?? [];
  return publicMetadata(path, routes.includes(path.join("/")));
}
export default async function Page({ params, searchParams }: Props) {
  const [resolved, query] = await Promise.all([params, searchParams]);
  const path = resolved.path ?? [];
  if (!routes.includes(path.join("/"))) notFound();
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageJsonLd(path) }} /><Content path={path} topicParam={typeof query.topic === "string" ? query.topic : undefined} /></>;
}
function Content({ path, topicParam }: { path: string[]; topicParam?: string }) {
  if (TRUST_ROUTES.includes(path[0])) return <TrustPage slug={path[0]} />;
  if (DIRECTION_ROUTES.includes(path[0])) return <ReadingPreview slug={path[0]} />;
  switch(path[0]) {
    case "changelog":
    case "image-sources": return <ResourcesPage slug={path[0]} />;
    case "guides": return <ReadingPreview slug={path[1]} guide />;
    case "contact": return <ContactPreview topicParam={topicParam} />;
    case "beta": return <DevelopmentPreview />;
    case "contour": return <ContourPreview />;
    case "company": return <CompanyPreview />;
    case "solutions": return <><section className="v7-hero v7-wrap"><p className="v7-eyebrow">Solutions</p><h1>Security shaped<br />by the system.</h1><p className="v7-hero__intro">For AI systems used in defense,<br /> critical infrastructure and robotics.</p></section><Applications page /></>;
    case "research": return <ResearchPreview />;
    case "landscape": return <LandscapePreview slug={path[1]} />;
    case "technology": return <TechnologyPreview slug={path[1]} />;
    case "docs": return <DocumentationPreview slug={path[1]} />;
    default: return <HomePreview />;
  }
}
