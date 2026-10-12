import Link from "next/link";
import "./partners.css";
import { Section, TextLink, Wrap } from "../_kit/blocks";
import { v8meta } from "../_kit/meta";
import { href } from "../_kit/site";
import { PARTNERS, PARTNERS_NOTE } from "../_content/partners";
import { LogoCard, day } from "./logo-card";

export const metadata = v8meta({
  title: "Partners",
  description: "Vraelis's partnerships with ByteDance, centred on its Seed models, with Reddit, around Reddit Ads, and with Stripe Startups. None covers Vraelis Contour.",
  path: "/partners",
});

export default function PartnersPage() {
  const [featured, ...rest] = PARTNERS;
  return (
    <>
      <Section>
        <Wrap>
          <div className="pt-featured">
            <div className="v8-stack">
              <span className="v8-eyebrow">Partners</span>
              <h1 className="v8-h1">{featured.title}</h1>
              <p className="v8-lead">{featured.summary}</p>
              <p className="pt-meta"><span>Official partnership since {day(featured.established)}</span><span>{featured.focus}</span></p>
              <div className="v8-actions" style={{ marginTop: 6 }}>
                <Link className="v8-btn v8-btn--solid" href={href(`/partners/${featured.slug}`)}>Read more<span className="v8-arrow" aria-hidden="true" /></Link>
              </div>
            </div>
            <Link href={href(`/partners/${featured.slug}`)} aria-label={`${featured.title}: read the partnership record`}><LogoCard p={featured} /></Link>
          </div>
        </Wrap>
      </Section>
      <Section rule>
        <Wrap>
          <div className="v8-stack--lg">
            <div className="pt-cards">
              {rest.map((p) => (
                <Link key={p.slug} href={href(`/partners/${p.slug}`)} className="pt-card">
                  <LogoCard p={p} />
                  <p className="pt-meta"><span>Since {day(p.established)}</span><span>{p.focus}</span></p>
                  <h3>{p.title}</h3>
                  <p className="v8-small">{p.summary}</p>
                </Link>
              ))}
              <div className="v8-box" style={{ display: "grid", gap: 14, alignContent: "start" }}>
                <h2 className="v8-h3">What they are not</h2>
                <p className="v8-body">{PARTNERS_NOTE}</p>
                <TextLink to="/changelog">Changelog entries</TextLink>
              </div>
            </div>
          </div>
        </Wrap>
      </Section>
    </>
  );
}
