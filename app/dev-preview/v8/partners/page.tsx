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

// Future partners (founder, 2026-10-23: "do all as future"). Auth0's logo is public domain (Wikimedia Commons, author
// Auth0); Vanta's is its own site's logo (vanta.com header), recoloured white for the dark site and otherwise unchanged.
// The United Nations stays a text name: its emblem may not be used without the Secretary-General's written
// authorization (UN General Assembly resolution 92(I)), whatever the framing.
const IN_PROGRESS: { name: string; logo?: { src: string; w: number; h: number } }[] = [
  { name: "Auth0", logo: { src: "/v8/partners/auth0-logo-white.svg", w: 2235, h: 720 } },
  { name: "Vanta", logo: { src: "/v8/partners/vanta-logo-white.svg", w: 159, h: 39 } },
  { name: "United Nations" },
];

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
          {/* IN PROGRESS (founder, 2026-10-23: "we arent with them yet dont list them as partners ... we are in the
              PROGRESS, so we not legally claiming anything"; founder chose to name all three after being advised that
              naming the United Nations carries the most risk). Names only, as plain text: no logos, no emblem, no
              partner card or page, and an explicit statement that nothing is signed and none endorses Vraelis.
              Remove a name if talks end; move it to PARTNERS only with a signed agreement. */}
          <section className="pt-progress" aria-labelledby="pt-progress-h">
            <h2 id="pt-progress-h" className="pt-progress__h">Future partners</h2>
            <ul className="pt-progress__row">
              {IN_PROGRESS.map((o) => (
                <li key={o.name}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {o.logo ? <img className={`pt-progress__logo pt-progress__logo--${o.name.toLowerCase()}`} src={o.logo.src} alt={o.name} width={o.logo.w} height={o.logo.h} loading="lazy" decoding="async" />
                    : <span className="pt-progress__name">{o.name}</span>}
                </li>
              ))}
            </ul>
            <p className="v8-small pt-progress__note">Conversations with these organizations are under way. They are not partners: no agreement has been signed, and none of them endorses Vraelis.</p>
          </section>
        </div>
      </Wrap>
    </Section>
  );
}
