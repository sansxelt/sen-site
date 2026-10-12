import Link from "next/link";
import { notFound } from "next/navigation";
import "../partners.css";
import { Section, Wrap } from "../../_kit/blocks";
import { v8meta } from "../../_kit/meta";
import { href, TAB_NAMES } from "../../_kit/site";
import { PARTNERS, partner } from "../../_content/partners";
import { LogoCard, day } from "../logo-card";

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return PARTNERS.map((p) => ({ slug: p.slug })); }
export async function generateMetadata({ params }: Props) {
  const p = partner((await params).slug);
  if (!p) return {};
  return v8meta({ title: `${p.title} | Partners`, description: p.summary, path: `/partners/${p.slug}` , tab: TAB_NAMES[p.slug] ?? p.name });
}

export default async function PartnerPage({ params }: Props) {
  const p = partner((await params).slug);
  if (!p) notFound();
  const others = PARTNERS.filter((o) => o.slug !== p.slug);
  return (
    <>
      <Wrap>
        <article className="pt-story">
          <div className="pt-top">
            <Link href={href("/partners")}><span className="pt-back" aria-hidden="true" />Back to partners</Link>
            <time dateTime={p.established}>{day(p.established)}</time>
          </div>
          <header className="pt-head">
            <h1 className="v8-h1">{p.title}</h1>
            <span className="pt-chip">Partnership</span>
            <p className="v8-lead">{p.lede}</p>
          </header>
          <div style={{ marginTop: 40 }}><LogoCard p={p} className="pt-story-logo" /></div>
          <dl className="pt-record">
            {p.firstContact ? <div><dt>First contact</dt><dd>{day(p.firstContact)}</dd></div> : null}
            <div><dt>Established</dt><dd>{day(p.established)}</dd></div>
            <div><dt>Focus</dt><dd>{p.focus}</dd></div>
            <div><dt>Status</dt><dd>Official partnership</dd></div>
          </dl>
          <div className="pt-two">
            <section className="v8-stack">
              <h2 className="v8-h3">Scope</h2>
              <ul>{p.means.map((m) => <li key={m}>{m}</li>)}</ul>
            </section>
            <section className="v8-stack">
              <h2 className="v8-h3">Limits</h2>
              <ul>{p.boundary.map((m) => <li key={m}>{m}</li>)}</ul>
            </section>
          </div>
          <div className="v8-actions" style={{ marginTop: 28 }}>
            {p.links.map((l) => <a key={l.href} className="v8-btn v8-btn--soft v8-btn--sm" href={l.href} target="_blank" rel="noopener noreferrer">{l.label}<span className="v8-arrow" aria-hidden="true" /></a>)}
          </div>
          <figure className="pt-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.photo.src} alt={p.photo.alt} width={1400} height={700} loading="lazy" decoding="async" />
          </figure>
        </article>
      </Wrap>
      <Section rule style={{ marginTop: "var(--section)" }}>
        <Wrap>
          <div className="v8-stack--lg">
            <h2 className="v8-h2">{others.length > 1 ? "Other partnerships" : "Other partnership"}</h2>
            <div className="pt-cards">
              {others.map((o) => (
                <Link key={o.slug} href={href(`/partners/${o.slug}`)} className="pt-card">
                  <LogoCard p={o} />
                  <p className="pt-meta"><span>Since {day(o.established)}</span><span>{o.focus}</span></p>
                  <h3>{o.title}</h3>
                </Link>
              ))}
            </div>
          </div>
        </Wrap>
      </Section>
    </>
  );
}
