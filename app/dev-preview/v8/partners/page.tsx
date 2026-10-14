import Link from "next/link";
import "./partners.css";
import { Section, Wrap } from "../_kit/blocks";
import { v8meta } from "../_kit/meta";
import { href } from "../_kit/site";
import { PARTNERS } from "../_content/partners";
import { LogoCard, day } from "./logo-card";

export const metadata = v8meta({
  title: "Partners",
  description: "Official Vraelis partnerships with ByteDance, Reddit, Stripe Startups and Cloudflare. Explore their scope, benefits and milestones.",
  path: "/partners",
});

export default function PartnersPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Vraelis partners",
    url: "https://vraelis.com/partners",
    description: "Official Vraelis partnerships with ByteDance, Reddit, Stripe Startups and Cloudflare.",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: PARTNERS.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "WebPage",
          name: p.title,
          url: `https://vraelis.com/partners/${p.slug}`,
          description: p.summary,
        },
      })),
    },
  };
  return (
    <Section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <Wrap>
        <div className="pt-overview v8-stack--lg">
          <header className="pt-intro v8-stack">
            <span className="v8-eyebrow">Company</span>
            <h1 className="v8-h1">Partners</h1>
            <p className="v8-lead">Working with ByteDance, Reddit, Stripe Startups and Cloudflare across AI models, advertising and startup resources.</p>
          </header>
          <div className="pt-cards pt-cards--equal">
            {PARTNERS.map((p) => (
              <Link key={p.slug} href={href(`/partners/${p.slug}`)} className="pt-card">
                <LogoCard p={p} />
                <div className="pt-card__copy">
                  <p className="pt-meta"><span>Official partnership</span><time dateTime={p.established}>{day(p.established)}</time></p>
                  <h2>{p.title}</h2>
                  <p className="v8-small">{p.summary}</p>
                  <span className="pt-card__read">Read partnership<span className="v8-arrow" aria-hidden="true" /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </Wrap>
    </Section>
  );
}
