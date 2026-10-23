import Link from "next/link";
import "./partners.css";
import { Section, Wrap } from "../_kit/blocks";
import { v8meta } from "../_kit/meta";
import { href } from "../_kit/site";
import { PARTNERS } from "../_content/partners";
import { LogoCard } from "./logo-card";

export const metadata = v8meta({
  title: "Partners",
  description: "Official Vraelis partnerships with ByteDance, Reddit, Stripe Startups and Cloudflare. Explore their scope, benefits and milestones.",
  path: "/partners",
});

// Future partners (founder, 2026-10-23: "do all as future"). Auth0's logo is public domain (Wikimedia Commons, author
// Auth0); Vanta's is its own site's logo (vanta.com header), recoloured white for the dark site and otherwise unchanged.
// The United Nations stays a text name: its emblem may not be used without the Secretary-General's written
// authorization (UN General Assembly resolution 92(I)), whatever the framing.
const IN_PROGRESS: { name: string; logo?: { src: string; light: string; w: number; h: number } }[] = [
  { name: "Auth0", logo: { src: "/v8/partners/auth0-logo-white.svg", light: "/v8/partners/auth0-logo.svg", w: 2235, h: 720 } },
  { name: "Vanta", logo: { src: "/v8/partners/vanta-logo-white.svg", light: "/v8/partners/vanta-logo.svg", w: 159, h: 39 } },
  { name: "United Nations" },
];

// One word per partner for the tile, instead of the date that made the page read as a timeline (founder, 2026-10-23:
// "it just isn't neat it's just a timeline"). Dates stay on each partner's own page.
const KIND: Record<string, string> = { bytedance: "AI models", reddit: "Advertising", "stripe-startups": "Startup program", cloudflare: "Technology" };
// Events on record. Cloudflare Connect 2026: Foremake was invited with registrant type Partner (partners.ts record).
const EVENTS = [{ when: "Oct 19–21, 2026", name: "Cloudflare Connect 2026", where: "Moscone West, San Francisco", role: "Registered as a Cloudflare partner" }];

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
        <div className="pt-overview">
          <header className="pt-intro v8-stack">
            <span className="v8-eyebrow">Company</span>
            <h1 className="v8-h1">Partners</h1>
            <p className="v8-lead">Who Vraelis works with, who it is talking to, and where it shows up. Partnerships are held through Foremake, the brand that builds Vraelis.</p>
          </header>

          <section className="pt-block" aria-labelledby="pt-partners-h">
            <h2 id="pt-partners-h" className="pt-block__h">Partners</h2>
            <div className="pt-grid">
              {PARTNERS.map((p) => (
                <Link key={p.slug} href={href(`/partners/${p.slug}`)} className="pt-tile">
                  <LogoCard p={p} className="pt-tile__logo" />
                  <div className="pt-tile__copy">
                    <span className="pt-tile__kind">{KIND[p.slug]}</span>
                    <h3 className="pt-tile__name">{p.name}</h3>
                    <span className="pt-tile__read">Read more<span className="v8-arrow" aria-hidden="true" /></span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* FUTURE PARTNERS (founder, 2026-10-23: "we arent with them yet dont list them as partners ... we are in the
              PROGRESS, so we not legally claiming anything"; founder chose to name all three after being advised that
              naming the United Nations carries the most risk). No partner card or page, and an explicit statement
              that nothing is signed and none endorses Vraelis. Remove a name if talks end; move it to PARTNERS only
              with a signed agreement. */}
          <section className="pt-block" aria-labelledby="pt-progress-h">
            <h2 id="pt-progress-h" className="pt-block__h">Future partners</h2>
            <ul className="pt-progress__row">
              {IN_PROGRESS.map((o) => (
                <li key={o.name}>
                  {o.logo ? <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className={`pt-progress__logo pt-progress__logo--${o.name.toLowerCase()} v8-logo--dark`} src={o.logo.src} alt={o.name} width={o.logo.w} height={o.logo.h} loading="lazy" decoding="async" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className={`pt-progress__logo pt-progress__logo--${o.name.toLowerCase()} v8-logo--light`} src={o.logo.light} alt="" width={o.logo.w} height={o.logo.h} loading="lazy" decoding="async" />
                    </>
                    : <span className="pt-progress__name">{o.name}</span>}
                </li>
              ))}
            </ul>
            <p className="v8-small pt-block__note">Conversations with these organizations are under way. They are not partners: no agreement has been signed, and none of them endorses Vraelis.</p>
          </section>

          <section className="pt-block" aria-labelledby="pt-events-h">
            <h2 id="pt-events-h" className="pt-block__h">Events</h2>
            <ul className="pt-events">
              {EVENTS.map((e) => (
                <li key={e.name} className="pt-event">
                  <span className="pt-event__when">{e.when}</span>
                  <span className="pt-event__name">{e.name}</span>
                  <span className="pt-event__where">{e.where}</span>
                  <span className="pt-event__role">{e.role}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </Wrap>
    </Section>
  );
}
