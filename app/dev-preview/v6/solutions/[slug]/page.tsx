import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DirectionPage } from "../../_system/direction-page";
import { SECURITY_PAGES } from "../../_content/security-direction";
import { v6meta } from "../../_system/meta";
import { SOLUTION_SLUGS } from "../../_content/sectors";
import { V6_BASE } from "@/lib/v6-routes";
const keys: Record<string,string> = { defense:"defense", fleets:"robotics", "public-sector":"infrastructure" };
export const dynamicParams = false;
export function generateStaticParams() { return SOLUTION_SLUGS.map(slug => ({slug})); }
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata> {
 const {slug}=await params; const c=SECURITY_PAGES[keys[slug]];
 return c ? v6meta({title:c.eyebrow + " / " + c.title,description:c.intro,path:`/solutions/${slug}`}) : {robots:{index:false,follow:false}};
}
export default async function Page({params}:{params:Promise<{slug:string}>}) {
 const {slug}=await params;
 if (!SOLUTION_SLUGS.includes(slug as typeof SOLUTION_SLUGS[number])) notFound();
 const c=SECURITY_PAGES[keys[slug]];
 if (!c) redirect(`${V6_BASE}/solutions`);
 return <DirectionPage content={c}/>;
}
