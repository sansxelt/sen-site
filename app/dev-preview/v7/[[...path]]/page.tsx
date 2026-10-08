import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CURRENT_DOC_SLUGS } from "../../v6/_content/docs";
import { Applications, CompanyPreview, ContourPreview, DocumentationPreview, HomePreview, PROVIDERS, ResearchPreview, TechnologyPreview } from "../content";

import { ContactPreview, DevelopmentPreview, DIRECTION_ROUTES, GUIDE_ROUTES, ReadingPreview } from "../reading";

import { LANDSCAPE, LandscapePreview } from "../landscape";

const routes = ["", "contact", "beta", ...DIRECTION_ROUTES, ...GUIDE_ROUTES.map(s => `guides/${s}`), "contour", "company", "solutions", "research", "docs", "technology", "landscape", ...LANDSCAPE.map(c => `landscape/${c.slug}`), ...CURRENT_DOC_SLUGS.map(s => `docs/${s}`), ...PROVIDERS.map(p => `technology/${p.slug}`)];
type Props = { params: Promise<{ path?: string[] }> };
export function generateStaticParams() { return routes.map(s => ({ path: s ? s.split("/") : [] })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const path = (await params).path ?? [];
  const name = path[0] === "contact" ? "Join Vraelis" : path[0] === "beta" ? "Vraelis development" : path[0] === "contour" ? "Vraelis Contour" : path[0] === "docs" ? "Vraelis documentation" : path[0] === "research" ? "Vraelis research" : path[0] === "technology" ? "Vraelis technology" : "Vraelis";
  return { title: `${name} | Design preview`, robots: { index: false, follow: false }, alternates: { canonical: null } };
}
export default async function Page({ params }: Props) {
  const path = (await params).path ?? [];
  if (!routes.includes(path.join("/"))) notFound();
  if (DIRECTION_ROUTES.includes(path[0])) return <ReadingPreview slug={path[0]} />;
  switch(path[0]) {
    case "guides": return <ReadingPreview slug={path[1]} guide />;
    case "contact": return <ContactPreview />;
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
