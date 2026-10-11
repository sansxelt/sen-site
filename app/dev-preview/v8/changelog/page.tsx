import Link from "next/link";
import { Button, Section, TextLink, Wrap } from "../_kit/blocks";
import { v8meta } from "../_kit/meta";
import { CAPTURE_CAPTION, href } from "../_kit/site";
import { formatDay } from "../_content/news";
import { ALIASES, CURRENT, EARLIER, isCapture, longDay } from "./history";
import "./changelog.css";

export const metadata = v8meta({
  title: "Changelog",
  description: "Dated entries from Vraelis, newest first, followed by the record of the retired browser-testing product, kept as history.",
  path: "/changelog",
});

// x.ai's three-tier news index: one featured entry with its picture, the rest as cards, then a dense dated list.
// The dense list is the earlier direction, kept as history with its original anchors (see ./history.ts). Each row's
// title is its past-tense summary: the original titles are in the present tense of a product that is retired
// (2026-10-11 audit), so they are not shown here.
export default function Changelog() {
  const [featured, ...rest] = CURRENT;
  return (
    <div className="clg">
      <section className="v8-page-hero clg-hero">
        <Wrap>
          <div className="v8-head" style={{ maxWidth: 760 }}>
            <span className="v8-eyebrow">Changelog</span>
            <h1 className="v8-h1">What changed, and when.</h1>
            <p className="v8-lead">Dated entries, newest first.</p>
          </div>
        </Wrap>
      </section>

      <section aria-label="Latest entry" className="clg-featured-sec">
        <Wrap>
          <article id={featured.id} className="clg-featured clg-anchor">
            {(ALIASES[featured.id] ?? []).map((a) => <span key={a} id={a} className="clg-anchor" aria-hidden="true" />)}
            <div className="clg-featured__text">
              <p className="clg-meta"><span>{featured.kind}</span><time dateTime={featured.date}>{longDay(featured.date)}</time></p>
              <h2 className="clg-featured__title">{featured.title}</h2>
              <p className="v8-lead">{featured.summary}</p>
              {featured.to ? (
                <div className="v8-actions" style={{ marginTop: 6 }}>
                  <Button to={featured.to} arrow>Read more<span className="v8-sr">: {featured.title}</span></Button>
                </div>
              ) : null}
            </div>
            <figure className="clg-featured__media">
              <div className="clg-featured__frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={featured.image.src} alt={featured.image.alt} width={featured.image.w} height={featured.image.h} fetchPriority="high" decoding="async" data-capture={isCapture(featured.image.src) || undefined} />
              </div>
              {isCapture(featured.image.src) ? <figcaption>{CAPTURE_CAPTION}</figcaption> : null}
            </figure>
          </article>
        </Wrap>
      </section>

      <section className="v8-section v8-section--tight clg-more" aria-label="More entries">
        <Wrap>
          <div className="clg-cards">
            {rest.map((n) => (
              <article key={n.id} id={n.id} className="clg-card clg-anchor">
                {(ALIASES[n.id] ?? []).map((a) => <span key={a} id={a} className="clg-anchor" aria-hidden="true" />)}
                <Link href={href(n.to ?? `/changelog#${n.id}`)} className="v8-card">
                  <div className="v8-card__media">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={n.image.src} alt={n.image.alt} width={n.image.w} height={n.image.h} loading="lazy" decoding="async" style={isCapture(n.image.src) ? { objectPosition: "left top" } : undefined} />
                  </div>
                  <div className="v8-card__meta"><span>{n.kind}</span><time dateTime={n.date}>{formatDay(n.date)}</time></div>
                  <h3>{n.title}<span className="v8-arrow" aria-hidden="true" /></h3>
                  <p>{n.summary}</p>
                </Link>
              </article>
            ))}
          </div>
          <p className="v8-small clg-note"><Link className="v8-under" href={href("/image-sources")}>Image sources</Link></p>
        </Wrap>
      </section>

      <Section rule id="earlier-direction" className="clg-earlier">
        <Wrap>
          <div className="clg-earlier__grid">
            <div className="v8-head clg-earlier__head">
              <h2 className="v8-h2">Earlier product (retired)</h2>
              <p className="v8-body">The earlier browser-testing product, kept as history. It is no longer offered.</p>
            </div>
            <ol className="clg-list">
              {EARLIER.map((e) => (
                <li key={e.id} id={e.id} className="clg-row clg-anchor">
                  <time className="clg-row__date" dateTime={e.date}>{formatDay(e.date)}</time>
                  <div className="clg-row__main">
                    <h3 className="clg-row__title">{e.summary}</h3>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Wrap>
      </Section>

      <Section rule tight>
        <Wrap>
          <div className="clg-end">
            <p className="v8-body">Where things stand today.</p>
            <TextLink to="/contour/status">Development status</TextLink>
          </div>
        </Wrap>
      </Section>
    </div>
  );
}
