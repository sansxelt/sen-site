import Link from "next/link";
import { notFound } from "next/navigation";
import { GUIDES } from "../../_content/guides";
import { photographHero } from "../../_content/photography";
import { FrameHero } from "../../_system/kit";
import { v6meta } from "../../_system/meta";
import { V6_BASE } from "@/lib/v6-routes";
import "./guide.css";

export function generateStaticParams() { return GUIDES.map(guide => ({ slug: guide.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = GUIDES.find(guide => guide.slug === slug);
  return guide ? v6meta({ title: guide.title, description: guide.intro, path: `/guides/${slug}`, type: "article" }) : v6meta({ title: "Not found", description: "This guide does not exist.", path: `/guides/${slug}`, index: false });
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = GUIDES.find(guide => guide.slug === slug);
  if (!guide) notFound();
  return <article className="security-guide">
    <FrameHero compact eyebrow="Guides" title={guide.title} sub={guide.intro} primary={{ label: "Read the guide", href: "#guide-content" }} {...photographHero(guide.photo)} />
    <div className="security-guide__body" id="guide-content">
      {guide.sections.map(section => <section key={section.title}>
        <h2>{section.title}</h2>{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
      </section>)}
      {guide.references ? <section><h2>Read the underlying guidance.</h2>
        {guide.references.map(reference => <p key={reference.href}><a href={reference.href}>{reference.title}</a></p>)}
      </section> : null}
      <Link href={`${V6_BASE}/docs/ai-security`}>AI security at Vraelis</Link>
    </div>
  </article>;
}
